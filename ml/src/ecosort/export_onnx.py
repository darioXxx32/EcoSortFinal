from __future__ import annotations

import argparse
from pathlib import Path

import torch

from .model import EcoSortMultimodalNet, ModelConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Exporta el modelo de EcoSort a ONNX.")
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    checkpoint = torch.load(args.checkpoint, map_location="cpu")
    model = EcoSortMultimodalNet(ModelConfig(**checkpoint["model_config"]))
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    image_size = checkpoint["data_config"]["image_size"]
    max_text_length = checkpoint["data_config"]["max_text_length"]
    dummy_image = torch.randn(1, 3, image_size, image_size)
    dummy_tokens = torch.ones(1, max_text_length, dtype=torch.long)
    dummy_mask = torch.ones(1, max_text_length, dtype=torch.long)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        model,
        (dummy_image, dummy_tokens, dummy_mask),
        args.output,
        input_names=["image", "input_ids", "attention_mask"],
        output_names=["logits"],
        dynamic_axes={
            "image": {0: "batch"},
            "input_ids": {0: "batch", 1: "sequence"},
            "attention_mask": {0: "batch", 1: "sequence"},
            "logits": {0: "batch"},
        },
        opset_version=17,
    )
    print(f"Modelo exportado a {args.output}")


if __name__ == "__main__":
    main()
