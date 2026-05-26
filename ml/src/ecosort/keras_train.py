from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .catalog import get_index_to_label, get_label_names, get_label_to_index
from .config import ANNOTATIONS_ROOT, MODELS_ROOT, DataConfig
from .text_features import SimpleTokenizer


class AnnotationBundle:
    def __init__(self, annotations_dir: Path) -> None:
        self.train = pd.read_csv(annotations_dir / "train.csv")
        self.val = pd.read_csv(annotations_dir / "val.csv")
        self.test = pd.read_csv(annotations_dir / "test.csv")


def attention_mask_float(input_tensor: Any, **_: Any) -> Any:
    tf = require_tensorflow()
    return tf.cast(tf.expand_dims(input_tensor, axis=-1), tf.float32)


def require_tensorflow() -> Any:
    try:
        import tensorflow as tf
    except ImportError as exc:  # pragma: no cover - depends on local environment
        raise RuntimeError(
            "TensorFlow no esta instalado. Usa Python 3.11/3.12 y ejecuta "
            "`pip install -r requirements-keras.txt` dentro de ml/."
        ) from exc
    return tf


def encode_texts(tokenizer: SimpleTokenizer, texts: list[str], max_length: int) -> tuple[np.ndarray, np.ndarray]:
    encoded = [tokenizer.encode(text, max_length) for text in texts]
    token_ids = np.asarray([item[0] for item in encoded], dtype=np.int32)
    masks = np.asarray([item[1] for item in encoded], dtype=np.int32)
    return token_ids, masks


def build_tf_dataset(
    tf: Any,
    dataframe: Any,
    tokenizer: SimpleTokenizer,
    data_config: DataConfig,
    batch_size: int,
    training: bool,
) -> Any:
    label_to_index = get_label_to_index()
    token_ids, masks = encode_texts(tokenizer, dataframe["text"].tolist(), data_config.max_text_length)
    labels = np.asarray([label_to_index[label] for label in dataframe["label"].tolist()], dtype=np.int32)
    image_paths = dataframe["image_path"].astype(str).to_numpy()

    dataset = tf.data.Dataset.from_tensor_slices(
        (
            {
                "image": image_paths,
                "input_ids": token_ids,
                "attention_mask": masks,
            },
            labels,
        )
    )

    def load_image(features: dict[str, Any], label: Any) -> tuple[dict[str, Any], Any]:
        image = tf.io.read_file(features["image"])
        image = tf.image.decode_image(image, channels=3, expand_animations=False)
        image = tf.image.convert_image_dtype(image, tf.float32)
        image = tf.image.resize(image, [data_config.image_size, data_config.image_size])
        if training:
            image = tf.image.random_flip_left_right(image)
            image = tf.image.random_brightness(image, max_delta=0.08)
            image = tf.image.random_contrast(image, lower=0.9, upper=1.1)
        return {
            "image": image,
            "input_ids": features["input_ids"],
            "attention_mask": features["attention_mask"],
        }, label

    if training:
        dataset = dataset.shuffle(min(len(dataframe), 4096), seed=data_config.random_seed, reshuffle_each_iteration=True)
    return dataset.map(load_image, num_parallel_calls=tf.data.AUTOTUNE).batch(batch_size).prefetch(tf.data.AUTOTUNE)


