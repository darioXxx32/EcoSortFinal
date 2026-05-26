from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from .rules import normalize_text


@dataclass
class SimpleTokenizer:
    pad_token: str = "<pad>"
    unk_token: str = "<unk>"
    word_to_id: dict[str, int] = field(default_factory=dict)

    def fit(self, texts: Iterable[str], max_vocab_size: int = 1200) -> "SimpleTokenizer":
        counter: Counter[str] = Counter()
        for text in texts:
            counter.update(normalize_text(text).split())

        special_tokens = [self.pad_token, self.unk_token]
        most_common = [token for token, _ in counter.most_common(max_vocab_size - len(special_tokens))]
        vocab = special_tokens + most_common
        self.word_to_id = {token: idx for idx, token in enumerate(vocab)}
        return self

    @property
    def vocab_size(self) -> int:
        return len(self.word_to_id)

    def encode(self, text: str, max_length: int) -> tuple[list[int], list[int]]:
        token_ids = [
            self.word_to_id.get(token, self.word_to_id.get(self.unk_token, 1))
            for token in normalize_text(text).split()
        ][:max_length]
        attention_mask = [1] * len(token_ids)

        while len(token_ids) < max_length:
            token_ids.append(self.word_to_id.get(self.pad_token, 0))
            attention_mask.append(0)

        return token_ids, attention_mask

    def save(self, path: str | Path) -> None:
        payload = {
            "pad_token": self.pad_token,
            "unk_token": self.unk_token,
            "word_to_id": self.word_to_id,
        }
        Path(path).write_text(json.dumps(payload, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> "SimpleTokenizer":
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls(
            pad_token=payload["pad_token"],
            unk_token=payload["unk_token"],
            word_to_id=payload["word_to_id"],
        )
