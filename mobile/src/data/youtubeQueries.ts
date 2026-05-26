export interface YouTubeSuggestion {
  title: string;
  query: string;
}

export const YOUTUBE_QUERIES: Record<string, YouTubeSuggestion[]> = {
  plastic: [
    { title: "Reciclar plastico sin contaminar", query: "como reciclar plastico limpio en casa" },
    { title: "Botellas PET: que hacer", query: "botellas PET reciclaje que hacer" },
    { title: "Reducir plastico diario", query: "ideas para reducir plastico en casa" },
  ],
  paper: [
    { title: "Papel limpio vs papel contaminado", query: "papel limpio papel sucio reciclaje" },
    { title: "Hacer papel reciclado", query: "como hacer papel reciclado artesanal paso a paso" },
    { title: "Proteger datos antes de reciclar", query: "como destruir documentos personales antes de reciclar" },
  ],
  cardboard: [
    { title: "Carton seco y reciclaje", query: "como reciclar carton seco correctamente" },
    { title: "Carton con grasa: que hacer", query: "carton con grasa se recicla o basura" },
    { title: "Reutilizar cajas", query: "ideas para reutilizar cajas de carton" },
  ],
  metal: [
    { title: "Latas de aluminio", query: "reciclaje de latas de aluminio paso a paso" },
    { title: "Como limpiar una lata", query: "como separar latas para reciclaje" },
    { title: "Por que reciclar metal", query: "beneficios de reciclar aluminio" },
  ],
  "white-glass": [
    { title: "Vidrio limpio y seguro", query: "como reciclar frascos de vidrio limpios" },
    { title: "Reutilizar frascos", query: "ideas para reutilizar frascos de vidrio" },
  ],
  "green-glass": [
    { title: "Vidrio verde", query: "reciclaje de vidrio verde como separar" },
    { title: "Botellas de vidrio", query: "como reciclar botellas de vidrio correctamente" },
  ],
  "brown-glass": [
    { title: "Vidrio ambar", query: "reciclaje de vidrio ambar" },
    { title: "Frascos de medicina", query: "como desechar frascos de medicina vacios" },
  ],
  battery: [
    { title: "Pilas y baterias", query: "como desechar pilas y baterias correctamente" },
    { title: "Riesgos ambientales", query: "por que las pilas contaminan el ambiente" },
    { title: "Punto limpio", query: "punto limpio pilas baterias cerca de mi" },
  ],
  biological: [
    { title: "Composta en casa", query: "hacer composta en casa facil para principiantes" },
    { title: "Que poner en la composta", query: "que residuos organicos van en la composta" },
    { title: "Que NO poner en compost", query: "que no poner en la composta errores comunes" },
    { title: "Lombricomposta", query: "lombricomposta casera paso a paso" },
  ],
  clothes: [
    { title: "Donar ropa correctamente", query: "como donar ropa usada correctamente" },
    { title: "Reparar ropa", query: "reparar ropa costura basica principiantes" },
    { title: "Reciclaje textil", query: "reciclaje textil ropa usada" },
  ],
  shoes: [
    { title: "Donar calzado", query: "donde donar zapatos usados en buen estado" },
    { title: "Reparar zapatos", query: "como reparar zapatos usados" },
    { title: "Reciclaje de calzado", query: "reciclar zapatos usados" },
  ],
  trash: [
    { title: "Reducir no reciclables", query: "como reducir residuos no reciclables" },
    { title: "Residuos sanitarios", query: "como desechar residuos sanitarios correctamente" },
    { title: "Separacion segura", query: "separar residuos comunes y reciclables correctamente" },
  ],
};

export const KEYWORD_QUERIES: Record<string, YouTubeSuggestion[]> = {
  compost: [
    { title: "Composta en casa", query: "hacer composta en casa facil" },
    { title: "Compostaje para principiantes", query: "compostaje para principiantes paso a paso" },
    { title: "Errores comunes", query: "errores comunes al hacer compost" },
  ],
  sanitario: [
    { title: "Residuos sanitarios", query: "como desechar residuos sanitarios en casa" },
    { title: "Panales y basura comun", query: "como desechar panales usados correctamente" },
    { title: "Higiene al separar residuos", query: "higiene al separar basura reciclaje en casa" },
  ],
  bebida: [
    { title: "Envases de bebidas", query: "como reciclar envases de bebidas lata botella carton" },
    { title: "Latas vs botellas", query: "reciclaje latas aluminio botellas plastico" },
    { title: "Tetrapak", query: "como reciclar envases tetrapak" },
  ],
  donar: [
    { title: "Donar ropa y objetos", query: "donar ropa y objetos donde llevarlos" },
    { title: "Preparar donaciones", query: "como preparar ropa para donar" },
    { title: "Segunda mano", query: "beneficios de comprar y vender segunda mano" },
  ],
  reparar: [
    { title: "Reparar antes de botar", query: "reparar objetos antes de tirar zero waste" },
    { title: "Costura basica", query: "reparar ropa costura basica principiantes" },
    { title: "Arreglar zapatos", query: "reparar zapatos en casa" },
  ],
  reciclar: [
    { title: "Separar residuos", query: "separar residuos correctamente reciclaje" },
    { title: "Contenedores por color", query: "tipos de contenedores reciclaje colores" },
    { title: "Reciclaje limpio", query: "como evitar contaminar reciclaje" },
  ],
};

export function getYouTubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function getSuggestionsForLabel(labelKey: string): YouTubeSuggestion[] {
  return YOUTUBE_QUERIES[labelKey] ?? YOUTUBE_QUERIES.trash;
}

export function getSearchSuggestions(text: string): YouTubeSuggestion[] {
  const lower = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (lower.includes("compost") || lower.includes("organico") || lower.includes("cascara") || lower.includes("fruta") || lower.includes("comida")) {
    return KEYWORD_QUERIES.compost;
  }
  if (lower.includes("panal") || lower.includes("sanitario") || lower.includes("mascarilla") || lower.includes("higienico")) {
    return KEYWORD_QUERIES.sanitario;
  }
  if (lower.includes("jugo") || lower.includes("bebida") || lower.includes("gaseosa") || lower.includes("lata") || lower.includes("botella")) {
    return KEYWORD_QUERIES.bebida;
  }
  if (lower.includes("donar") || lower.includes("ropa") || lower.includes("zapatos") || lower.includes("textil")) {
    return KEYWORD_QUERIES.donar;
  }
  if (lower.includes("repar") || lower.includes("arreglar") || lower.includes("rot") || lower.includes("dan")) {
    return KEYWORD_QUERIES.reparar;
  }
  if (lower.includes("recicl") || lower.includes("separ") || lower.includes("contenedor")) {
    return KEYWORD_QUERIES.reciclar;
  }

  return [];
}