def build_model(tf: Any, data_config: DataConfig, vocab_size: int, num_classes: int, args: argparse.Namespace) -> Any:
    image_input = tf.keras.Input(shape=(data_config.image_size, data_config.image_size, 3), name="image")
    input_ids = tf.keras.Input(shape=(data_config.max_text_length,), dtype="int32", name="input_ids")
    attention_mask = tf.keras.Input(shape=(data_config.max_text_length,), dtype="int32", name="attention_mask")

    image_encoder = tf.keras.applications.MobileNetV3Small(
        include_top=False,
        weights="imagenet" if args.pretrained_backbone else None,
        pooling="avg",
        input_tensor=image_input,
    )
    image_encoder.trainable = not args.freeze_backbone
    image_features = tf.keras.layers.Dropout(args.dropout)(image_encoder.output)

    text = tf.keras.layers.Embedding(vocab_size, args.text_embedding_dim, mask_zero=True)(input_ids)
    mask = tf.keras.layers.Lambda(
        attention_mask_float,
        output_shape=(data_config.max_text_length, 1),
        name="attention_mask_float",
    )(attention_mask)
    text = tf.keras.layers.Multiply()([text, mask])
    text_features = tf.keras.layers.Bidirectional(
        tf.keras.layers.GRU(args.text_hidden_dim, dropout=args.dropout)
    )(text)

    fused = tf.keras.layers.Concatenate()([image_features, text_features])
    fused = tf.keras.layers.Dense(args.fusion_dim)(fused)
    fused = tf.keras.layers.LayerNormalization()(fused)
    fused = tf.keras.layers.Activation("gelu")(fused)
    fused = tf.keras.layers.Dropout(args.dropout)(fused)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax", name="class_probabilities")(fused)

    model = tf.keras.Model(inputs=[image_input, input_ids, attention_mask], outputs=outputs, name="ecosort_keras")
    model.compile(
        optimizer=tf.keras.optimizers.AdamW(learning_rate=args.learning_rate, weight_decay=args.weight_decay),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(),
        metrics=[
            tf.keras.metrics.SparseCategoricalAccuracy(name="accuracy"),
        ],
    )
    return model


def build_class_weight(labels: list[str]) -> dict[int, float]:
    label_to_index = get_label_to_index()
    counts = np.zeros(len(label_to_index), dtype=np.float32)
    for label in labels:
        counts[label_to_index[label]] += 1.0
    counts = np.maximum(counts, 1.0)
    weights = counts.sum() / (len(counts) * counts)
    return {idx: float(weight) for idx, weight in enumerate(weights)}


