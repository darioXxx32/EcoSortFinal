# Guion Shark Tank - EcoSort

## Apertura

`Cada dia millones de personas quieren reciclar, pero fallan justo en el segundo mas importante: cuando tienen un residuo en la mano y no saben donde botarlo. EcoSort convierte esa duda en una decision correcta en menos de 5 segundos.`

## Problema

- El reciclaje falla en el punto de decision.
- Mucha gente no distingue entre reciclable, organico, textil o peligroso.
- Un envase con restos de comida o quimicos puede contaminar todo un lote reciclable.

## Solucion

- El usuario toma una foto del residuo.
- Escribe una pista corta como `tenia comida` o `venia de un producto de limpieza`.
- EcoSort devuelve:
  - tipo de residuo,
  - si es reciclable o no,
  - como desecharlo,
  - si conviene reutilizar, donar, reparar, compostar o llevar a punto limpio,
  - nivel de confianza.

## Propuesta de valor

- Reduce errores cotidianos de separacion.
- Educa mientras el usuario actua.
- Tiene impacto ambiental visible y facil de vender.
- Es una app que cualquier persona puede entender en segundos.

## Explicacion no tecnica de la IA

`Nuestra IA mira la foto para reconocer de que material parece el objeto, y al mismo tiempo lee la descripcion del usuario para entender el contexto y la intencion. No es lo mismo una botella plastica limpia, una botella llena de quimico, o ropa que ya no le queda a alguien pero aun sirve. EcoSort combina ambas modalidades para pasar de clasificar basura a recomendar la mejor accion.`

## Demo sugerida

Caso 1:
- Foto: botella plastica.
- Texto: `tenia gaseosa y esta limpio`.
- Salida esperada: `Plastico`, reciclable, enjuagar y llevar a reciclaje seco.

Caso 2:
- Foto: caja de pizza.
- Texto: `tenia comida y esta grasosa`.
- Salida esperada: carton, no reciclable por contaminacion.

Caso 3:
- Foto: bateria usada.
- Texto: `salio de un control remoto`.
- Salida esperada: residuo peligroso, llevar a punto especial.

Caso 4:
- Foto: ropa.
- Texto: `ropa que ya no me queda y esta en buen estado`.
- Salida esperada: textil, priorizar donacion, venta de segunda mano o reuso antes de reciclar.

Caso 5:
- Foto: frasco de vidrio.
- Texto: `frasco vacio limpio para guardar`.
- Salida esperada: vidrio, sugerir reuso antes del reciclaje.

## Cierre

`EcoSort no solo clasifica basura. Convierte confusion en accion ambiental inteligente. Si queremos ciudades mas limpias, el primer paso es ayudar a las personas a decidir bien. EcoSort pone esa decision en su bolsillo.`
