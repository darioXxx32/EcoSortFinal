# Expansion futura del dataset

Si el equipo quiere ampliar EcoSort despues de asegurar la demo actual, estas son tres fuentes publicas utiles:

## 1. RealWaste

- Fuente: UCI Machine Learning Repository
- Enlace: https://archive.ics.uci.edu/dataset/908/realwaste
- Valor: residuos fotografiados en condiciones mas reales que un fondo limpio

## 2. TACO

- Fuente: repositorio oficial en GitHub
- Enlace: https://github.com/pedropro/TACO
- Valor: basura en contexto real y muchas categorias de litter

## 3. TrashNet++

- Fuente: Mendeley Data
- Enlace: https://data.mendeley.com/datasets/mr67c82zw7
- Valor: extension moderna orientada a reconocimiento multi clase

## Recomendacion

Primero conviene consolidar EcoSort con las 12 clases base y la capa hibrida actual. Luego pueden crear una v2 del proyecto con:

- mas clases visuales entrenadas,
- un mapeo comun de etiquetas,
- y reentrenamiento con backbone preentrenado.
