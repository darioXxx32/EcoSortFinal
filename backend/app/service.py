from __future__ import annotations

import sys
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .settings import DEFAULT_MODEL_DIR, LITE_MODEL_DIR, ML_SRC_DIR, SMOKE_MODEL_DIR, settings
from .semantic_rules import GLASS_LABELS, analyze_semantics, build_semantic_enrichment

if str(ML_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(ML_SRC_DIR))

from ecosort.catalog import load_catalog  # type: ignore
from ecosort.keras_inference import EcoSortKerasInferenceEngine  # type: ignore
from ecosort.rules import build_disposal_response, normalize_text  # type: ignore


@dataclass(slots=True)
class ServicePrediction:
    mode: str
    label_key: str
    confidence: float
    probabilities: dict[str, float]
    recommendation: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "label_key": self.label_key,
            "confidence": round(float(self.confidence), 4),
            "probabilities": self.probabilities,
            "recommendation": self.recommendation,
        }


class HeuristicEngine:
    def __init__(self) -> None:
        self.catalog = load_catalog()
        self.labels = self.catalog["labels"]

    def predict(self, image_path: str | Path, user_text: str) -> ServicePrediction:
        semantic = analyze_semantics(normalize_text, image_path, f"{Path(image_path).stem} {user_text}")
        probabilities = {label: round(score, 4) for label, score in semantic.probabilities.items()}
        best_label = max(probabilities, key=probabilities.get)
        confidence = float(probabilities[best_label])
        recommendation = build_disposal_response(best_label, user_text, confidence)
        recommendation.update(build_semantic_enrichment(best_label, probabilities, self.catalog, semantic))
        return ServicePrediction(
            mode="heuristic",
            label_key=best_label,
            confidence=confidence,
            probabilities=probabilities,
            recommendation=recommendation,
        )


