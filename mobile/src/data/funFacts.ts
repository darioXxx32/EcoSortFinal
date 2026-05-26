export const funFacts: string[] = [
  "Una botella PET puede tardar siglos en degradarse si termina en la naturaleza.",
  "Una lata de aluminio se recicla muchas veces si llega limpia y vacia.",
  "El papel limpio se recupera mejor cuando no se mezcla con grasa o humedad.",
  "El vidrio de envases puede reciclarse sin perder calidad del material.",
  "Las pilas y baterias nunca deben ir al reciclaje domestico.",
  "Los residuos organicos suelen ser una gran parte de la basura del hogar.",
  "La composta convierte restos vegetales en abono util para plantas.",
  "Un panal usado no va a compost ni reciclaje: debe cerrarse y desecharse como sanitario.",
  "Separar una servilleta grasosa evita contaminar papel reciclable limpio.",
  "Donar ropa util suele ahorrar mas impacto que reciclarla como textil.",
  "Aplastar cajas secas ayuda a ahorrar espacio en el reciclaje.",
  "Un envase vacio y enjuagado tiene mas probabilidad de ser aceptado.",
  "Los residuos con quimicos requieren revisar puntos limpios o manejo especial.",
  "Separar correctamente aumenta la calidad del material recuperado.",
  "Reusar frascos y cajas alarga su vida antes de reciclarlos.",
];

let lastIndex = -1;

export function getRandomFact(): string {
  let index: number;
  do {
    index = Math.floor(Math.random() * funFacts.length);
  } while (index === lastIndex && funFacts.length > 1);
  lastIndex = index;
  return funFacts[index];
}
