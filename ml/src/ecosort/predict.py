from __future__ import annotations

import argparse
import json
from pathlib import Path

from .inference import EcoSortInferenceEngine


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Predice una clase de residuo con EcoSort.")
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--tokenizer", type=Path, required=True)
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--text", type=str, required=True)
    parser.add_argument("--device", type=str, default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    engine = EcoSortInferenceEngine(args.checkpoint, args.tokenizer, device=args.device)
    prediction = engine.predict(args.image, args.text)
    print(json.dumps(prediction.to_dict(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
