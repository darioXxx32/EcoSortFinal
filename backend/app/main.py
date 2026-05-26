from __future__ import annotations

import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .schemas import HealthResponse, PredictionResponse, TaxonomyResponse
from .semantic_rules import build_supported_objects, build_taxonomy_overview
from .service import service
from .settings import TMP_DIR


app = FastAPI(
    title="EcoSort API",
    description="API de inferencia multimodal para clasificacion de residuos.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", mode=service.mode, model=service.model_info)


@app.get("/taxonomy", response_model=TaxonomyResponse)
def taxonomy() -> TaxonomyResponse:
    supported_objects = build_supported_objects(service.catalog)
    return TaxonomyResponse(
        app=service.catalog["app"],
        labels=service.catalog["labels"],
        overview=build_taxonomy_overview(service.catalog, supported_objects),
        supported_objects=supported_objects,
    )


@app.post("/predict", response_model=PredictionResponse)
async def predict(
    file: UploadFile = File(...),
    note: str = Form(default=""),
) -> PredictionResponse:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "capture.jpg").suffix or ".jpg"
    temp_path = TMP_DIR / f"{uuid4().hex}{suffix}"

    with temp_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        payload = service.predict(temp_path, note)
        return PredictionResponse(**payload)
    finally:
        temp_path.unlink(missing_ok=True)