class EcoSortService:
    def __init__(self) -> None:
        self.catalog = load_catalog()
        self.mode = "heuristic"
        self.model_info: dict[str, Any] = {
            "artifact_format": "semantic",
            "epochs_completed": 0,
            "test_accuracy": None,
        }
        self._heuristic = HeuristicEngine()
        self._real_engine: EcoSortInferenceEngine | None = None

        model_candidates = [
            DEFAULT_MODEL_DIR,
            DEFAULT_MODEL_DIR.parent / "keras_pro",
            DEFAULT_MODEL_DIR.parent / "pro",
            LITE_MODEL_DIR,
            SMOKE_MODEL_DIR,
        ]

        checkpoint_path = settings.model_checkpoint
        keras_model_path = settings.keras_model
        tokenizer_path = settings.tokenizer_path
        metadata_path: Path | None = None
        for model_dir in model_candidates:
            if (model_dir / "best_model.keras").exists() and (model_dir / "tokenizer.json").exists():
                keras_model_path = model_dir / "best_model.keras"
                tokenizer_path = model_dir / "tokenizer.json"
                metadata_path = model_dir / "keras_metadata.json"
                break
            if (model_dir / "best_model.pt").exists() and (model_dir / "tokenizer.json").exists():
                checkpoint_path = model_dir / "best_model.pt"
                tokenizer_path = model_dir / "tokenizer.json"
                break

        if keras_model_path.exists() and tokenizer_path.exists():
            try:
                self._real_engine = EcoSortKerasInferenceEngine(keras_model_path, tokenizer_path, metadata_path)
                self.mode = "hybrid_keras"
                self.model_info = self._load_model_info(metadata_path, keras_model_path)
            except Exception:
                self._real_engine = None
                self.mode = "heuristic"

        if self._real_engine is None and checkpoint_path.exists() and tokenizer_path.exists():
            try:
                from ecosort.inference import EcoSortInferenceEngine  # type: ignore

                self._real_engine = EcoSortInferenceEngine(checkpoint_path, tokenizer_path)
                self.mode = "hybrid_ai"
                self.model_info = {
                    "artifact_format": "pytorch",
                    "artifact": str(checkpoint_path),
                    "epochs_completed": None,
                    "test_accuracy": None,
                }
            except Exception:
                self._real_engine = None
                self.mode = "heuristic"

    def _load_model_info(self, metadata_path: Path | None, artifact_path: Path) -> dict[str, Any]:
        if metadata_path and metadata_path.exists():
            try:
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                metrics = metadata.get("test_metrics", {})
                return {
                    "artifact_format": metadata.get("artifact_format", "keras"),
                    "artifact": str(artifact_path),
                    "epochs_completed": metadata.get("epochs_completed"),
                    "test_accuracy": metrics.get("accuracy"),
                    "test_loss": metrics.get("loss"),
                    "image_size": metadata.get("data_config", {}).get("image_size"),
                    "classes": metadata.get("model_config", {}).get("num_classes"),
                }
            except Exception:
                pass
        return {
            "artifact_format": "keras",
            "artifact": str(artifact_path),
            "epochs_completed": None,
            "test_accuracy": None,
        }

    def predict(self, image_path: str | Path, user_text: str) -> dict[str, Any]:
        heuristic_prediction = self._heuristic.predict(image_path, user_text)

        if self._real_engine is not None:
            prediction = self._real_engine.predict(image_path, user_text)
            model_payload = prediction.to_dict()
            return self._blend_predictions(model_payload, heuristic_prediction.to_dict(), user_text, image_path=image_path)

        heuristic_payload = heuristic_prediction.to_dict()
        heuristic_payload["mode"] = "semantic_heuristic"
        return heuristic_payload

    def _blend_predictions(
        self,
        model_payload: dict[str, Any],
        heuristic_payload: dict[str, Any],
        user_text: str,
        image_path: str | Path,
    ) -> dict[str, Any]:
        semantic = analyze_semantics(normalize_text, image_path, f"{Path(image_path).stem} {user_text}")
        model_probs = model_payload["probabilities"]
        heuristic_probs = heuristic_payload["probabilities"]
        heuristic_label = heuristic_payload["label_key"]
        heuristic_conf = float(heuristic_payload["confidence"])
        model_conf = float(model_payload["confidence"])
        text_boosted = bool(heuristic_payload["recommendation"].get("is_text_boosted"))
        model_label = model_payload["label_key"]
        strong_text_conflict = text_boosted and heuristic_label != model_label and heuristic_conf >= 0.32

        if strong_text_conflict:
            model_weight = 0.12 if model_conf < 0.85 else 0.18
            heuristic_weight = 1.0 - model_weight
            mode = "hybrid_keras_text_boost" if self.mode == "hybrid_keras" else "hybrid_text_boost"
        elif text_boosted and (heuristic_conf >= 0.42 or model_conf < 0.48):
            model_weight = 0.2 if model_conf < 0.38 else 0.35
            heuristic_weight = 1.0 - model_weight
            mode = "hybrid_keras_text_boost" if self.mode == "hybrid_keras" else "hybrid_text_boost"
        elif model_conf >= 0.72 and not semantic.reusable_hint:
            model_weight = 0.80 if self.mode == "hybrid_keras" else 0.72
            heuristic_weight = 1.0 - model_weight
            mode = self.mode
        else:
            model_weight = 0.42 if self.mode == "hybrid_keras" else 0.33
            heuristic_weight = 0.67
            heuristic_weight = 1.0 - model_weight
            mode = self.mode

        merged_scores = {
            label: (model_probs.get(label, 0.0) * model_weight) + (heuristic_probs.get(label, 0.0) * heuristic_weight)
            for label in self.catalog["labels"]
        }

        if text_boosted:
            merged_scores[heuristic_label] += 0.12
            if heuristic_label in {"paper", "cardboard"} and not semantic.matched_terms["metal"]:
                merged_scores[heuristic_label] += 0.28
                merged_scores["metal"] *= 0.18
            if heuristic_label == "plastic":
                merged_scores["plastic"] += 0.34
                if not semantic.matched_terms["paper"]:
                    merged_scores["paper"] *= 0.18
                if not semantic.matched_terms["cardboard"]:
                    merged_scores["cardboard"] *= 0.28

        if not semantic.matched_terms["battery"]:
            merged_scores["battery"] *= 0.14 if model_conf < 0.9 else 0.40

        if not any(semantic.matched_terms[label] for label in GLASS_LABELS):
            for label in GLASS_LABELS:
                if semantic.image_scores.get(label, 0.0) < 1.1:
                    merged_scores[label] *= 0.42

        if semantic.image_scores.get("paper", 0.0) >= 2.5 or semantic.matched_terms["paper"]:
            merged_scores["paper"] += 0.20
            if not semantic.matched_terms["metal"]:
                merged_scores["metal"] *= 0.35

        if semantic.image_scores.get("cardboard", 0.0) >= 2.2 or semantic.matched_terms["cardboard"]:
            merged_scores["cardboard"] += 0.20
            if not semantic.matched_terms["metal"]:
                merged_scores["metal"] *= 0.45

        if semantic.image_scores.get("metal", 0.0) >= 1.5 or semantic.matched_terms["metal"]:
            merged_scores["metal"] += 0.16

        if semantic.image_scores.get("plastic", 0.0) >= 1.5 or semantic.matched_terms["plastic"]:
            merged_scores["plastic"] += 0.14
            if semantic.matched_terms["plastic"] and not semantic.matched_terms["paper"]:
                merged_scores["paper"] *= 0.45
            if semantic.matched_terms["plastic"] and not semantic.matched_terms["cardboard"]:
                merged_scores["cardboard"] *= 0.55

        if semantic.reusable_hint:
            merged_scores["trash"] *= 0.5
            merged_scores["battery"] *= 0.25
            if semantic.intent_flags.get("donation"):
                merged_scores["clothes"] += 0.55
                merged_scores["shoes"] += 0.28
                merged_scores["plastic"] *= 0.18
                merged_scores["paper"] *= 0.12
                merged_scores["cardboard"] *= 0.18
                merged_scores["metal"] *= 0.35
            else:
                merged_scores["plastic"] += 0.16
                merged_scores["white-glass"] += 0.08

        if not user_text.strip():
            merged_scores["battery"] *= 0.5
            merged_scores["biological"] *= 0.72

        total = sum(merged_scores.values()) or 1.0
        final_probabilities = {
            label: round(score / total, 4) for label, score in merged_scores.items()
        }
        final_label = max(final_probabilities, key=final_probabilities.get)
        final_confidence = float(final_probabilities[final_label])

        recommendation = build_disposal_response(final_label, user_text, final_confidence)
        recommendation.update(build_semantic_enrichment(final_label, final_probabilities, self.catalog, semantic))
        recommendation["model_artifact"] = self.model_info.get("artifact_format")
        recommendation["model_epochs"] = self.model_info.get("epochs_completed")

        if recommendation.get("review_required"):
            recommendation["notes"] = [
                recommendation["review_reason"],
                *recommendation["notes"],
            ]

        return {
            "mode": mode,
            "label_key": final_label,
            "confidence": round(final_confidence, 4),
            "probabilities": final_probabilities,
            "recommendation": recommendation,
        }


service = EcoSortService()
