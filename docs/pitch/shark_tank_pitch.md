# EcoSort Shark Tank Pitch Script

Duracion objetivo: 13 a 15 minutos  
Presentador: Dario Pomasqui  
Universidad: Yachay Tech University  
Materia: Neural Networks and Deep Learning

## 1. Strong Opening

Tiempo sugerido: 1 minuto

Slide: `EcoSort`

Lo que debo decir:

Buenas tardes. Mi nombre es Dario Pomasqui y hoy presento EcoSort: una aplicacion que ayuda a decidir que hacer con un residuo usando inteligencia artificial multimodal.

El eslogan de EcoSort es: "Your waste, in the right place."

La idea nace de un problema muy comun: muchas personas quieren reciclar, pero en el momento real de botar algo no estan seguras. Una decision de segundos puede contaminar una bolsa completa de reciclaje. Por ejemplo, una caja con grasa, una pila o un envase con quimicos no se deben tratar igual que una botella limpia.

EcoSort convierte esa duda en una accion clara. El usuario toma una foto, escribe una descripcion breve, y la app le dice si debe reciclar, limpiar, donar, compostar o llevar el residuo a un punto especial.

Transicion:

Para entender por que esta solucion importa, primero veamos el problema.

## 2. What Problem Does It Solve?

Tiempo sugerido: 2 minutos

Slide: `What Problem Does It Solve?`

Lo que debo decir:

El problema no es solamente que la gente no recicle. El problema es que muchas veces no sabe como hacerlo correctamente.

Un usuario puede tener una caja de jugo, pilas viejas o restos de comida. A simple vista parece una decision pequena, pero el manejo correcto cambia segun el material, el estado del residuo y el contexto.

EcoSort esta pensado para usuarios reales: hogares, campus universitarios, escuelas y tambien espacios donde se generan muchos residuos mezclados, como cafeterias o aulas.

En un hogar, el usuario necesita una guia rapida. En un campus, una mala separacion puede llenar contenedores con residuos contaminados. Para una ciudad o comunidad, esos errores aumentan el costo de gestion y reducen el valor ambiental del reciclaje.

Por eso EcoSort no quiere ser una enciclopedia larga. Quiere responder una pregunta concreta: "Tengo esto en la mano, que hago ahora?"

Transicion:

Con ese problema claro, la solucion debe ser simple para el usuario, pero inteligente por dentro.

## 3. The Solution

Tiempo sugerido: 2 minutos

Slide: `The Solution`

Lo que debo decir:

EcoSort funciona con una experiencia muy directa.

Primero, el usuario toma una foto o escoge una imagen del residuo. Segundo, escribe una descripcion corta, por ejemplo: "es de una cena de ayer", "venia con aceite", "esta limpio", o "son pilas de un control antiguo". Tercero, la aplicacion entrega un plan de accion.

La diferencia importante es que EcoSort no solo clasifica el objeto. No se queda en decir "papel", "plastico" o "metal". La app intenta responder con una recomendacion util: si hay que limpiarlo, si se puede reciclar, si debe donarse, si conviene compostar o si debe ir a un punto especial.

Esto hace que EcoSort sea mas practico que una lista tradicional de materiales. La foto ayuda a reconocer el residuo y el texto ayuda a entender detalles que la imagen no siempre muestra: si esta sucio, si tuvo quimicos, si es sanitario o si todavia puede reutilizarse.

Transicion:

Ahora veamos como se veria una demostracion funcional.

## 4. Functional Demo

Tiempo sugerido: 2 a 3 minutos

Slide: `Functional Demo`

Lo que debo decir:

En la demostracion, puedo usar dos casos rapidos para mostrar por que la app es multimodal.

Primer caso: tomo una foto de pilas AA. Si solo se mira la imagen, el modelo puede confundirse con objetos cilindricos o metalicos. Pero cuando el usuario agrega una frase como "son de un control antiguo", el sistema entiende mejor que se trata de baterias y recomienda un punto especial, no reciclaje comun.

Segundo caso: tomo una foto de restos de comida. Si el usuario escribe "son de la cena de ayer", EcoSort no espera que el usuario diga "esto es compost". La app debe inferirlo. Por eso recomienda organicos o compostaje.

En vivo, el flujo seria:

1. Abrir EcoSort.
2. Tomar una foto o elegir una imagen.
3. Escribir una descripcion breve.
4. Presionar Analyze.
5. Mostrar el resultado, la confianza y las acciones recomendadas.

Lo importante de la demo es que el usuario no necesita saber terminos tecnicos. Solo debe contar lo que ve o lo que sabe del residuo.

Transicion:

Ahora explico como funciona por dentro sin entrar en codigo.

## 5. How It Works Inside

Tiempo sugerido: 2 minutos

Slide: `How It Works Inside`

Lo que debo decir:

EcoSort usa inteligencia artificial multimodal. Eso significa que no depende de una sola entrada, sino de dos fuentes de informacion: imagen y texto.

La parte visual observa la foto del residuo y busca patrones: forma, color, textura y apariencia general del objeto. Esta parte ayuda a reconocer materiales como carton, vidrio, plastico, baterias, textiles u organicos.

