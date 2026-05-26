from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import nn
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small


@dataclass(slots=True)
class ModelConfig:
    vocab_size: int
    num_classes: int
    text_embedding_dim: int = 96
    text_hidden_dim: int = 96
    fusion_dim: int = 256
    dropout: float = 0.25
    pretrained_backbone: bool = False
    freeze_backbone: bool = False


class TextEncoder(nn.Module):
    def __init__(self, vocab_size: int, embedding_dim: int, hidden_dim: int, dropout: float) -> None:
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embedding_dim, padding_idx=0)
        self.gru = nn.GRU(
            embedding_dim,
            hidden_dim,
            num_layers=1,
            batch_first=True,
            bidirectional=True,
        )
        self.dropout = nn.Dropout(dropout)
        self.output_dim = hidden_dim * 2

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        embedded = self.dropout(self.embedding(input_ids))
        lengths = attention_mask.sum(dim=1).cpu()
        packed = nn.utils.rnn.pack_padded_sequence(
            embedded, lengths.clamp(min=1), batch_first=True, enforce_sorted=False
        )
        _, hidden = self.gru(packed)
        hidden = torch.cat([hidden[-2], hidden[-1]], dim=1)
        return self.dropout(hidden)


class ImageEncoder(nn.Module):
    def __init__(self, pretrained: bool, freeze_backbone: bool, dropout: float) -> None:
        super().__init__()
        weights = MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
        self.backbone = mobilenet_v3_small(weights=weights)
        self.backbone.classifier = nn.Identity()
        self.output_dim = 576
        self.dropout = nn.Dropout(dropout)

        if freeze_backbone:
            for parameter in self.backbone.features.parameters():
                parameter.requires_grad = False

    def forward(self, images: torch.Tensor) -> torch.Tensor:
        features = self.backbone(images)
        return self.dropout(features)


class EcoSortMultimodalNet(nn.Module):
    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.image_encoder = ImageEncoder(
            pretrained=config.pretrained_backbone,
            freeze_backbone=config.freeze_backbone,
            dropout=config.dropout,
        )
        self.text_encoder = TextEncoder(
            vocab_size=config.vocab_size,
            embedding_dim=config.text_embedding_dim,
            hidden_dim=config.text_hidden_dim,
            dropout=config.dropout,
        )

        fusion_input_dim = self.image_encoder.output_dim + self.text_encoder.output_dim
        self.fusion = nn.Sequential(
            nn.Linear(fusion_input_dim, config.fusion_dim),
            nn.LayerNorm(config.fusion_dim),
            nn.GELU(),
            nn.Dropout(config.dropout),
            nn.Linear(config.fusion_dim, config.num_classes),
        )

    def forward(
        self,
        images: torch.Tensor,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
    ) -> torch.Tensor:
        image_features = self.image_encoder(images)
        text_features = self.text_encoder(input_ids, attention_mask)
        fused = torch.cat([image_features, text_features], dim=1)
        return self.fusion(fused)
