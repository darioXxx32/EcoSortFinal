from __future__ import annotations

import argparse
import json
import random
from dataclasses import asdict
from pathlib import Path
from typing import Any

import numpy as np
import torch
from sklearn.metrics import accuracy_score, f1_score
from torch import nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import DataLoader, WeightedRandomSampler

try:
    from tqdm import tqdm
except ImportError:  # pragma: no cover - fallback para entornos minimos
    def tqdm(iterable, **_: object):
        return iterable

from .catalog import get_index_to_label, get_label_names, get_label_to_index
from .config import ANNOTATIONS_ROOT, MODELS_ROOT, DataConfig, TrainConfig
from .dataset import EcoSortDataset, load_annotations
from .model import EcoSortMultimodalNet, ModelConfig
from .text_features import SimpleTokenizer


def set_reproducible_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.benchmark = True


def build_loaders(
    annotations_dir: Path,
    data_config: DataConfig,
    batch_size: int,
    num_workers: int,
    max_train_samples: int | None = None,
    use_weighted_sampler: bool = True,
) -> tuple[dict[str, DataLoader], SimpleTokenizer, dict[str, Any]]:
    bundle = load_annotations(annotations_dir)

    if max_train_samples:
        bundle.train = bundle.train.sample(min(max_train_samples, len(bundle.train)), random_state=data_config.random_seed)
        bundle.val = bundle.val.sample(min(max_train_samples // 2, len(bundle.val)), random_state=data_config.random_seed)
        bundle.test = bundle.test.sample(min(max_train_samples // 2, len(bundle.test)), random_state=data_config.random_seed)

    tokenizer = SimpleTokenizer().fit(bundle.train["text"].tolist(), max_vocab_size=data_config.max_vocab_size)
    datasets = {
        "train": EcoSortDataset(bundle.train, tokenizer, data_config, training=True),
        "val": EcoSortDataset(bundle.val, tokenizer, data_config, training=False),
        "test": EcoSortDataset(bundle.test, tokenizer, data_config, training=False),
    }

    train_sampler = None
    if use_weighted_sampler:
        sample_weights = build_sample_weights(bundle.train["label"].tolist()).tolist()
        train_sampler = WeightedRandomSampler(
            weights=sample_weights,
            num_samples=len(sample_weights),
            replacement=True,
        )

    loaders = {
        split: DataLoader(
            dataset,
            batch_size=batch_size,
            shuffle=(split == "train" and train_sampler is None),
            sampler=train_sampler if split == "train" else None,
            num_workers=num_workers,
            pin_memory=torch.cuda.is_available(),
        )
        for split, dataset in datasets.items()
    }
    frames = {"train": bundle.train, "val": bundle.val, "test": bundle.test}
    return loaders, tokenizer, frames


def build_class_weights(train_labels: list[str]) -> torch.Tensor:
    label_to_index = get_label_to_index()
    counts = np.zeros(len(label_to_index), dtype=np.float32)
    for label in train_labels:
        counts[label_to_index[label]] += 1.0
    counts = np.maximum(counts, 1.0)
    weights = counts.sum() / (len(counts) * counts)
    return torch.tensor(weights, dtype=torch.float32)


def build_sample_weights(train_labels: list[str]) -> torch.Tensor:
    class_weights = build_class_weights(train_labels)
    label_to_index = get_label_to_index()
    return torch.tensor([float(class_weights[label_to_index[label]]) for label in train_labels], dtype=torch.float32)


def run_epoch(
    model: EcoSortMultimodalNet,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    optimizer: AdamW | None = None,
) -> tuple[float, float, float]:
    is_training = optimizer is not None
    model.train(is_training)
    total_loss = 0.0
    predictions: list[int] = []
    targets: list[int] = []

    iterator = tqdm(loader, leave=False)
    for batch in iterator:
        images = batch["image"].to(device)
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        labels = batch["label"].to(device)

        if is_training:
            optimizer.zero_grad(set_to_none=True)

        logits = model(images, input_ids, attention_mask)
        loss = criterion(logits, labels)

        if is_training:
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

        total_loss += loss.item() * labels.size(0)
        predictions.extend(logits.argmax(dim=1).detach().cpu().tolist())
        targets.extend(labels.detach().cpu().tolist())

    epoch_loss = total_loss / max(len(loader.dataset), 1)
    epoch_acc = accuracy_score(targets, predictions)
    epoch_f1 = f1_score(targets, predictions, average="macro")
    return epoch_loss, epoch_acc, epoch_f1


def evaluate_loader(
    model: EcoSortMultimodalNet,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> dict[str, float]:
    loss, accuracy, macro_f1 = run_epoch(model, loader, criterion, device, optimizer=None)
    return {
        "loss": round(float(loss), 4),
        "accuracy": round(float(accuracy), 4),
        "macro_f1": round(float(macro_f1), 4),
    }


def save_checkpoint(
    model: EcoSortMultimodalNet,
    model_config: ModelConfig,
    data_config: DataConfig,
    output_dir: Path,
    tokenizer: SimpleTokenizer,
    history: dict[str, list[float]],
    extra_metadata: dict[str, Any] | None = None,
) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    tokenizer_path = output_dir / "tokenizer.json"
    checkpoint_path = output_dir / "best_model.pt"
    tokenizer.save(tokenizer_path)

    payload = {
        "model_state": model.state_dict(),
        "model_config": asdict(model_config),
        "data_config": asdict(data_config),
        "index_to_label": get_index_to_label(),
        "history": history,
        "metadata": extra_metadata or {},
    }
    torch.save(payload, checkpoint_path)
    return checkpoint_path, tokenizer_path


def train(args: argparse.Namespace) -> None:
    set_reproducible_seed(args.seed)
    data_config = DataConfig(
        image_size=args.image_size,
        max_text_length=args.max_text_length,
        max_vocab_size=args.max_vocab,
        random_seed=args.seed,
    )
    train_config = TrainConfig(
        batch_size=args.batch_size,
        epochs=args.epochs,
        learning_rate=args.learning_rate,
        weight_decay=args.weight_decay,
        dropout=args.dropout,
        text_embedding_dim=args.text_embedding_dim,
        text_hidden_dim=args.text_hidden_dim,
        fusion_dim=args.fusion_dim,
        num_workers=args.num_workers,
        pretrained_backbone=args.pretrained_backbone,
        freeze_backbone=args.freeze_backbone,
    )

    loaders, tokenizer, frames = build_loaders(
        args.annotations,
        data_config,
        batch_size=train_config.batch_size,
        num_workers=train_config.num_workers,
        max_train_samples=args.max_train_samples,
        use_weighted_sampler=args.weighted_sampler,
    )
    device = torch.device(args.device or ("cuda" if torch.cuda.is_available() else "cpu"))
    model_config = ModelConfig(
        vocab_size=tokenizer.vocab_size,
        num_classes=len(get_label_names()),
        text_embedding_dim=train_config.text_embedding_dim,
        text_hidden_dim=train_config.text_hidden_dim,
        fusion_dim=train_config.fusion_dim,
        dropout=train_config.dropout,
        pretrained_backbone=train_config.pretrained_backbone,
        freeze_backbone=train_config.freeze_backbone,
    )
    model = EcoSortMultimodalNet(model_config).to(device)

    class_weights = build_class_weights(frames["train"]["label"].tolist()).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights, label_smoothing=args.label_smoothing)
    optimizer = AdamW(model.parameters(), lr=train_config.learning_rate, weight_decay=train_config.weight_decay)
    scheduler = ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=1)

    history: dict[str, list[float]] = {
        "train_loss": [],
        "train_acc": [],
        "train_f1": [],
        "val_loss": [],
        "val_acc": [],
        "val_f1": [],
    }
    best_val_f1 = -1.0
    best_epoch = -1
    epochs_without_improvement = 0

    for epoch in range(train_config.epochs):
        print(f"Epoch {epoch + 1}/{train_config.epochs}")
        train_metrics = run_epoch(model, loaders["train"], criterion, device, optimizer=optimizer)
        val_metrics = run_epoch(model, loaders["val"], criterion, device, optimizer=None)
        scheduler.step(val_metrics[2])

        history["train_loss"].append(train_metrics[0])
        history["train_acc"].append(train_metrics[1])
        history["train_f1"].append(train_metrics[2])
        history["val_loss"].append(val_metrics[0])
        history["val_acc"].append(val_metrics[1])
        history["val_f1"].append(val_metrics[2])

        print(
            f"train_loss={train_metrics[0]:.4f} train_acc={train_metrics[1]:.4f} train_f1={train_metrics[2]:.4f} "
            f"val_loss={val_metrics[0]:.4f} val_acc={val_metrics[1]:.4f} val_f1={val_metrics[2]:.4f}"
        )

        if val_metrics[2] > best_val_f1:
            best_val_f1 = val_metrics[2]
            best_epoch = epoch + 1
            save_checkpoint(model, model_config, data_config, args.output_dir, tokenizer, history)
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1

        if epochs_without_improvement >= train_config.patience:
            print("Early stopping activado.")
            break

    checkpoint_path = args.output_dir / "best_model.pt"
    if checkpoint_path.exists():
        checkpoint = torch.load(checkpoint_path, map_location=device)
        model.load_state_dict(checkpoint["model_state"])

    test_metrics = evaluate_loader(model, loaders["test"], criterion, device)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    metrics_path = args.output_dir / "training_summary.json"
    class_distribution = {
        split: frames[split]["label"].value_counts().sort_index().to_dict()
        for split in ("train", "val", "test")
    }
    metrics_path.write_text(
        json.dumps(
            {
                "best_epoch": best_epoch,
                "best_val_f1": round(best_val_f1, 4),
                "test_metrics": test_metrics,
                "history": history,
                "train_config": train_config.to_dict(),
                "data_config": asdict(data_config),
                "class_distribution": class_distribution,
                "artifact_format": "pytorch",
                "primary_artifact": str(checkpoint_path),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(
        f"Entrenamiento finalizado. Mejor epoch: {best_epoch}, "
        f"best_val_f1={best_val_f1:.4f}, test_macro_f1={test_metrics['macro_f1']:.4f}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Entrena el modelo multimodal de EcoSort.")
    parser.add_argument("--annotations", type=Path, default=ANNOTATIONS_ROOT)
    parser.add_argument("--output-dir", type=Path, default=MODELS_ROOT / "baseline")
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--learning-rate", type=float, default=7e-4)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--dropout", type=float, default=0.25)
    parser.add_argument("--label-smoothing", type=float, default=0.05)
    parser.add_argument("--text-embedding-dim", type=int, default=96)
    parser.add_argument("--text-hidden-dim", type=int, default=96)
    parser.add_argument("--fusion-dim", type=int, default=256)
    parser.add_argument("--image-size", type=int, default=160)
    parser.add_argument("--max-text-length", type=int, default=24)
    parser.add_argument("--max-vocab", type=int, default=1200)
    parser.add_argument("--num-workers", type=int, default=0)
    parser.add_argument("--device", type=str, default=None)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-train-samples", type=int, default=None)
    parser.add_argument("--pretrained-backbone", action="store_true")
    parser.add_argument("--no-pretrained-backbone", action="store_false", dest="pretrained_backbone")
    parser.add_argument("--freeze-backbone", action="store_true")
    parser.add_argument("--weighted-sampler", action="store_true")
    parser.add_argument("--no-weighted-sampler", action="store_false", dest="weighted_sampler")
    parser.set_defaults(pretrained_backbone=True, weighted_sampler=True)
    return parser.parse_args()


if __name__ == "__main__":
    train(parse_args())