La parte textual lee la descripcion del usuario. Esa descripcion puede cambiar completamente la decision. Una botella limpia no se maneja igual que una botella con quimicos. Un papel seco no se maneja igual que un papel mojado o con grasa. Una prenda en buen estado no deberia ir directamente a la basura si puede donarse.

Despues, el sistema fusiona ambas entradas. La red neuronal propone una categoria, y una capa semantica refuerza el contexto para convertir la prediccion en una accion ambiental.

La idea no es mostrarle al usuario una salida tecnica. La idea es que el sistema diga: "haz esto", de forma clara.

Transicion:

Aunque la explicacion para el usuario es simple, el proyecto tiene una arquitectura tecnica solida.

## 6. Technical Strength

Tiempo sugerido: 2 minutos

Slide: `Technical Strength`

Lo que debo decir:

La arquitectura usa dos ramas principales.

Para la imagen, se usa una red convolucional ligera basada en MobileNetV3 Small. Esta decision tiene sentido porque el proyecto apunta a una aplicacion movil: necesitamos una red capaz de reconocer patrones visuales, pero sin ser innecesariamente pesada.

Para el texto, se usa una representacion de palabras con una red recurrente bidireccional. Esto permite interpretar frases cortas de usuario, que son precisamente el tipo de descripcion que se espera en la app.

Luego se aplica fusion tardia: primero cada modalidad extrae sus caracteristicas, y despues se combinan para tomar una decision final. Esta estrategia es clara, eficiente y explicable.

Finalmente, la capa semantica convierte la clase detectada en una recomendacion concreta. Eso es clave porque el valor del producto no es solo predecir una etiqueta, sino ayudar a actuar correctamente.

Transicion:

Ahora pasemos a los resultados y a la validacion.

## 7. Results and Validation

Tiempo sugerido: 1 a 2 minutos

Slide: `Results and Validation`

Lo que debo decir:

Para evaluar el modelo se usaron metricas comunes en clasificacion: accuracy, macro F1 y weighted F1.

El modelo alcanzo aproximadamente 86.66% de accuracy, 83.80% de macro F1 y 86.67% de weighted F1. Estas metricas muestran que el sistema tiene un desempeno solido considerando que trabaja con multiples categorias de residuos.

Pero tambien hicimos una validacion funcional mas cercana al uso real. Probamos 13 escenarios naturales, sin escribir directamente frases como "para reciclar", "para compost" o "punto limpio". La idea era comprobar si EcoSort podia inferir la recomendacion a partir de una imagen y una descripcion normal.

En esa prueba funcional, la app respondio correctamente en los 13 escenarios. Esto refuerza el punto central del proyecto: EcoSort no depende de que el usuario ya conozca la respuesta. La app debe ayudar a descubrirla.

Transicion:

Mas alla de los numeros, este proceso nos dejo aprendizajes importantes.

## 8. What We Learned

Tiempo sugerido: 1 minuto

Slide: `What We Learned`

Lo que debo decir:

El primer aprendizaje es que la vision sola no basta. La imagen puede mostrar el objeto, pero no siempre muestra si esta limpio, contaminado, usado, sanitario o reutilizable.

El segundo aprendizaje es que la combinacion de IA y reglas semanticas es mas util para una app de residuos. Una etiqueta por si sola no siempre ayuda al usuario; una accion concreta si.

El tercer aprendizaje es que el usuario necesita claridad. Si la app muestra demasiada informacion tecnica, pierde impacto. Por eso se priorizaron frases cortas, pasos concretos y alertas simples.

Transicion:

Con esto llegamos a la propuesta de valor.

## 9. Value Proposition

Tiempo sugerido: 1 minuto

Slide: `Value Proposition`

Lo que debo decir:

La propuesta de valor de EcoSort es convertir confusion en accion ambiental.

Como producto, combina foto, texto y plan de accion. Como impacto, ayuda a reducir errores de separacion y contaminacion de residuos reciclables. Como innovacion, usa inteligencia artificial multimodal con una capa semantica orientada a decisiones reales. Como escala, puede aplicarse en hogares, campus universitarios, escuelas y programas comunitarios.

EcoSort no compite por ser una app complicada. Su fortaleza es ser simple por fuera e inteligente por dentro.

Para un usuario, eso significa menos duda. Para una institucion, significa mejores habitos. Para el ambiente, significa menos residuos mal gestionados.

Transicion:

Y cierro con la idea principal del proyecto.

## 10. Closing Statement

Tiempo sugerido: 1 minuto

Slide: `EcoSort`

Lo que debo decir:

EcoSort parte de una idea sencilla: reciclar mejor no deberia depender de memorizar reglas complicadas.

Si una persona ya tiene el residuo en la mano, ese es el momento perfecto para ayudarla. EcoSort usa imagen y texto para convertir una duda cotidiana en una decision ambiental clara.

No se trata solo de botar menos. Se trata de decidir mejor.

Por eso, si buscamos una app con impacto social, valor educativo y una base tecnica real en redes neuronales multimodales, EcoSort es una solucion lista para demostrar, mejorar y escalar.

Frase final:

EcoSort: your waste, in the right place. The planet does not need perfect users; it needs better decisions at the right moment.

