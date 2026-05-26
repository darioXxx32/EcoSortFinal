from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATASET_ROOT = PROJECT_ROOT / "garbage_classification"
CATALOG_PATH = PROJECT_ROOT / "data" / "metadata" / "class_catalog.json"
ARTIFACTS_ROOT = PROJECT_ROOT / "ml" / "artifacts"
ANNOTATIONS_ROOT = ARTIFACTS_ROOT / "data"
MODELS_ROOT = ARTIFACTS_ROOT / "models"
REPORTS_ROOT = ARTIFACTS_ROOT / "reports"


@dataclass(slots=True)
class DataConfig:
    image_size: int = 160
    max_text_length: int = 24
    max_vocab_size: int = 1200
    train_ratio: float = 0.7
    val_ratio: float = 0.15
    test_ratio: float = 0.15
    random_seed: int = 42


@dataclass(slots=True)
class TrainConfig:
    batch_size: int = 32
    epochs: int = 8
    learning_rate: float = 1e-3
    weight_decay: float = 1e-4
    dropout: float = 0.25
    text_embedding_dim: int = 96
    text_hidden_dim: int = 96
    fusion_dim: int = 256
    num_workers: int = 0
    pretrained_backbone: bool = False
    freeze_backbone: bool = False
    patience: int = 3

    def to_dict(self) -> dict[str, object]:
        return asdict(self)
