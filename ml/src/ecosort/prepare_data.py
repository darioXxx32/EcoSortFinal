from __future__ import annotations

import argparse
import hashlib
import json
import random
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

from .catalog import get_label_info, get_label_names, load_catalog
from .config import ANNOTATIONS_ROOT, DATASET_ROOT, DataConfig


GENERIC_CONDITIONS = {
    "clean": ["esta limpio", "esta vacio", "esta seco", "sin restos"],
    "dirty": ["esta sucio", "tenia comida", "tiene restos", "tiene grasa", "esta pegajoso"],
    "chemical": ["venia de un producto de limpieza", "tenia quimicos", "contenia detergente", "olía a cloro"],
    "usable": ["todavia sirve", "aun se puede usar", "sirve para donar", "esta en buen estado"],
}

CLASS_SPECIFIC_TEXTS = {
    "plastic": [
        "de agua que compre",
        "agua que compre botella plastica",
        "botellas de agua compradas",
        "agua embotellada en envase PET",
        "botella de agua vacia",
        "botella PET limpia de agua",
        "envase plastico de agua",
        "botella transparente con tapa azul",
        "botella de agua aplastada",
        "botellas plasticas reciclables",
    ],
    "paper": [
        "hojas de escuela escritas",
        "documentos con mi nombre y datos",
        "papel de oficina limpio",
        "cuaderno usado con hojas",
        "papeles escritos para reciclar",
    ],
    "cardboard": [
        "caja de envio seca",
        "carton limpio y seco",
        "carton de pizza con grasa",
        "caja aplastada para reciclaje",
        "caja de jugo tetrapak vacia",
        "envase de jugo de carton",
    ],
    "clothes": [
        "ropa que ya no me queda",
        "ropa en buen estado para donar",
        "ropa para vender de segunda mano",
        "prenda rota pero reparable",
    ],
    "shoes": [
        "zapatos usados en buen estado",
        "zapatos para vender de segunda mano",
        "tenis que ya no me quedan",
        "zapatos rotos para reparar",
    ],
    "battery": [
        "pila usada de control remoto",
        "bateria hinchada de celular",
        "power bank usado",
        "pila descargada para punto limpio",
        "son de un control antiguo",
        "pilas de un control antiguo",
        "baterias de un control remoto",
        "salieron de un control viejo",
        "pilas del mando remoto",
        "pila de control de tv",
    ],
    "biological": [
        "cascara de fruta para compost",
        "borra de cafe para abono",
        "restos de comida organicos",
        "cascara de naranja para compost del jardin",
        "sobras vegetales para hacer composta",
        "restos de ensalada para compostaje",
        "hojas secas para abono",
        "residuos de la cena del dia anterior",
        "restos de la cena para compost",
        "sobras de comida de ayer",
        "desperdicios de comida de cocina",
        "restos del almuerzo para organicos",
        "sobras de arroz y verduras",
        "residuos de cocina biodegradables",
    ],
    "metal": [
        "lata de aluminio limpia",
        "lata vacia filosa",
        "lata de atun vacia",
        "tapa metalica reciclable",
        "lata de jugo vacia",
        "jugo en lata de aluminio",
        "bebida en lata recien comprada",
    ],
    "white-glass": [
        "frasco de vidrio limpio",
        "frasco vacio para guardar",
        "botella de vidrio transparente",
        "vidrio roto con cuidado",
    ],
    "green-glass": [
        "botella verde vacia",
        "vidrio verde limpio",
    ],
    "brown-glass": [
        "botella cafe vacia",
        "frasco ambar limpio",
    ],
    "trash": [
        "mascarilla usada",
        "servilleta usada con comida",
        "papel con grasa",
        "empaque sucio no reciclable",
        "panal usado de bebe",
        "panales de mi hijo que ya no uso",
        "panal sanitario en bolsa cerrada",
        "residuo sanitario no reciclable",
        "papel higienico usado",
        "toalla sanitaria usada",
    ],
}