def train(args: argparse.Namespace) -> None:
    tf = require_tensorflow()
    tf.keras.utils.set_random_seed(args.seed)

    data_config = DataConfig(
        image_size=args.image_size,
        max_text_length=args.max_text_length,
        max_vocab_size=args.max_vocab,
        random_seed=args.seed,
    )
    bundle = AnnotationBundle(args.annotations)
    if args.max_train_samples:
        bundle.train = bundle.train.sample(min(args.max_train_samples, len(bundle.train)), random_state=args.seed)
        bundle.val = bundle.val.sample(min(max(args.max_train_samples // 2, 1), len(bundle.val)), random_state=args.seed)
        bundle.test = bundle.test.sample(min(max(args.max_train_samples // 2, 1), len(bundle.test)), random_state=args.seed)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    model_path = args.output_dir / "best_model.keras"
    tokenizer_path = args.output_dir / "tokenizer.json"
    metadata_path = args.output_dir / "keras_metadata.json"
    summary_path = args.output_dir / "training_summary.json"
    resume_path = args.resume_from or model_path
    previous_summary: dict[str, Any] = {}
    if args.resume and summary_path.exists():
        previous_summary = json.loads(summary_path.read_text(encoding="utf-8"))

    if args.resume and tokenizer_path.exists():
        tokenizer = SimpleTokenizer.load(tokenizer_path)
    else:
        tokenizer = SimpleTokenizer().fit(bundle.train["text"].tolist(), max_vocab_size=data_config.max_vocab_size)
        tokenizer.save(tokenizer_path)

    train_ds = build_tf_dataset(tf, bundle.train, tokenizer, data_config, args.batch_size, training=True)
    val_ds = build_tf_dataset(tf, bundle.val, tokenizer, data_config, args.batch_size, training=False)
    test_ds = build_tf_dataset(tf, bundle.test, tokenizer, data_config, args.batch_size, training=False)
    if args.resume and resume_path.exists():
        model = tf.keras.models.load_model(
            resume_path,
            custom_objects={"attention_mask_float": attention_mask_float},
            safe_mode=False,
        )
        model.compile(
            optimizer=tf.keras.optimizers.AdamW(learning_rate=args.learning_rate, weight_decay=args.weight_decay),
            loss=tf.keras.losses.SparseCategoricalCrossentropy(),
            metrics=[tf.keras.metrics.SparseCategoricalAccuracy(name="accuracy")],
        )
    else:
        model = build_model(tf, data_config, tokenizer.vocab_size, len(get_label_names()), args)

    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(str(model_path), monitor="val_accuracy", mode="max", save_best_only=True),
        tf.keras.callbacks.EarlyStopping(monitor="val_accuracy", mode="max", patience=args.patience, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor="val_accuracy", mode="max", factor=0.5, patience=1),
        tf.keras.callbacks.CSVLogger(str(args.output_dir / "training_log.csv"), append=args.resume),
    ]
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs,
        class_weight=build_class_weight(bundle.train["label"].tolist()) if args.class_weight else None,
        callbacks=callbacks,
        verbose=2,
    )

    if model_path.exists():
        model = tf.keras.models.load_model(
            model_path,
            custom_objects={"attention_mask_float": attention_mask_float},
            safe_mode=False,
        )
    test_loss, test_accuracy = model.evaluate(test_ds, verbose=0)

    current_history = {key: [float(value) for value in values] for key, values in history.history.items()}
    previous_history = previous_summary.get("history", {}) if previous_summary else {}
    merged_history = {
        key: [float(value) for value in previous_history.get(key, [])] + current_history.get(key, [])
        for key in sorted(set(previous_history) | set(current_history))
    }
    previous_epochs = int(previous_summary.get("epochs_completed", len(next(iter(previous_history.values()), []))))
    current_epochs = len(next(iter(current_history.values()), []))

    metadata = {
        "artifact_format": "keras",
        "primary_artifact": str(model_path),
        "tokenizer": str(tokenizer_path),
        "resume_from": str(resume_path) if args.resume else None,
        "epochs_completed": previous_epochs + current_epochs,
        "epochs_this_run": current_epochs,
        "index_to_label": get_index_to_label(),
        "data_config": asdict(data_config),
        "model_config": {
            "vocab_size": tokenizer.vocab_size,
            "num_classes": len(get_label_names()),
            "text_embedding_dim": args.text_embedding_dim,
            "text_hidden_dim": args.text_hidden_dim,
            "fusion_dim": args.fusion_dim,
            "dropout": args.dropout,
            "pretrained_backbone": args.pretrained_backbone,
            "freeze_backbone": args.freeze_backbone,
        },
        "history": merged_history,
        "last_run_history": current_history,
        "test_metrics": {
            "loss": round(float(test_loss), 4),
            "accuracy": round(float(test_accuracy), 4),
        },
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    (args.output_dir / "training_summary.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"Modelo Keras exportado a {model_path}")
    print(json.dumps(metadata["test_metrics"], indent=2))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Entrena EcoSort y exporta un modelo nativo .keras.")
    parser.add_argument("--annotations", type=Path, default=ANNOTATIONS_ROOT)
    parser.add_argument("--output-dir", type=Path, default=MODELS_ROOT / "keras_pro")
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=24)
    parser.add_argument("--learning-rate", type=float, default=5e-4)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--dropout", type=float, default=0.25)
    parser.add_argument("--text-embedding-dim", type=int, default=96)
    parser.add_argument("--text-hidden-dim", type=int, default=96)
    parser.add_argument("--fusion-dim", type=int, default=256)
    parser.add_argument("--image-size", type=int, default=160)
    parser.add_argument("--max-text-length", type=int, default=24)
    parser.add_argument("--max-vocab", type=int, default=1800)
    parser.add_argument("--max-train-samples", type=int, default=None)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--patience", type=int, default=3)
    parser.add_argument("--pretrained-backbone", action="store_true")
    parser.add_argument("--no-pretrained-backbone", action="store_false", dest="pretrained_backbone")
    parser.add_argument("--freeze-backbone", action="store_true")
    parser.add_argument("--class-weight", action="store_true")
    parser.add_argument("--no-class-weight", action="store_false", dest="class_weight")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--resume-from", type=Path, default=None)
    parser.set_defaults(pretrained_backbone=True, class_weight=True)
    return parser.parse_args()


if __name__ == "__main__":
    train(parse_args())
