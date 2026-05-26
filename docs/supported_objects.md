# Objetos soportados por EcoSort

EcoSort mantiene 12 clases base entrenadas, pero la capa hibrida de texto + reglas ahora cubre 562 objetos, descripciones, intenciones, alias y subtipos frecuentes para que la demo se vea mas completa y profesional.

## Cobertura actual

- Papel: papel de oficina, ticket, recibo, factura, sobre, bolsa de papel, cuaderno, servilleta, tissue, papel bond, cartulina, hojas escolares, apuntes, tareas, examenes, fotocopias.
- Carton: caja de carton, caja de cereal, caja de zapatos, huevera, tubo de carton, bandeja de carton, tetrapak.
- Plastico: botella PET, envase de yogurt, tapa plastica, tupper, bolsa plastica, empaque plastico, film, blister, galon.
- Metal: lata de aluminio, lata de atun, tapa metalica, bandeja de aluminio, aerosol, papel aluminio, clips, grapas.
- Vidrio: frasco de mermelada, botella transparente, botella verde, botella ambar, copa de vidrio, botella de perfume, frasco de salsa.
- Organicos: restos de comida, cascara de banana, cascara de huevo, borra de cafe, bolsa de te, flores, poda.
- Textiles: camiseta, jean, sueter, uniforme, toalla, sabana, bufanda, medias, cortina, trapo.
- Calzado: zapatilla, bota, botin, sandalia, pantufla, chancla, crocs, tenis.
- Peligrosos: pila boton, pila de litio, bateria recargable, bateria de celular, bateria de laptop, power bank.
- No reciclables: icopor, envoltura metalizada, esponja usada, cepillo de dientes, mascarilla, colilla, chicle, ceramica rota.

## Nota importante

Estas entidades extras no son nuevas clases visuales entrenadas de punta a punta. Son objetos y subcategorias soportados por la capa semantica para:

- mejorar la precision percibida en demo,
- dar respuestas mas explicables,
- ampliar la cobertura sin romper el pipeline de las 12 clases base.

## Intenciones que cambian la recomendacion

La descripcion textual no solo identifica objetos; tambien cambia la accion recomendada:

- Donacion o segunda mano: `no me queda`, `en buen estado`, `para vender`, `intercambiar`.
- Reparacion: `roto pero sirve`, `arreglar`, `coser`, `cambiar suela`.
- Reuso: `frasco limpio para guardar`, `caja firme`, `envase limpio`.
- Seguridad: `filoso`, `cortante`, `bateria hinchada`, `quimico`.
- Condicion del reciclaje: `vacio`, `lleno`, `mojado`, `con grasa`, `sucio`.
- Privacidad: `documentos con nombre`, `datos personales`, `confidencial`.
- Organicos: `para compost`, `abono`, `jardin`, `huerto`.