def build_synthetic_text(label_name: str, image_path: Path, seed: int = 42, variant: int = 0) -> str:
    label_info = get_label_info(label_name)
    fingerprint_source = f"{image_path}:{variant}"
    fingerprint = int(hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest(), 16) % (10**8)
    rng = random.Random(seed + fingerprint)
    object_name = rng.choice(label_info["common_objects"])
    label_hint = rng.choice(label_info["text_hints"])

    if label_name in {"paper", "cardboard"}:
        condition_pool = GENERIC_CONDITIONS["clean"] + GENERIC_CONDITIONS["dirty"]
    elif label_name in {"plastic", "metal", "brown-glass", "green-glass", "white-glass"}:
        condition_pool = GENERIC_CONDITIONS["clean"] + GENERIC_CONDITIONS["dirty"] + GENERIC_CONDITIONS["chemical"]
    elif label_name in {"clothes", "shoes"}:
        condition_pool = GENERIC_CONDITIONS["usable"] + ["esta desgastado", "esta usado", "esta limpio"]
    elif label_name == "battery":
        condition_pool = ["esta descargada", "es una bateria usada", "salio de un dispositivo"]
    elif label_name == "biological":
        condition_pool = ["es residuo de cocina", "viene de comida", "es organico"]
    else:
        condition_pool = GENERIC_CONDITIONS["dirty"] + ["es basura comun", "esta mezclado"]

    condition = rng.choice(condition_pool)
    templates = [
        "parece {object_name}, {label_hint}, {condition}",
        "creo que es {object_name} y {condition}",
        "{label_hint}, parece {object_name}",
        "es {object_name}, {condition}",
        "tengo {object_name}; {condition}",
        "{object_name} de casa, {label_hint}",
        "foto de {object_name}, {condition}, {label_hint}",
    ]
    template = rng.choice(templates)
    return template.format(object_name=object_name, label_hint=label_hint, condition=condition)


def scan_dataset(dataset_root: Path, text_variants: int = 3, seed: int = 42) -> pd.DataFrame:
    catalog = load_catalog()
    allowed_labels = set(get_label_names(catalog))
    rows: list[dict[str, object]] = []

    for label_dir in sorted(path for path in dataset_root.iterdir() if path.is_dir()):
        if label_dir.name not in allowed_labels:
            continue
        for image_path in sorted(label_dir.glob("*")):
            if image_path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
                continue
            for variant in range(max(text_variants, 1)):
                rows.append(
                    {
                        "image_path": str(image_path.resolve()),
                        "label": label_dir.name,
                        "text": build_synthetic_text(label_dir.name, image_path, seed=seed, variant=variant),
                        "relative_path": str(image_path.relative_to(dataset_root)),
                        "text_variant": variant,
                    }
                )
            for offset, text in enumerate(CLASS_SPECIFIC_TEXTS.get(label_dir.name, []), start=max(text_variants, 1)):
                rows.append(
                    {
                        "image_path": str(image_path.resolve()),
                        "label": label_dir.name,
                        "text": text,
                        "relative_path": str(image_path.relative_to(dataset_root)),
                        "text_variant": offset,
                    }
                )

    if not rows:
        raise FileNotFoundError(f"No se encontraron imagenes en {dataset_root}")

    return pd.DataFrame(rows)


def split_dataframe(df: pd.DataFrame, config: DataConfig) -> dict[str, pd.DataFrame]:
    image_index = df[["image_path", "label", "relative_path"]].drop_duplicates("image_path")
    train_df, test_df = train_test_split(
        image_index,
        test_size=config.test_ratio,
        stratify=image_index["label"],
        random_state=config.random_seed,
    )
    adjusted_val_ratio = config.val_ratio / (config.train_ratio + config.val_ratio)
    train_df, val_df = train_test_split(
        train_df,
        test_size=adjusted_val_ratio,
        stratify=train_df["label"],
        random_state=config.random_seed,
    )

    def expand_variants(image_split: pd.DataFrame) -> pd.DataFrame:
        return df[df["image_path"].isin(set(image_split["image_path"]))].copy()

    return {
        "train": expand_variants(train_df),
        "val": expand_variants(val_df),
        "test": expand_variants(test_df),
    }


def export_splits(splits: dict[str, pd.DataFrame], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for split_name, split_df in splits.items():
        split_df.sort_values(["label", "relative_path"]).to_csv(output_dir / f"{split_name}.csv", index=False)

    summary = {
        split_name: split_df["label"].value_counts().sort_index().to_dict()
        for split_name, split_df in splits.items()
    }
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera anotaciones multimodales para EcoSort.")
    parser.add_argument("--dataset-root", type=Path, default=DATASET_ROOT)
    parser.add_argument("--output-dir", type=Path, default=ANNOTATIONS_ROOT)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--text-variants", type=int, default=3)
    args = parser.parse_args()

    config = DataConfig(random_seed=args.seed)
    dataframe = scan_dataset(args.dataset_root, text_variants=args.text_variants, seed=args.seed)
    splits = split_dataframe(dataframe, config)
    export_splits(splits, args.output_dir)
    print(f"Anotaciones exportadas a: {args.output_dir}")
    print(dataframe["label"].value_counts().sort_index().to_string())


if __name__ == "__main__":
    main()
