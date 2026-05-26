from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from .config import CATALOG_PATH


@lru_cache(maxsize=1)
def load_catalog(path: str | Path | None = None) -> dict[str, Any]:
    catalog_path = Path(path) if path else CATALOG_PATH
    with catalog_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def get_label_names(catalog: dict[str, Any] | None = None) -> list[str]:
    catalog = catalog or load_catalog()
    return list(catalog["labels"].keys())


def get_label_to_index(catalog: dict[str, Any] | None = None) -> dict[str, int]:
    return {label: idx for idx, label in enumerate(get_label_names(catalog))}


def get_index_to_label(catalog: dict[str, Any] | None = None) -> dict[int, str]:
    return {idx: label for label, idx in get_label_to_index(catalog).items()}


def get_label_info(label_name: str, catalog: dict[str, Any] | None = None) -> dict[str, Any]:
    catalog = catalog or load_catalog()
    return catalog["labels"][label_name]


def get_keyword_groups(catalog: dict[str, Any] | None = None) -> dict[str, list[str]]:
    catalog = catalog or load_catalog()
    return catalog["contamination_keywords"]
