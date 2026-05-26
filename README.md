# EcoSort

EcoSort es una app multimodal de inteligencia artificial para clasificar residuos a partir de una foto y un texto corto del usuario. La solución está pensada para una presentación tipo Shark Tank: fácil de demostrar, con impacto ambiental real y una arquitectura técnica defendible en clase.

## Qué resuelve

Muchas personas quieren reciclar, pero fallan justo en el momento de decidir dónde botar algo. EcoSort convierte esa duda en una decisión inmediata:

- identifica el tipo de residuo,
- indica si es reciclable o no,
- explica cómo desecharlo,
- muestra un nivel de confianza.

La versión actual mantiene 12 clases visuales base y una capa semántica ampliada que cubre 562 objetos, descripciones, intenciones y alias frecuentes.

## Modalidades

- `Imagen`: foto tomada o seleccionada desde el celular.
- `Texto`: nota breve como `tenía comida`, `venía de un producto de limpieza` o `está sucio`.

## Arquitectura del proyecto

```text
final/
├── garbage_classification/        # dataset original de imágenes
├── data/metadata/                 # taxonomía de residuos y reglas de negocio
├── ml/                            # preparación, entrenamiento, evaluación y exportación
├── backend/                       # API FastAPI para inferencia y recomendaciones
├── mobile/                        # app Expo / React Native
├── docs/                          # informe IEEE, pitch Shark Tank y arquitectura
└── scripts/                       # automatización en PowerShell
```

## Flujo técnico

1. `ml` escanea `garbage_classification/`.
2. Se generan anotaciones multimodales con texto sintético controlado a partir de la clase real del residuo.
3. Se entrena un modelo multimodal en PyTorch:
   - encoder visual CNN ligero,
   - encoder textual con embeddings + BiGRU,
   - fusión tardía con capa clasificadora.
4. `backend` carga el checkpoint y combina la predicción con reglas de reciclaje y una capa semantica hibrida.
5. `mobile` consume la API y presenta el resultado para la demo.

## Requisitos sugeridos

- Python `3.11+`
- Node `20+`
- npm `10+`

Nota: en esta máquina hay Python `3.14`, lo que vuelve poco recomendable TensorFlow; por eso el proyecto quedó orientado a PyTorch + ONNX/FastAPI.

## Inicio rápido

### 1. Preparar el dataset multimodal

```powershell
cd C:\Users\User\Desktop\final
python -m ml.src.ecosort.prepare_data --dataset-root .\garbage_classification --output-dir .\ml\artifacts\data
```

El pipeline actual genera varias notas sinteticas por imagen y separa los splits por imagen antes de expandir variantes. Esto aumenta material textual sin contaminar train/val/test.

### 2. Entrenar el modelo

```powershell
cd C:\Users\User\Desktop\final\ml
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m ecosort.train --annotations ..\ml\artifacts\data --epochs 8 --batch-size 32
```

Para un entrenamiento mas robusto orientado a reducir falsos positivos, tambien puedes usar:

```powershell
cd C:\Users\User\Desktop\final
.\scripts\train_pro.ps1
```

### 2b. Entrenar/exportar modelo `.keras`

La ruta `.keras` esta disponible en `ml/src/ecosort/keras_train.py`. Requiere un entorno con TensorFlow compatible; recomendado Python 3.11 o 3.12:

```powershell
cd C:\Users\User\Desktop\final\ml
python -m venv .venv-keras
.\.venv-keras\Scripts\Activate.ps1
pip install -r requirements-keras.txt
$env:PYTHONPATH = (Resolve-Path ".\src").Path
python -m ecosort.keras_train --annotations ..\ml\artifacts\data --output-dir ..\ml\artifacts\models\keras_pro
```

El backend intenta cargar `best_model.keras` si existe; si TensorFlow no esta instalado o no hay `.keras`, usa automaticamente el checkpoint PyTorch disponible.

Corrida Keras actual: 120 epocas acumuladas sobre anotaciones enriquecidas, `test_accuracy = 0.9207`, `test_loss = 0.2485`, artefacto en `ml/artifacts/models/keras_pro/best_model.keras`.

### 3. Levantar la API

```powershell
cd C:\Users\User\Desktop\final\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 4. Ejecutar la app móvil

```powershell
cd C:\Users\User\Desktop\final\mobile
npm install
npx expo start
```

## Entregables ya contemplados

- `docs/report/ecosort_ieee.tex`: base del informe IEEE Conference.
- `docs/pitch/shark_tank_pitch.md`: guion comercial/técnico del pitch.
- `docs/pitch/slides_outline.md`: estructura de diapositivas.
- `docs/supported_objects.md`: 562 objetos, descripciones, intenciones y subtipos soportados por la capa hibrida.
- `docs/training_workflow.md`: flujo profesional PyTorch + Keras, artefactos y comandos.
- `mobile/`: demo funcional del producto.
- `backend/`: servicio listo para conectar la app con el modelo.

## Verificacion realizada en esta base

- Se generaron anotaciones multimodales en `ml/artifacts/data/`.
- Se entreno un checkpoint de humo en `ml/artifacts/models/smoke/`.
- Se evaluo ese checkpoint en `ml/artifacts/reports/smoke/`.
- Resultado de humo sobre `test`: `accuracy = 0.3771`, `macro_f1 = 0.1834`.

Estos valores no son el resultado final que deberian presentar; sirven como prueba de que el pipeline completo funciona y como base para un entrenamiento mas largo.

## Idea de valor para el pitch

`EcoSort convierte una duda cotidiana en una decisión ambiental correcta en menos de 5 segundos.`
