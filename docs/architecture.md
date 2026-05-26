# Arquitectura EcoSort

## Resumen

EcoSort es una solucion multimodal compuesta por tres capas:

1. `ml/`: prepara los datos, genera texto sintetico controlado y entrena el modelo imagen + texto.
2. `backend/`: expone una API FastAPI para inferencia y recomendaciones de desecho.
3. `mobile/`: app Expo/React Native para la demo funcional.

## Flujo de datos

1. El dataset base vive en `garbage_classification/`.
2. `ml/src/ecosort/prepare_data.py` recorre las 12 clases y genera:
   - `train.csv`
   - `val.csv`
   - `test.csv`
   - `summary.json`
3. Cada muestra obtiene:
   - ruta de imagen,
   - etiqueta,
   - texto sintetico tipo usuario.
4. `train.py` tokeniza el texto, procesa la imagen y entrena una red multimodal PyTorch.
5. `keras_train.py` ofrece una ruta alternativa que exporta `best_model.keras` cuando hay TensorFlow disponible.
6. `backend/app/service.py` usa `.keras`, checkpoint PyTorch o modo heuristico, segun los artefactos disponibles.
6. La app móvil envía foto + nota y recibe:
   - clase,
   - confianza,
   - reciclabilidad,
   - pasos de desecho.

## Modelo propuesto

- Encoder visual: `MobileNetV3 Small`
- Encoder textual: `Embedding + BiGRU`
- Fusion: concatenacion tardia
- Salida: clasificacion de 12 clases
- Artefactos: `best_model.pt` para PyTorch y `best_model.keras` para la ruta TensorFlow/Keras.

## Reglas de negocio

El modelo predice la clase principal del residuo. Luego, `rules.py` ajusta la recomendacion final con base en palabras clave del texto del usuario:

- `tenia comida`, `grasoso`, `sucio`: reducen reciclabilidad de papel/carton y exigen limpieza en plastico, vidrio y metal.
- `producto de limpieza`, `quimico`: agregan precaucion.
- `roto`, `quebrado`: activan manejo especial para vidrio.
- `todavia sirve`, `se puede donar`: priorizan reuso para ropa y zapatos.

## Por que esta arquitectura sirve para el curso

- Cumple multimodalidad real.
- Es explicable en clase sin entrar en detalles excesivos.
- Es razonable para celular y backend ligero.
- Permite demo funcional aunque aun no exista APK final.
