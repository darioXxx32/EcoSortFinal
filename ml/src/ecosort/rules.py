from __future__ import annotations

import re
import unicodedata
from typing import Any

from .catalog import get_keyword_groups, get_label_info, load_catalog


def normalize_text(text: str) -> str:
    text = (text or "").strip().lower()
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    # Expand everyday descriptions into material tokens already learned by the model.
    expansions: list[str] = []
    has_water = re.search(r"\bagua\b", text) is not None
    water_purchase_context = any(
        phrase in text
        for phrase in [
            "agua que compre",
            "compre agua",
            "agua comprada",
            "agua embotellada",
            "botella de agua",
            "botellas de agua",
            "envase de agua",
            "de agua que compre",
        ]
    )
    if has_water and water_purchase_context:
        expansions.append("botella plastica pet envase plastico")

    apparel_terms = [
        "ropa",
        "prenda",
        "camisa",
        "camiseta",
        "pantalon",
        "chaqueta",
        "uniforme",
        "zapato",
        "zapatos",
        "tenis",
        "calzado",
        "medias",
        "calcetines",
    ]
    sanitary_context = any(
        phrase in text
        for phrase in [
            "panal",
            "panales",
            "panal usado",
            "panales usados",
            "residuo sanitario",
            "papel higienico usado",
            "toalla sanitaria",
            "mascarilla usada",
        ]
    )
    baby_care_context = any(
        phrase in text
        for phrase in [
            "mi hijo",
            "mi hija",
            "bebe",
            "bebes",
            "nino pequeno",
            "nina pequena",
        ]
    ) and any(
        phrase in text
        for phrase in [
            "no los uso",
            "no lo uso",
            "no las uso",
            "ya no los uso",
            "ya no lo uso",
            "estan limpios",
            "estan sin usar",
            "limpios",
            "sin usar",
        ]
    )
    sanitary_context = sanitary_context or baby_care_context
    if sanitary_context:
        expansions.append("panal sanitario basura comun usado no reciclable")

    apparel_fit_context = any(
        phrase in text
        for phrase in [
            "ya no me queda",
            "no me queda",
            "me queda pequeno",
            "me queda pequena",
            "me queda chico",
            "me queda chica",
            "me queda grande",
            "ya no lo uso",
            "ya no la uso",
            "ya no uso",
        ]
    )
    if apparel_fit_context and any(term in text for term in apparel_terms):
        expansions.append("ropa prenda calzado zapatos donar buen estado reutilizar")

    beverage_context = any(
        phrase in text
        for phrase in [
            "jugo",
            "bebida",
            "gaseosa",
            "refresco",
            "soda",
            "energizante",
        ]
    )
    if beverage_context:
        expansions.append("bebida envase botella plastico lata aluminio")

    remote_control_context = any(
        phrase in text
        for phrase in [
            "control remoto",
            "control antiguo",
            "control viejo",
            "control de tv",
            "control del televisor",
            "mando remoto",
            "mando antiguo",
            "de un control",
            "del control",
        ]
    )
    if remote_control_context:
        expansions.append("pila pilas bateria control remoto punto limpio residuo peligroso")

    food_waste_context = any(
        phrase in text
        for phrase in [
            "residuos de la cena",
            "residuo de la cena",
            "restos de la cena",
            "sobras de la cena",
            "sobras de comida",
            "restos del almuerzo",
            "sobras del almuerzo",
            "residuos del almuerzo",
            "comida del dia anterior",
            "cena del dia anterior",
            "comida de ayer",
            "sobras de ayer",
            "restos de cocina",
            "desperdicios de comida",
            "desperdicio de comida",
        ]
    )
    if food_waste_context:
        expansions.append("organico compost comida sobras restos cocina biodegradable")

    if expansions:
        text = f"{text} {' '.join(expansions)}"

    return text


def extract_text_flags(user_text: str, keyword_groups: dict[str, list[str]] | None = None) -> dict[str, bool]:
    normalized = normalize_text(user_text)
    groups = keyword_groups or get_keyword_groups()
    return {
        group_name: any(normalize_text(keyword) in normalized for keyword in keywords)
        for group_name, keywords in groups.items()
    }


def build_disposal_response(label_name: str, user_text: str, confidence: float) -> dict[str, Any]:
    catalog = load_catalog()
    label_info = get_label_info(label_name, catalog)
    flags = extract_text_flags(user_text, catalog["contamination_keywords"])
    recyclable = bool(label_info["recyclable"])
    disposal_steps = [label_info["primary_action"], label_info["secondary_action"]]
    notes: list[str] = [label_info["summary"]]

    if label_name in {"paper", "cardboard"} and (flags["dirty"] or flags["wet"]):
        recyclable = False
        notes.append("Papel y carton con grasa, restos de comida o humedad suelen perder reciclabilidad.")
        disposal_steps[0] = "Si no puedes limpiarlo ni secarlo, desechalo como basura comun o compost segun el residuo."

    if label_name in {"plastic", "metal", "brown-glass", "green-glass", "white-glass"} and flags["dirty"]:
        notes.append("Antes de reciclar, elimina restos visibles de comida o grasa.")
        disposal_steps[0] = f"Primero limpialo o enjuagalo. Luego: {label_info['primary_action'].lower()}"

    if label_name in {"plastic", "brown-glass", "green-glass", "white-glass"} and flags["chemical"]:
        notes.append("Si contenia quimicos o limpiadores, enjuagalo con cuidado antes de reciclarlo.")

    if "glass" in label_name and flags["broken"]:
        recyclable = False
        notes.append("El vidrio roto puede requerir manejo especial para evitar accidentes.")
        disposal_steps[0] = "Envuelvelo en papel grueso o carton antes de desecharlo o llevarlo a un punto seguro."

    if label_name in {"clothes", "shoes"} and flags["reusable"]:
        notes.append("El texto sugiere que aun puede reutilizarse; la mejor opcion es donar o reusar.")
        disposal_steps[0] = "Prioriza donacion, intercambio o reuso antes del reciclaje."

    if label_name == "battery":
        recyclable = False
        notes.append("Las baterias requieren siempre una ruta de disposicion especializada.")

    if label_name == "biological":
        notes.append("Si tu ciudad separa organicos, esta es la mejor ruta de manejo.")

    if label_name == "trash" and flags.get("sanitary", False):
        notes.append("Parece un residuo sanitario o de alto contacto; cierralo bien antes de desecharlo.")
        disposal_steps[0] = "Cierralo en una bolsa o envoltura segura y depositalo en basura comun."

    confidence_band = "alta" if confidence >= 0.8 else "media" if confidence >= 0.55 else "baja"

    return {
        "label_key": label_name,
        "label_display": label_info["display_name"],
        "waste_stream": label_info["waste_stream"],
        "recyclable": recyclable,
        "recyclable_condition": label_info["recyclable_condition"],
        "bin_color": label_info["bin_color"],
        "disposal_steps": disposal_steps,
        "notes": notes,
        "text_flags": flags,
        "confidence": round(float(confidence), 4),
        "confidence_band": confidence_band,
    }
