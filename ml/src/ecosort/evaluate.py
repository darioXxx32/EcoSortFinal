from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib.pyplot as plt
import torch
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from torch.utils.data import DataLoader

from .catalog import get_label_names
from .config import ANNOTATIONS_ROOT, REPORTS_ROOT, DataConfig
from .dataset import EcoSortDataset, load_annotations
from .model import EcoSortMultimodalNet, ModelConfig
from .text_features import SimpleTokenizer


def evaluate_model(
    checkpoint: Path,
    tokenizer: Path,
    annotations: Path,
    split: str,
    output_dir: Path,
    device: str | None = None,
) -> None:
    checkpoint_payload = torch.load(checkpoint, map_location=device or "cpu")
    tokenizer_instance = SimpleTokenizer.load(tokenizer)
    annotations_bundle = load_annotations(annotations)
    dataframe = getattr(annotations_bundle, split)
    data_config = DataConfig(**checkpoint_payload["data_config"])
    dataset = EcoSortDataset(dataframe, tokenizer_instance, data_config=data_config, training=False)
    loader = DataLoader(dataset, batch_size=32, shuffle=False)

    model = EcoSortMultimodalNet(ModelConfig(**checkpoint_payload["model_config"]))
    resolved_device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
    model.load_state_dict(checkpoint_payload["model_state"])
    model.to(resolved_device)
    model.eval()

    predictions: list[int] = []
    targets: list[int] = []

    with torch.no_grad():
        for batch in loader:
            logits = model(
                batch["image"].to(resolved_device),
                batch["input_ids"].to(resolved_device),
                batch["attention_mask"].to(resolved_device),
            )
            predictions.extend(logits.argmax(dim=1).cpu().tolist())
            targets.extend(batch["label"].cpu().tolist())

    labels = get_label_names()
    metrics = {
        "accuracy": round(float(accuracy_score(targets, predictions)), 4),
        "macro_f1": round(float(f1_score(targets, predictions, average="macro")), 4),
        "split": split,
    }
    report = classification_report(targets, predictions, target_names=labels, output_dict=True, zero_division=0)
    confusion = confusion_matrix(targets, predictions)

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / f"{split}_metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    (output_dir / f"{split}_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    figure = plt.figure(figsize=(10, 8))
    plt.imshow(confusion, cmap="YlGn")
    plt.title(f"Matriz de confusion - {split}")
    plt.xlabel("Prediccion")
    plt.ylabel("Real")
    plt.xticks(range(len(labels)), labels, rotation=45, ha="right")
    plt.yticks(range(len(labels)), labels)
    plt.tight_layout()
    figure.savefig(output_dir / f"{split}_confusion_matrix.png", dpi=200)
    plt.close(figure)

    print(json.dumps(metrics, indent=2))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evalua un checkpoint de EcoSort.")
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--tokenizer", type=Path, required=True)
    parser.add_argument("--annotations", type=Path, default=ANNOTATIONS_ROOT)
    parser.add_argument("--split", type=str, default="test", choices=["train", "val", "test"])
    parser.add_argument("--output-dir", type=Path, default=REPORTS_ROOT / "baseline")
    parser.add_argument("--device", type=str, default=None)
    return parser.parse_args()


if __name__ == "__main__":
    evaluate_model(**vars(parse_args()))
