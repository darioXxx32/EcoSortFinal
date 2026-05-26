from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
import torch
from PIL import Image
from torch.utils.data import Dataset
from torchvision import transforms as T

from .catalog import get_label_to_index
from .config import DataConfig
from .text_features import SimpleTokenizer


def build_transforms(image_size: int, training: bool) -> T.Compose:
    if training:
        return T.Compose(
            [
                T.Resize((image_size + 16, image_size + 16)),
                T.RandomResizedCrop(image_size, scale=(0.75, 1.0)),
                T.RandomHorizontalFlip(),
                T.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
                T.ToTensor(),
                T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )
    return T.Compose(
        [
            T.Resize((image_size, image_size)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )


@dataclass(slots=True)
class DatasetBundle:
    train: pd.DataFrame
    val: pd.DataFrame
    test: pd.DataFrame


def load_annotations(annotations_dir: str | Path) -> DatasetBundle:
    annotations_path = Path(annotations_dir)
    return DatasetBundle(
        train=pd.read_csv(annotations_path / "train.csv"),
        val=pd.read_csv(annotations_path / "val.csv"),
        test=pd.read_csv(annotations_path / "test.csv"),
    )


class EcoSortDataset(Dataset):
    def __init__(
        self,
        dataframe: pd.DataFrame,
        tokenizer: SimpleTokenizer,
        data_config: DataConfig,
        training: bool = False,
    ) -> None:
        self.dataframe = dataframe.reset_index(drop=True)
        self.tokenizer = tokenizer
        self.data_config = data_config
        self.transforms = build_transforms(data_config.image_size, training=training)
        self.label_to_index = get_label_to_index()

    def __len__(self) -> int:
        return len(self.dataframe)

    def __getitem__(self, index: int) -> dict[str, Any]:
        row = self.dataframe.iloc[index]
        image = Image.open(row["image_path"]).convert("RGB")
        image_tensor = self.transforms(image)
        token_ids, attention_mask = self.tokenizer.encode(row["text"], self.data_config.max_text_length)

        return {
            "image": image_tensor,
            "input_ids": torch.tensor(token_ids, dtype=torch.long),
            "attention_mask": torch.tensor(attention_mask, dtype=torch.long),
            "label": torch.tensor(self.label_to_index[row["label"]], dtype=torch.long),
            "label_name": row["label"],
            "text": row["text"],
            "image_path": row["image_path"],
        }
