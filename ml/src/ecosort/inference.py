from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch
from PIL import Image
from torchvision import transforms as T

from .config import DataConfig
from .model import EcoSortMultimodalNet, ModelConfig
from .rules import build_disposal_response
from .text_features import SimpleTokenizer


@dataclass(slots=True)
class Prediction:
    label_key: str
    confidence: float
    probabilities: dict[str, float]
    recommendation: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["confidence"] = round(self.confidence, 4)
        return payload


class EcoSortInferenceEngine:
    def __init__(self, checkpoint_path: Path, tokenizer_path: Path, device: str | None = None) -> None:
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        checkpoint = torch.load(checkpoint_path, map_location=self.device)
        config = ModelConfig(
            vocab_size=checkpoint["model_config"]["vocab_size"],
            num_classes=checkpoint["model_config"]["num_classes"],
            text_embedding_dim=checkpoint["model_config"]["text_embedding_dim"],
            text_hidden_dim=checkpoint["model_config"]["text_hidden_dim"],
            fusion_dim=checkpoint["model_config"]["fusion_dim"],
            dropout=checkpoint["model_config"]["dropout"],
            pretrained_backbone=False,
            freeze_backbone=False,
        )

        self.model = EcoSortMultimodalNet(config)
        self.model.load_state_dict(checkpoint["model_state"])
        self.model.to(self.device)
        self.model.eval()

        self.tokenizer = SimpleTokenizer.load(tokenizer_path)
        self.data_config = DataConfig(
            image_size=checkpoint["data_config"]["image_size"],
            max_text_length=checkpoint["data_config"]["max_text_length"],
        )
        self.transforms = T.Compose(
            [
                T.Resize((self.data_config.image_size, self.data_config.image_size)),
                T.ToTensor(),
                T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )
        self.index_to_label = {int(key): value for key, value in checkpoint["index_to_label"].items()}

    def predict(self, image_path: str | Path, user_text: str) -> Prediction:
        image = Image.open(image_path).convert("RGB")
        image_tensor = self.transforms(image).unsqueeze(0).to(self.device)
        token_ids, attention_mask = self.tokenizer.encode(user_text, self.data_config.max_text_length)
        token_tensor = torch.tensor([token_ids], dtype=torch.long, device=self.device)
        mask_tensor = torch.tensor([attention_mask], dtype=torch.long, device=self.device)

        with torch.no_grad():
            logits = self.model(image_tensor, token_tensor, mask_tensor)
            probabilities = torch.softmax(logits, dim=1).squeeze(0).cpu().numpy()

        best_index = int(np.argmax(probabilities))
        best_label = self.index_to_label[best_index]
        confidence = float(probabilities[best_index])
        probability_map = {
            self.index_to_label[idx]: round(float(score), 4)
            for idx, score in enumerate(probabilities.tolist())
        }
        recommendation = build_disposal_response(best_label, user_text, confidence)
        return Prediction(
            label_key=best_label,
            confidence=confidence,
            probabilities=probability_map,
            recommendation=recommendation,
        )
