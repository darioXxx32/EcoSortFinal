from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
ML_SRC_DIR = ROOT_DIR / "ml" / "src"
DEFAULT_MODEL_DIR = ROOT_DIR / "ml" / "artifacts" / "models" / "baseline"
SMOKE_MODEL_DIR = ROOT_DIR / "ml" / "artifacts" / "models" / "smoke"
LITE_MODEL_DIR = ROOT_DIR / "ml" / "artifacts" / "models" / "lite"
TMP_DIR = ROOT_DIR / "backend" / ".tmp"


@dataclass(slots=True)
class BackendSettings:
    model_checkpoint: Path = DEFAULT_MODEL_DIR / "best_model.pt"
    keras_model: Path = DEFAULT_MODEL_DIR / "best_model.keras"
    tokenizer_path: Path = DEFAULT_MODEL_DIR / "tokenizer.json"
    host: str = "0.0.0.0"
    port: int = 8000


settings = BackendSettings()
