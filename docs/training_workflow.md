# Flujo profesional de entrenamiento

Este proyecto ahora tiene dos rutas de entrenamiento:

- `PyTorch pro`: ruta recomendada para esta maquina, porque Python 3.14 no es el entorno ideal para TensorFlow.
- `Keras pro`: ruta opcional para exportar `best_model.keras` en un entorno con Python 3.11 o 3.12 y TensorFlow instalado.

## 1. Preparar anotaciones

```powershell
.\scripts\prepare_data.ps1
```

La preparacion genera tres variantes textuales por imagen y divide por imagen antes de expandir variantes. Asi se evita que la misma foto aparezca en entrenamiento y prueba con textos distintos.

## 2. Entrenar ruta PyTorch pro

```powershell
.\scripts\train_pro.ps1
```

Artefactos principales:

- `ml/artifacts/models/pro/best_model.pt`
- `ml/artifacts/models/pro/tokenizer.json`
- `ml/artifacts/models/pro/training_summary.json`

El resumen incluye `best_val_f1`, metricas de test y distribucion por clase.

## 3. Entrenar ruta Keras `.keras`

En un entorno compatible:

```powershell
cd .\ml
python -m venv .venv-keras
.\.venv-keras\Scripts\Activate.ps1
pip install -r requirements-keras.txt
$env:PYTHONPATH = (Resolve-Path ".\src").Path
python -m ecosort.keras_train --annotations ..\ml\artifacts\data --output-dir ..\ml\artifacts\models\keras_pro
```

O usando el script si tu `.venv` ya tiene TensorFlow:

```powershell
.\scripts\train_keras.ps1
```

Artefactos principales:

- `ml/artifacts/models/keras_pro/best_model.keras`
- `ml/artifacts/models/keras_pro/tokenizer.json`
- `ml/artifacts/models/keras_pro/keras_metadata.json`

Corrida actual:

- Epocas ejecutadas: 124 acumuladas
- Ultima reanudacion: 1 epoca desde `best_model.keras` con anotaciones textuales enriquecidas y casos ambiguos
- Muestras de entrenamiento usadas: 112152
- Muestras de prueba: 22766
- Imagen: 128x128
- Backbone: MobileNetV3 Small preentrenado, congelado
- Test accuracy metadata: 0.8678
- Test accuracy recalculada por batch: 0.8666
- Macro F1 recalculado: 0.8380
- F1 ponderado recalculado: 0.8667
- Test loss: 0.6740

## 4. Backend

El backend busca modelos en este orden aproximado:

1. `best_model.keras` si existe.
2. `best_model.pt` pro/lite/smoke si no hay Keras utilizable.
3. Motor semantico si no puede cargar ningun modelo.

Esto permite presentar el proyecto aunque el modelo final todavia este entrenandose.
