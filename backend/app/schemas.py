from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PredictionResponse(BaseModel):
    mode: str = Field(description="real_model o heuristic")
    label_key: str
    confidence: float
    probabilities: dict[str, float]
    recommendation: dict[str, Any]


class HealthResponse(BaseModel):
    status: str
    mode: str
    model: dict[str, Any] = Field(default_factory=dict)


class TaxonomyResponse(BaseModel):
    app: dict[str, Any]
    labels: dict[str, Any]
    overview: dict[str, Any]
    supported_objects: dict[str, list[str]]
