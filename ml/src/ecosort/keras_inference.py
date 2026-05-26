from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from .config import DataConfig
from .rules import build_disposal_response
from .text_features import SimpleTokenizer


def attention_mask_float(input_tensor: Any, **_: Any) -> Any:
    import tensorflow as tf

    return tf.cast(tf.expand_dims(input_tensor, axis=-1), tf.float32)


@dataclass(slots=True)
class KerasPrediction:
    label_key: str
    confidence: float
    probabilities: dict[str, float]
    recommendation: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["confidence"] = round(self.confidence, 4)
        return payload


def require_tensorflow() -> Any:
    try:
        import tensorflow as tf
    except ImportError as exc:  # pragma: no cover - depends on local environment
        raise RuntimeError("TensorFlow no esta instalado; no se puede cargar best_model.keras.") from exc
    return tf


class EcoSortKerasInferenceEngine:
    def __init__(
        self,
        model_path: Path,
        tokenizer_path: Path,
        metadata_path: Path | None = None,
    ) -> None:
        self.tf = require_tensorflow()
        self.model = self.tf.keras.models.load_model(
            model_path,
            custom_objects={"attention_mask_float": attention_mask_float},
            safe_mode=False,
        )
        self.tokenizer = SimpleTokenizer.load(tokenizer_path)

        metadata = {}
        if metadata_path and metadata_path.exists():
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

        data_config = metadata.get("data_config", {})
        self.data_config = DataConfig(
            image_size=int(data_config.get("image_size", 160)),
            max_text_length=int(data_config.get("max_text_length", 24)),
            max_vocab_size=int(data_config.get("max_vocab_size", self.tokenizer.vocab_size)),
            random_seed=int(data_config.get("random_seed", 42)),
        )
        raw_index = metadata.get("index_to_label") or {}
        self.index_to_label = {int(key): value for key, value in raw_index.items()}
        if not self.index_to_label:
            from .catalog import get_index_to_label

            self.index_to_label = get_index_to_label()

    def _load_image(self, image_path: str | Path) -> np.ndarray:
        image = Image.open(image_path).convert("RGB")
        image = image.resize((self.data_config.image_size, self.data_config.image_size))
        array = np.asarray(image, dtype=np.float32) / 255.0
        return np.expand_dims(array, axis=0)

    def predict(self, image_path: str | Path, user_text: str) -> KerasPrediction:
        token_ids, attention_mask = self.tokenizer.encode(user_text, self.data_config.max_text_length)
        inputs = {
            "image": self._load_image(image_path),
            "input_ids": np.asarray([token_ids], dtype=np.int32),
            "attention_mask": np.asarray([attention_mask], dtype=np.int32),
        }
        probabilities = self.model.predict(inputs, verbose=0)[0]
        best_index = int(np.argmax(probabilities))
        best_label = self.index_to_label[best_index]
        confidence = float(probabilities[best_index])
        probability_map = {
            self.index_to_label[idx]: round(float(score), 4)
            for idx, score in enumerate(probabilities.tolist())
        }
        recommendation = build_disposal_response(best_label, user_text, confidence)
        return KerasPrediction(
            label_key=best_label,
            confidence=confidence,
            probabilities=probability_map,
            recommendation=recommendation,
        )
