from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any
import re

import numpy as np
from PIL import Image


LABEL_FAMILIES = {
    "battery": "Peligrosos y electronicos",
    "biological": "Organicos",
    "brown-glass": "Vidrios",
    "cardboard": "Papel y carton",
    "clothes": "Textiles",
    "green-glass": "Vidrios",
    "metal": "Metales",
    "paper": "Papel y carton",
    "plastic": "Plasticos",
    "shoes": "Textiles y calzado",
    "trash": "Basura comun",
    "white-glass": "Vidrios",
}

GLASS_LABELS = {"white-glass", "green-glass", "brown-glass"}

DEFAULT_ITEMS = {
    "battery": "Bateria o pila",
    "biological": "Residuo organico",
    "brown-glass": "Vidrio cafe",
    "cardboard": "Carton",
    "clothes": "Ropa",
    "green-glass": "Vidrio verde",
    "metal": "Metal",
    "paper": "Papel",
    "plastic": "Plastico",
    "shoes": "Zapatos",
    "trash": "Basura comun",
    "white-glass": "Frasco o envase de vidrio",
}

INTENT_PATTERNS: dict[str, list[str]] = {
    "donation": [
        "no me queda",
        "ya no me queda",
        "me queda pequeno",
        "me queda chica",
        "me queda chico",
        "me queda grande",
        "no uso",
        "ya no uso",
        "ya no lo uso",
        "ya no la uso",
        "para donar",
        "donar",
        "donacion",
        "regalar",
        "regalo",
        "en buen estado",
        "buen estado",
        "todavia sirve",
        "aun sirve",
        "aun se puede usar",
        "sirve",
        "utilizable",
    ],
    "repair": [
        "reparar",
        "arreglar",
        "coser",
        "remendar",
        "pegar",
        "cambiar cierre",
        "cambiar suela",
        "rota pero sirve",
        "roto pero sirve",
    ],
    "damaged": [
        "roto",
        "rota",
        "quebrado",
        "quebrada",
        "partido",
        "partida",
        "danado",
        "danada",
        "dañado",
        "dañada",
        "gastado",
        "gastada",
        "desgastado",
        "desgastada",
        "sin suela",
        "rasgado",
        "rasgada",
    ],
    "dirty": [
        "sucio",
        "sucia",
        "manchado",
        "manchada",
        "con tierra",
        "con polvo",
        "con restos",
        "con comida",
        "olor",
        "mal olor",
    ],
    "wet": ["mojado", "mojada", "humedo", "humeda", "empapado", "empapada"],
    "greasy": ["grasa", "grasoso", "grasosa", "aceite", "aceitoso", "aceitosa"],
    "personal_data": [
        "nombre",
        "nombres",
        "datos",
        "privado",
        "privada",
        "documento personal",
        "informacion personal",
        "calificaciones",
        "notas privadas",
    ],
    "hazardous": [
        "peligroso",
        "peligrosa",
        "quimico",
        "quimica",
        "cloro",
        "pintura",
        "solvente",
        "bateria hinchada",
        "inflamada",
        "oxidado",
        "oxidada",
    ],
    "sanitary": [
        "panal",
        "panales",
        "panal usado",
        "panales usados",
        "panal de bebe",
        "panales de bebe",
        "residuo sanitario",
        "papel higienico usado",
        "toalla sanitaria",
        "tampon",
        "curita",
        "mascarilla usada",
        "tapabocas usado",
        "guante quirurgico",
        "hisopo",
    ],
    "baby_care": [
        "mi hijo",
        "mi hija",
        "bebe",
        "bebes",
        "nino pequeno",
        "nina pequena",
    ],
    "sharp": [
        "filoso",
        "filosa",
        "cortante",
        "punzante",
        "con punta",
        "me puedo cortar",
        "vidrio roto",
        "lata cortante",
        "clavo",
        "aguja",
    ],
    "empty": [
        "vacio",
        "vacia",
        "sin liquido",
        "sin contenido",
        "terminado",
        "ya se acabo",
    ],
    "full": [
        "lleno",
        "llena",
        "con liquido",
        "con producto",
        "a medio usar",
        "todavia tiene",
        "le queda",
    ],
    "compost": [
        "compost",
        "compostar",
        "compostaje",
        "abono",
        "huerto",
        "jardin",
        "organico para planta",
    ],
    "resale": [
        "vender",
        "venta",
        "revender",
        "intercambiar",
        "trueque",
        "marketplace",
        "segunda mano",
        "seminuevo",
        "seminueva",
    ],
    "bulk": [
        "muchas",
        "muchos",
        "varios",
        "varias",
        "bolsa llena",
        "caja llena",
        "montones",
        "lote",
        "por kilos",
    ],
    "reuse_container": [
        "guardar",
        "reusar",
        "reutilizar",
        "para guardar",
        "frasco limpio",
        "envase limpio",
        "caja firme",
        "caja buena",
    ],
}

ALIASES: dict[str, list[tuple[str, float, str]]] = {
    "paper": [
        ("papel", 8.0, "Papel"),
        ("hoja", 7.0, "Hoja de papel"),
        ("hojas", 7.0, "Hojas de papel"),
        ("hoja impresa", 7.0, "Hoja impresa"),
        ("papel oficina", 6.5, "Papel de oficina"),
        ("papel de oficina", 6.5, "Papel de oficina"),
        ("cuaderno", 6.5, "Cuaderno"),
        ("libreta", 6.5, "Libreta"),
        ("documento", 6.0, "Documento"),
        ("periodico", 6.5, "Periodico"),
        ("revista", 6.5, "Revista"),
        ("folleto", 5.5, "Folleto"),
        ("recibo", 6.0, "Recibo"),
        ("factura", 6.0, "Factura"),
        ("ticket", 6.0, "Ticket"),
        ("sobre", 6.0, "Sobre"),
        ("bolsa de papel", 6.5, "Bolsa de papel"),
        ("papel regalo", 6.0, "Papel de regalo"),
        ("papel higienico", 9.0, "Papel higienico"),
        ("papel higenico", 9.0, "Papel higienico"),
        ("rollo de papel", 8.5, "Rollo de papel"),
        ("toalla de papel", 8.0, "Toalla de papel"),
        ("papel absorbente", 8.0, "Papel absorbente"),
        ("servilleta", 7.0, "Servilleta"),
        ("tissue", 7.0, "Papel tissue"),
        ("panuelo", 6.5, "Panuelo de papel"),
        ("papel bond", 6.5, "Papel bond"),
        ("cartulina", 6.0, "Cartulina"),
        ("post it", 5.5, "Nota adhesiva"),
        ("escuela", 7.0, "Hojas escolares"),
        ("colegio", 7.0, "Hojas escolares"),
        ("universidad", 6.5, "Apuntes"),
        ("clase", 5.5, "Apuntes de clase"),
        ("clases", 5.5, "Apuntes de clase"),
        ("apunte", 7.0, "Apunte"),
        ("apuntes", 7.0, "Apuntes"),
        ("tarea", 6.5, "Tarea impresa"),
        ("tareas", 6.5, "Tareas impresas"),
        ("examen", 6.5, "Examen impreso"),
        ("escrito", 6.0, "Hoja escrita"),
        ("escrita", 6.0, "Hoja escrita"),
        ("escritas", 6.5, "Hojas escritas"),
        ("fotocopia", 7.0, "Fotocopia"),
        ("fotocopias", 7.0, "Fotocopias"),
        ("impreso", 6.5, "Documento impreso"),
        ("impresa", 6.5, "Hoja impresa"),
        ("impresion", 6.0, "Impresion"),
        ("carpeta", 5.0, "Documentos en carpeta"),
        ("folder", 5.0, "Documentos en folder"),
        ("folio", 6.5, "Folio"),
        ("folios", 6.5, "Folios"),
    ],
    "cardboard": [
        ("carton", 8.0, "Carton"),
        ("caja", 8.0, "Caja de carton"),
        ("caja de carton", 9.0, "Caja de carton"),
        ("caja de cereal", 8.5, "Caja de cereal"),
        ("caja de zapatos", 8.0, "Caja de zapatos"),
        ("empaque", 6.5, "Empaque de carton"),
        ("paquete", 6.0, "Caja de envio"),
        ("delivery", 5.5, "Caja de delivery"),
        ("pizza", 7.5, "Caja de pizza"),
        ("corrugado", 6.0, "Carton corrugado"),
        ("huevera", 7.0, "Huevera de carton"),
        ("carton de huevos", 7.0, "Huevera de carton"),
        ("porta huevos", 7.0, "Huevera de carton"),
        ("tubo de carton", 7.5, "Tubo de carton"),
        ("bandeja de carton", 7.0, "Bandeja de carton"),
        ("carton prensado", 6.5, "Carton prensado"),
        ("empaque tetra", 5.5, "Empaque multicapa"),
        ("tetrapak", 5.5, "Empaque multicapa"),
        ("carpeta de carton", 7.0, "Carpeta de carton"),
        ("folder de carton", 7.0, "Folder de carton"),
    ],
    "plastic": [
        ("plastico", 8.0, "Plastico"),
        ("pet", 6.5, "Botella PET"),
        ("botella pet", 8.5, "Botella PET"),
        ("botella plastica", 9.0, "Botella plastica"),
        ("botella de plastico", 9.0, "Botella plastica"),
        ("envase plastico", 8.5, "Envase plastico"),
        ("frasco plastico", 8.0, "Frasco plastico"),
        ("recipiente plastico", 8.5, "Recipiente plastico"),
        ("vaso plastico", 8.0, "Vaso plastico"),
        ("plato plastico", 7.5, "Plato plastico"),
        ("cubierto plastico", 7.0, "Cubierto plastico"),
        ("taza plastica", 8.0, "Taza plastica"),
        ("mug plastico", 8.0, "Mug plastico"),
        ("jarro plastico", 7.5, "Jarro plastico"),
        ("tupper", 7.5, "Recipiente plastico"),
        ("envase de yogurt", 7.5, "Envase de yogurt"),
        ("tapa plastica", 7.5, "Tapa plastica"),
        ("botella", 4.0, "Botella"),
        ("funda", 5.5, "Funda plastica"),
        ("bolsa plastica", 7.0, "Bolsa plastica"),
        ("ziploc", 6.0, "Bolsa plastica"),
        ("detergente", 6.5, "Envase plastico de limpieza"),
        ("shampoo", 6.0, "Botella plastica"),
        ("limpieza", 5.5, "Envase plastico"),
        ("empaque plastico", 7.0, "Empaque plastico"),
        ("vaso reusable", 5.5, "Vaso reutilizable"),
        ("taza reusable", 5.5, "Taza reutilizable"),
        ("taza", 4.5, "Taza o vaso reutilizable"),
        ("mug", 5.0, "Mug reutilizable"),
        ("vaso", 4.5, "Vaso reutilizable"),
        ("jarro", 4.5, "Jarro reutilizable"),
        ("film plastico", 6.0, "Film plastico"),
        ("papel film", 6.0, "Film plastico"),
        ("blister", 6.0, "Blister plastico"),
        ("envase cosmetico", 6.5, "Envase cosmetico"),
        ("galon plastico", 7.0, "Galon plastico"),
        ("sachet", 6.0, "Sachet plastico"),
        ("envoltorio plastico", 7.0, "Envoltorio plastico"),
        ("paquete plastico", 7.0, "Paquete plastico"),
    ],
    "metal": [
        ("metal", 7.0, "Metal"),
        ("lata", 9.0, "Lata de aluminio"),
        ("lata de bebida", 9.0, "Lata de bebida"),
        ("lata de jugo", 9.5, "Lata de jugo"),
        ("lata de aluminio", 9.0, "Lata de aluminio"),
        ("aluminio", 8.0, "Aluminio"),
        ("aerosol", 7.5, "Envase metalico"),
        ("tarro metalico", 8.0, "Tarro metalico"),
        ("conserva", 6.5, "Lata de conserva"),
        ("lata de atun", 8.0, "Lata de atun"),
        ("lata de comida", 7.5, "Lata de conserva"),
        ("bandeja de aluminio", 8.0, "Bandeja de aluminio"),
        ("papel aluminio", 7.0, "Papel aluminio"),
        ("tapa metalica", 7.5, "Tapa metalica"),
        ("bebida en lata", 8.0, "Lata de bebida"),
        ("te en lata", 8.0, "Lata de bebida"),
        ("jugo en lata", 8.0, "Lata de bebida"),
        ("jugo comprado en lata", 9.5, "Lata de jugo"),
        ("refresco en lata", 8.0, "Lata de bebida"),
        ("chatarra", 6.5, "Chatarra pequena"),
        ("clip", 5.5, "Clip metalico"),
        ("grapa", 5.5, "Grapa metalica"),
        ("olla", 6.0, "Olla metalica"),
        ("tijera", 6.0, "Tijera metalica"),
        ("llave", 6.5, "Llave metalica"),
        ("tornillo", 6.0, "Tornillo"),
        ("clavo", 6.0, "Clavo"),
    ],
    "white-glass": [
        ("vidrio", 5.5, "Vidrio"),
        ("frasco", 8.5, "Frasco de vidrio"),
        ("frasco de vidrio", 9.5, "Frasco de vidrio"),
        ("tarro de vidrio", 9.0, "Tarro de vidrio"),
        ("botella de vidrio", 8.0, "Botella de vidrio"),
        ("botella transparente", 8.5, "Botella de vidrio transparente"),
        ("vidrio transparente", 8.5, "Vidrio transparente"),
        ("vaso de vidrio", 8.0, "Vaso de vidrio"),
        ("copa de vidrio", 7.5, "Copa de vidrio"),
        ("taza de vidrio", 7.5, "Taza de vidrio"),
        ("jarra de vidrio", 8.0, "Jarra de vidrio"),
        ("mermelada", 6.5, "Frasco de mermelada"),
        ("perfume", 6.5, "Botella de perfume"),
        ("conserva de vidrio", 7.0, "Frasco de conserva"),
        ("salsa de vidrio", 7.0, "Frasco de salsa"),
    ],
    "green-glass": [
        ("vidrio verde", 8.5, "Vidrio verde"),
        ("botella verde", 8.5, "Botella verde"),
        ("frasco verde", 8.0, "Frasco verde"),
        ("botella de vino", 7.5, "Botella de vino"),
        ("cerveza verde", 7.0, "Botella verde"),
        ("vino verde", 7.0, "Botella verde"),
    ],
    "brown-glass": [
        ("vidrio cafe", 8.5, "Vidrio cafe"),
        ("vidrio ambar", 8.5, "Vidrio ambar"),
        ("botella cafe", 8.5, "Botella cafe"),
        ("botella ambar", 8.5, "Botella ambar"),
        ("frasco ambar", 8.0, "Frasco ambar"),
        ("cerveza", 7.0, "Botella de cerveza"),
        ("frasco de medicina", 7.0, "Frasco de medicina"),
        ("jarabe", 6.5, "Frasco ambar"),
        ("suero", 6.0, "Frasco ambar"),
    ],
    "battery": [
        ("bateria", 9.0, "Bateria"),
        ("pila", 9.0, "Pila"),
        ("pilas", 9.0, "Pilas"),
        ("pila boton", 9.0, "Pila boton"),
        ("pila de litio", 8.5, "Pila de litio"),
        ("bateria recargable", 8.5, "Bateria recargable"),
        ("power bank", 8.0, "Power bank"),
        ("bateria externa", 8.0, "Bateria externa"),
        ("aa", 7.0, "Pila AA"),
        ("aaa", 7.0, "Pila AAA"),
        ("control remoto", 8.0, "Pila de control remoto"),
        ("bateria de celular", 8.5, "Bateria de celular"),
        ("bateria laptop", 8.5, "Bateria de laptop"),
        ("bateria de laptop", 8.5, "Bateria de laptop"),
        ("cargador portatil", 7.5, "Power bank"),
    ],
    "biological": [
        ("organico", 8.0, "Residuo organico"),
        ("compost", 7.5, "Residuo compostable"),
        ("compostable", 7.5, "Residuo compostable"),
        ("comida", 8.0, "Restos de comida"),
        ("restos de comida", 8.5, "Restos de comida"),
        ("cascara", 8.0, "Cascara"),
        ("cascara de banana", 8.0, "Cascara de banana"),
        ("cascara de huevo", 8.0, "Cascara de huevo"),
        ("fruta", 7.0, "Fruta"),
        ("verdura", 7.0, "Verdura"),
        ("vegetales", 7.0, "Vegetales"),
        ("borra de cafe", 7.5, "Borra de cafe"),
        ("cafe molido", 7.0, "Borra de cafe"),
        ("bolsa de te", 7.0, "Bolsa de te"),
        ("yerba", 6.5, "Residuo vegetal"),
        ("flores", 6.0, "Restos vegetales"),
        ("poda", 6.0, "Restos de poda"),
        ("cascaras", 8.0, "Cascaras"),
        ("sobras", 7.0, "Sobras de comida"),
        ("residuo de cocina", 8.0, "Residuo de cocina"),
    ],
    "clothes": [
        ("ropa", 8.5, "Ropa"),
        ("camiseta", 7.5, "Camiseta"),
        ("camisa", 7.5, "Camisa"),
        ("pantalon", 7.5, "Pantalon"),
        ("chaqueta", 7.5, "Chaqueta"),
        ("jean", 7.0, "Jean"),
        ("sueter", 7.0, "Sueter"),
        ("uniforme", 7.0, "Uniforme"),
        ("toalla", 7.0, "Toalla"),
        ("sabana", 7.0, "Sabana"),
        ("bufanda", 6.5, "Bufanda"),
        ("textil", 6.5, "Textil"),
        ("medias", 6.5, "Medias"),
        ("calcetines", 6.5, "Calcetines"),
        ("cortina", 6.0, "Cortina"),
        ("trapo", 6.0, "Trapo textil"),
        ("camiseta vieja", 8.0, "Camiseta"),
        ("ropa vieja", 8.0, "Ropa usada"),
        ("uniforme escolar", 8.0, "Uniforme"),
    ],
    "shoes": [
        ("zapato", 8.5, "Zapato"),
        ("zapatos", 8.5, "Zapatos"),
        ("zapatilla", 8.5, "Zapatilla"),
        ("zapatillas", 8.5, "Zapatillas"),
        ("tenis", 8.0, "Tenis"),
        ("sandalia", 7.0, "Sandalia"),
        ("calzado", 7.0, "Calzado"),
        ("bota", 8.0, "Bota"),
        ("botin", 7.5, "Botin"),
        ("pantufla", 7.0, "Pantufla"),
        ("chancla", 7.0, "Chancla"),
        ("taco", 6.5, "Zapato de tacon"),
        ("crocs", 6.5, "Calzado plastico"),
        ("suela", 6.0, "Suela de zapato"),
        ("zapato viejo", 8.0, "Zapato usado"),
        ("tenis viejos", 8.0, "Tenis usados"),
        ("calzado viejo", 8.0, "Calzado usado"),
    ],
    "trash": [
        ("basura", 6.0, "Basura comun"),
        ("envoltura", 6.5, "Envoltura sucia"),
        ("envoltura metalizada", 8.0, "Envoltura metalizada"),
        ("mezcla", 6.0, "Residuo mezclado"),
        ("panal", 8.5, "Panal"),
        ("panales", 9.0, "Panales"),
        ("panal de bebe", 9.5, "Panal de bebe"),
        ("panales de bebe", 9.5, "Panales de bebe"),
        ("mascarilla", 8.0, "Mascarilla"),
        ("colilla", 8.0, "Colilla"),
        ("icopor", 8.5, "Icopor"),
        ("poliestireno", 8.5, "Poliestireno expandido"),
        ("espuma plastica", 8.0, "Espuma plastica"),
        ("esponja", 7.0, "Esponja usada"),
        ("cepillo de dientes", 7.5, "Cepillo de dientes"),
        ("servilleta sucia", 7.5, "Servilleta sucia"),
        ("papel higienico usado", 10.0, "Papel higienico usado"),
        ("toalla de papel usada", 9.5, "Toalla de papel usada"),
        ("residuo sanitario", 8.5, "Residuo sanitario"),
        ("chicle", 7.0, "Chicle"),
        ("ceramica", 7.0, "Ceramica rota"),
        ("loza", 7.0, "Loza rota"),
        ("panal usado", 9.0, "Panal"),
        ("panales usados", 9.5, "Panales usados"),
        ("pañal", 8.5, "Panal"),
    ],
}

EXTRA_ALIASES: dict[str, list[tuple[str, float, str]]] = {
    "paper": [
        ("hoja de carpeta", 7.5, "Hoja de carpeta"),
        ("hojas de carpeta", 7.5, "Hojas de carpeta"),
        ("hoja rayada", 7.0, "Hoja rayada"),
        ("hoja cuadriculada", 7.0, "Hoja cuadriculada"),
        ("hoja blanca", 7.0, "Hoja blanca"),
        ("hoja reciclada", 7.0, "Hoja de papel"),
        ("hoja suelta", 7.0, "Hoja suelta"),
        ("papeles", 7.0, "Papeles"),
        ("papeles escritos", 8.5, "Papeles escritos"),
        ("papeles de escuela", 8.5, "Papeles escolares"),
        ("papeles de oficina", 8.0, "Papeles de oficina"),
        ("apuntes escritos", 8.5, "Apuntes escritos"),
        ("notas de clase", 8.0, "Notas de clase"),
        ("guia", 6.5, "Guia impresa"),
        ("guia impresa", 8.0, "Guia impresa"),
        ("prueba", 6.5, "Prueba impresa"),
        ("evaluacion", 6.5, "Evaluacion impresa"),
        ("deber", 6.5, "Deber escolar"),
        ("deberes", 6.5, "Deberes escolares"),
        ("trabajo impreso", 8.0, "Trabajo impreso"),
        ("documentos", 7.0, "Documentos"),
        ("archivo papel", 7.5, "Archivo de papel"),
        ("hojas archivadas", 8.0, "Hojas archivadas"),
        ("papel arrugado", 7.0, "Papel arrugado"),
        ("papel limpio", 8.0, "Papel limpio"),
        ("papel seco", 8.0, "Papel seco"),
        ("papel mojado", 8.0, "Papel mojado"),
        ("papel con tinta", 7.5, "Papel escrito"),
        ("papel escrito", 8.0, "Papel escrito"),
        ("libro", 6.5, "Libro"),
        ("libros", 6.5, "Libros"),
        ("agenda", 6.0, "Agenda de papel"),
        ("bloc", 6.5, "Bloc de notas"),
        ("block", 6.5, "Block de notas"),
        ("hojas del cuaderno", 8.5, "Hojas de cuaderno"),
        ("papel de cuaderno", 8.5, "Papel de cuaderno"),
    ],
    "cardboard": [
        ("carton limpio", 8.0, "Carton limpio"),
        ("carton seco", 8.0, "Carton seco"),
        ("carton mojado", 8.0, "Carton mojado"),
        ("carton con grasa", 8.5, "Carton con grasa"),
        ("caja limpia", 8.0, "Caja de carton"),
        ("caja seca", 8.0, "Caja de carton seca"),
        ("caja mojada", 8.0, "Caja de carton mojada"),
        ("caja de envio", 8.5, "Caja de envio"),
        ("caja amazon", 8.0, "Caja de envio"),
        ("caja mercado libre", 8.0, "Caja de envio"),
        ("empaque de envio", 8.0, "Empaque de carton"),
        ("caja de leche", 7.0, "Empaque multicapa"),
        ("carton de leche", 7.0, "Empaque multicapa"),
        ("caja de jugo", 7.0, "Empaque multicapa"),
        ("rollo papel higienico", 8.0, "Tubo de carton"),
        ("tubo de papel", 8.0, "Tubo de carton"),
        ("base de pizza", 7.5, "Caja de pizza"),
        ("carton pizza", 8.0, "Caja de pizza"),
    ],
    "plastic": [
        ("plastico limpio", 8.0, "Plastico limpio"),
        ("plastico sucio", 8.0, "Plastico sucio"),
        ("plastico duro", 7.5, "Plastico duro"),
        ("plastico flexible", 7.5, "Plastico flexible"),
        ("agua que compre", 9.5, "Botella plastica de agua"),
        ("de agua que compre", 9.5, "Botella plastica de agua"),
        ("compre agua", 9.5, "Botella plastica de agua"),
        ("agua comprada", 9.0, "Botella plastica de agua"),
        ("agua embotellada", 9.5, "Botella plastica de agua"),
        ("envase de agua", 9.0, "Envase plastico de agua"),
        ("botellas de agua", 9.5, "Botellas plasticas de agua"),
        ("botella de agua comprada", 9.5, "Botella plastica de agua"),
        ("botella de agua", 8.5, "Botella plastica"),
        ("botella de gaseosa", 8.5, "Botella plastica"),
        ("botella de cola", 8.0, "Botella plastica"),
        ("botella transparente plastica", 8.5, "Botella plastica"),
        ("envase de shampoo", 8.0, "Botella plastica"),
        ("envase de detergente", 8.0, "Envase plastico de limpieza"),
        ("envase de cloro", 8.0, "Envase plastico de limpieza"),
        ("envase de jabon", 8.0, "Envase plastico"),
        ("pote plastico", 8.0, "Pote plastico"),
        ("pote de yogurt", 8.0, "Envase de yogurt"),
        ("tarrina", 8.0, "Tarrina plastica"),
        ("tarrina plastica", 8.5, "Tarrina plastica"),
        ("cubeta plastica", 7.5, "Cubeta plastica"),
        ("bidon plastico", 8.0, "Bidon plastico"),
        ("galon", 7.5, "Galon plastico"),
        ("funda plastica", 8.0, "Funda plastica"),
        ("funda de supermercado", 8.0, "Funda plastica"),
        ("bolsita plastica", 8.0, "Bolsa plastica"),
        ("envoltura plastica", 8.0, "Envoltura plastica"),
        ("empaque de snacks", 7.0, "Empaque plastico"),
        ("empaque de galletas", 7.0, "Empaque plastico"),
        ("tapa de botella", 8.0, "Tapa plastica"),
        ("sorbete", 7.0, "Sorbete plastico"),
        ("pitillo", 7.0, "Sorbete plastico"),
        ("cuchara plastica", 7.5, "Cubierto plastico"),
        ("tenedor plastico", 7.5, "Cubierto plastico"),
    ],
    "metal": [
        ("lata limpia", 9.0, "Lata limpia"),
        ("lata sucia", 9.0, "Lata sucia"),
        ("lata de cola", 9.0, "Lata de bebida"),
        ("lata de cerveza", 9.0, "Lata de bebida"),
        ("lata de atun vacia", 9.0, "Lata de atun"),
        ("lata de sardina", 8.5, "Lata de conserva"),
        ("tarro de leche", 8.0, "Tarro metalico"),
        ("tarro de pintura", 8.0, "Tarro metalico"),
        ("envase aerosol", 8.0, "Envase metalico"),
        ("spray", 7.5, "Envase metalico"),
        ("tapa de metal", 8.0, "Tapa metalica"),
        ("corcholata", 7.5, "Tapa metalica"),
        ("anilla de lata", 7.5, "Anilla de lata"),
        ("papel de aluminio", 8.0, "Papel aluminio"),
        ("aluminio usado", 8.0, "Aluminio"),
        ("olla vieja", 7.0, "Olla metalica"),
        ("cable", 6.5, "Cable metalico"),
        ("cables", 6.5, "Cables"),
        ("pieza metalica", 7.5, "Pieza metalica"),
    ],
    "white-glass": [
        ("vidrio blanco", 8.5, "Vidrio transparente"),
        ("vidrio claro", 8.5, "Vidrio transparente"),
        ("cristal", 7.5, "Vidrio transparente"),
        ("frasco transparente", 9.0, "Frasco de vidrio transparente"),
        ("frasco de mermelada", 9.0, "Frasco de mermelada"),
        ("frasco de mayonesa", 9.0, "Frasco de vidrio"),
        ("frasco de cafe", 9.0, "Frasco de vidrio"),
        ("frasco de conserva", 9.0, "Frasco de conserva"),
        ("botella de vidrio transparente", 9.0, "Botella de vidrio transparente"),
        ("botella de salsa", 8.0, "Botella de vidrio"),
        ("envase de vidrio", 8.5, "Envase de vidrio"),
        ("vidrio roto", 8.5, "Vidrio roto"),
        ("vaso roto", 8.0, "Vaso de vidrio roto"),
    ],
    "green-glass": [
        ("botella verde de vidrio", 9.0, "Botella verde"),
        ("envase verde", 8.0, "Envase de vidrio verde"),
        ("vidrio verde roto", 8.5, "Vidrio verde roto"),
        ("botella de cerveza verde", 8.5, "Botella verde"),
    ],
    "brown-glass": [
        ("botella cafe de vidrio", 9.0, "Botella cafe"),
        ("botella marron", 8.5, "Botella ambar"),
        ("vidrio marron", 8.5, "Vidrio ambar"),
        ("envase ambar", 8.5, "Envase ambar"),
        ("frasco cafe", 8.5, "Frasco ambar"),
        ("botella de cerveza cafe", 8.5, "Botella de cerveza"),
    ],
    "battery": [
        ("pila usada", 9.5, "Pila usada"),
        ("pilas usadas", 9.5, "Pilas usadas"),
        ("bateria usada", 9.5, "Bateria usada"),
        ("baterias usadas", 9.5, "Baterias usadas"),
        ("pila pequena", 9.0, "Pila pequena"),
        ("pila grande", 9.0, "Pila grande"),
        ("pila alcalina", 9.0, "Pila alcalina"),
        ("bateria de control", 9.0, "Pila de control remoto"),
        ("bateria de juguete", 9.0, "Pila de juguete"),
        ("bateria hinchada", 10.0, "Bateria danada"),
        ("bateria dañada", 10.0, "Bateria danada"),
        ("celular viejo con bateria", 8.5, "Bateria de celular"),
        ("bateria de camara", 8.5, "Bateria de camara"),
        ("bateria de reloj", 8.5, "Pila boton"),
        ("pila reloj", 8.5, "Pila boton"),
    ],
    "biological": [
        ("cascara de platano", 8.5, "Cascara de platano"),
        ("cascara de banano", 8.5, "Cascara de banano"),
        ("cascara de naranja", 8.5, "Cascara de naranja"),
        ("cascara de limon", 8.5, "Cascara de limon"),
        ("cascara de papa", 8.5, "Cascara de papa"),
        ("cascaras de fruta", 8.5, "Cascaras de fruta"),
        ("sobras de arroz", 8.0, "Sobras de comida"),
        ("sobras de almuerzo", 8.0, "Sobras de comida"),
        ("comida dañada", 8.5, "Comida danada"),
        ("comida danada", 8.5, "Comida danada"),
        ("restos vegetales", 8.0, "Restos vegetales"),
        ("hojas de jardin", 7.5, "Restos de jardin"),
        ("pasto", 7.0, "Restos de jardin"),
        ("ramas pequenas", 7.0, "Restos de poda"),
        ("pan viejo", 7.5, "Pan viejo"),
        ("bolsa de te usada", 8.0, "Bolsa de te usada"),
        ("filtro de cafe", 7.5, "Filtro de cafe usado"),
    ],
    "clothes": [
        ("ropa limpia", 8.0, "Ropa limpia"),
        ("ropa rota", 8.0, "Ropa rota"),
        ("ropa manchada", 8.0, "Ropa manchada"),
        ("prenda", 7.5, "Prenda textil"),
        ("prendas", 7.5, "Prendas textiles"),
        ("short", 7.0, "Short"),
        ("falda", 7.0, "Falda"),
        ("vestido", 7.0, "Vestido"),
        ("abrigo", 7.0, "Abrigo"),
        ("gorra", 6.5, "Gorra"),
        ("guante", 6.5, "Guante"),
        ("ropa de bebe", 8.0, "Ropa de bebe"),
        ("mantel", 6.5, "Mantel"),
        ("cobija", 7.0, "Cobija"),
        ("almohada", 6.5, "Almohada"),
        ("tela", 7.0, "Tela"),
        ("retazo", 7.0, "Retazo textil"),
    ],
    "shoes": [
        ("zapatos viejos", 8.5, "Zapatos usados"),
        ("zapatillas viejas", 8.5, "Zapatillas usadas"),
        ("tenis usados", 8.5, "Tenis usados"),
        ("sandalias usadas", 8.0, "Sandalias usadas"),
        ("botas usadas", 8.0, "Botas usadas"),
        ("calzado usado", 8.5, "Calzado usado"),
        ("zapato roto", 8.5, "Zapato roto"),
        ("zapatos rotos", 8.5, "Zapatos rotos"),
        ("par de zapatos", 8.5, "Zapatos"),
        ("par de tenis", 8.5, "Tenis"),
        ("cordones", 6.0, "Cordones de calzado"),
        ("plantilla", 6.0, "Plantilla de zapato"),
    ],
    "trash": [
        ("basura comun", 8.0, "Basura comun"),
        ("desecho comun", 8.0, "Desecho comun"),
        ("residuo comun", 8.0, "Residuo comun"),
        ("no reciclable", 8.0, "Residuo no reciclable"),
        ("muy sucio", 7.5, "Residuo contaminado"),
        ("con grasa", 7.0, "Residuo con grasa"),
        ("con comida", 7.0, "Residuo con restos de comida"),
        ("envoltura de dulce", 7.5, "Envoltura"),
        ("envoltura de papas", 7.5, "Envoltura"),
        ("funda metalizada", 8.0, "Envoltura metalizada"),
        ("empaque metalizado", 8.0, "Empaque metalizado"),
        ("servilleta usada", 8.5, "Servilleta usada"),
        ("papel sucio", 8.0, "Papel sucio"),
        ("papel con grasa", 8.5, "Papel con grasa"),
        ("pañal", 9.0, "Panal"),
        ("panal sucio", 9.0, "Panal"),
        ("panales", 9.2, "Panales"),
        ("panales sucios", 9.5, "Panales"),
        ("panal de bebe", 9.6, "Panal de bebe"),
        ("panales de bebe", 9.6, "Panales de bebe"),
        ("panales de mi hijo", 10.0, "Panales de bebe"),
        ("cubrebocas", 8.0, "Mascarilla"),
        ("tapabocas", 8.0, "Mascarilla"),
        ("guante quirurgico", 8.0, "Residuo sanitario"),
        ("hisopo", 7.5, "Residuo sanitario"),
        ("cepillo dental", 7.5, "Cepillo de dientes"),
        ("vidrio contaminado", 7.5, "Residuo no reciclable"),
        ("ceramica rota", 8.0, "Ceramica rota"),
        ("plato roto", 7.5, "Loza rota"),
    ],
}

for label, entries in EXTRA_ALIASES.items():
    ALIASES.setdefault(label, []).extend(entries)

DEMO_ALIAS_PACK: dict[str, list[tuple[str, float, str]]] = {
    "paper": [
        ("papel de impresora", 8.0, "Papel de impresora"),
        ("papel reciclable", 8.0, "Papel reciclable"),
        ("hojas usadas", 8.0, "Hojas usadas"),
        ("hojas limpias", 8.0, "Hojas limpias"),
        ("hojas con nombre", 8.0, "Hojas con datos personales"),
        ("documentos personales", 8.5, "Documentos personales"),
        ("papel confidencial", 8.5, "Documento confidencial"),
        ("contrato", 7.0, "Documento"),
        ("formulario", 7.0, "Formulario"),
        ("caratula", 6.0, "Caratula de papel"),
        ("separador de papel", 6.5, "Separador de papel"),
        ("lamina", 6.0, "Lamina de papel"),
        ("guia de estudio", 8.0, "Guia de estudio"),
        ("temario", 7.0, "Temario impreso"),
        ("dibujo en papel", 7.5, "Dibujo en papel"),
        ("papel craft", 7.0, "Papel kraft"),
        ("papel kraft", 7.0, "Papel kraft"),
        ("papel periodico", 8.0, "Papel periodico"),
        ("catalogo", 7.0, "Catalogo"),
        ("manual", 6.5, "Manual impreso"),
        ("instructivo", 6.5, "Instructivo impreso"),
        ("calendario", 6.5, "Calendario de papel"),
        ("agenda vieja", 7.0, "Agenda usada"),
    ],
    "cardboard": [
        ("carton reciclable", 8.0, "Carton reciclable"),
        ("carton limpio y seco", 9.0, "Carton limpio y seco"),
        ("caja de mudanza", 8.0, "Caja de mudanza"),
        ("caja de encomienda", 8.0, "Caja de envio"),
        ("carton de paquete", 8.0, "Carton de paquete"),
        ("empaque de electrodomestico", 8.0, "Caja de carton"),
        ("carton grueso", 7.5, "Carton grueso"),
        ("carton delgado", 7.5, "Carton delgado"),
        ("carton de delivery", 8.0, "Carton de delivery"),
        ("vaso de carton", 7.0, "Vaso de carton"),
        ("plato de carton", 7.0, "Plato de carton"),
        ("bandeja de huevos", 8.0, "Huevera de carton"),
        ("protector de carton", 7.0, "Protector de carton"),
        ("separador de carton", 7.0, "Separador de carton"),
    ],
    "plastic": [
        ("envase de crema", 8.0, "Envase cosmetico"),
        ("envase de gel", 8.0, "Envase plastico"),
        ("envase de alcohol", 7.5, "Envase plastico"),
        ("botella de aceite", 8.0, "Botella plastica"),
        ("botella de leche plastica", 8.5, "Botella plastica"),
        ("botellon", 8.0, "Botellon plastico"),
        ("garrafa", 8.0, "Garrafa plastica"),
        ("caneca plastica", 8.0, "Caneca plastica"),
        ("balde plastico", 8.0, "Balde plastico"),
        ("juguete plastico", 7.0, "Juguete plastico"),
        ("gancho plastico", 7.0, "Gancho plastico"),
        ("percha plastica", 7.0, "Percha plastica"),
        ("tarjeta plastica", 6.5, "Tarjeta plastica"),
        ("empaque de pan", 7.0, "Bolsa plastica"),
        ("bolsa de arroz", 7.0, "Empaque plastico"),
        ("bolsa de fideos", 7.0, "Empaque plastico"),
        ("funda ziploc", 7.5, "Bolsa plastica"),
        ("malla plastica", 6.5, "Malla plastica"),
        ("bandeja plastica", 7.5, "Bandeja plastica"),
        ("tapa de yogurt", 7.5, "Tapa plastica"),
    ],
    "metal": [
        ("latas aplastadas", 9.0, "Latas aplastadas"),
        ("latas vacias", 9.0, "Latas vacias"),
        ("lata de jugo", 9.5, "Lata de jugo"),
        ("jugo en lata", 9.5, "Lata de jugo"),
        ("bebida en lata", 9.0, "Lata de bebida"),
        ("lata oxidada", 8.0, "Lata oxidada"),
        ("conserva vacia", 8.5, "Lata de conserva"),
        ("tapa de cerveza", 8.0, "Tapa metalica"),
        ("tapa corona", 8.0, "Tapa metalica"),
        ("alambre", 7.0, "Alambre"),
        ("cable pelado", 7.0, "Cable metalico"),
        ("pieza de aluminio", 8.0, "Pieza de aluminio"),
        ("molde de aluminio", 8.0, "Molde de aluminio"),
        ("cubierto metalico", 7.0, "Cubierto metalico"),
        ("cuchara metalica", 7.0, "Cuchara metalica"),
        ("tenedor metalico", 7.0, "Tenedor metalico"),
        ("cuchillo metalico", 7.5, "Cuchillo metalico"),
    ],
    "white-glass": [
        ("frasco vacio", 8.5, "Frasco de vidrio"),
        ("frasco limpio", 9.0, "Frasco de vidrio limpio"),
        ("envase de perfume", 8.5, "Botella de perfume"),
        ("envase de colonia", 8.0, "Botella de perfume"),
        ("botella de agua de vidrio", 8.5, "Botella de vidrio"),
        ("recipiente de vidrio", 8.5, "Recipiente de vidrio"),
        ("vidrio de ventana", 6.5, "Vidrio plano"),
        ("espejo", 6.5, "Espejo"),
        ("foco", 6.5, "Foco"),
        ("bombillo", 6.5, "Bombillo"),
    ],
    "green-glass": [
        ("botella verde vacia", 8.5, "Botella verde"),
        ("vidrio verde limpio", 8.5, "Vidrio verde"),
        ("envase verde de bebida", 8.0, "Botella verde"),
    ],
    "brown-glass": [
        ("botella cafe vacia", 8.5, "Botella cafe"),
        ("vidrio cafe limpio", 8.5, "Vidrio cafe"),
        ("frasco marron", 8.0, "Frasco ambar"),
    ],
    "battery": [
        ("baterias de juguete", 9.0, "Pilas de juguete"),
        ("pilas de juguete", 9.0, "Pilas de juguete"),
        ("pila sulfatada", 10.0, "Pila danada"),
        ("pila oxidada", 9.5, "Pila danada"),
        ("bateria sulfatada", 10.0, "Bateria danada"),
        ("bateria de tablet", 8.5, "Bateria de tablet"),
        ("bateria de audifonos", 8.5, "Bateria pequena"),
        ("audifonos con bateria", 8.0, "Residuo electronico con bateria"),
        ("reloj con pila", 8.0, "Pila boton"),
        ("linterna con pilas", 8.0, "Pilas"),
    ],
    "biological": [
        ("residuos de fruta", 8.0, "Restos de fruta"),
        ("restos de verduras", 8.0, "Restos de verduras"),
        ("verduras dañadas", 8.0, "Verduras danadas"),
        ("fruta podrida", 8.5, "Fruta danada"),
        ("comida vencida", 8.0, "Comida vencida"),
        ("arroz cocido", 7.5, "Sobras de comida"),
        ("cascara de aguacate", 8.0, "Cascara de aguacate"),
        ("pepa de fruta", 7.0, "Restos de fruta"),
        ("semillas", 7.0, "Semillas"),
        ("restos de ensalada", 8.0, "Restos vegetales"),
        ("hojas secas", 7.5, "Hojas secas"),
        ("ramitas", 7.0, "Restos de poda"),
        ("tierra de planta", 6.5, "Residuo de jardin"),
    ],
    "clothes": [
        ("ya no me queda", 9.5, "Prenda para donar"),
        ("no me queda", 9.5, "Prenda para donar"),
        ("me queda pequeno", 9.0, "Prenda para donar"),
        ("me queda pequena", 9.0, "Prenda para donar"),
        ("me queda chico", 9.0, "Prenda para donar"),
        ("me queda chica", 9.0, "Prenda para donar"),
        ("me queda grande", 9.0, "Prenda para donar"),
        ("ya no lo uso", 8.5, "Prenda para donar"),
        ("ya no la uso", 8.5, "Prenda para donar"),
        ("ya no uso", 8.5, "Prenda para donar"),
        ("ropa que no me queda", 9.0, "Ropa para donar"),
        ("ropa que ya no me queda", 9.5, "Ropa para donar"),
        ("ropa que no uso", 9.0, "Ropa para donar"),
        ("ropa para regalar", 9.0, "Ropa para donar"),
        ("ropa en buen estado", 9.0, "Ropa en buen estado"),
        ("ropa para vender", 8.5, "Ropa de segunda mano"),
        ("camisa que no me queda", 9.0, "Camisa para donar"),
        ("pantalon que no me queda", 9.0, "Pantalon para donar"),
        ("uniforme usado", 8.0, "Uniforme usado"),
        ("uniforme que ya no me queda", 9.0, "Uniforme para donar"),
        ("chaqueta usada", 8.0, "Chaqueta usada"),
        ("ropa de niño", 8.0, "Ropa de nino"),
        ("ropa de nina", 8.0, "Ropa de nina"),
        ("ropa de bebe usada", 8.0, "Ropa de bebe"),
        ("camiseta manchada", 8.0, "Camiseta manchada"),
        ("jean roto", 8.0, "Jean roto"),
        ("prenda para reparar", 8.0, "Prenda reparable"),
        ("ropa para trapo", 8.0, "Textil para trapo"),
    ],
    "shoes": [
        ("ya no me queda", 7.5, "Calzado para donar"),
        ("no me queda", 7.5, "Calzado para donar"),
        ("me queda pequeno", 7.0, "Calzado para donar"),
        ("me queda grande", 7.0, "Calzado para donar"),
        ("zapatos que no me quedan", 9.0, "Zapatos para donar"),
        ("tenis que no me quedan", 9.0, "Tenis para donar"),
        ("zapatos en buen estado", 9.0, "Zapatos en buen estado"),
        ("tenis en buen estado", 9.0, "Tenis en buen estado"),
        ("zapatos para regalar", 9.0, "Zapatos para donar"),
        ("zapatos para vender", 8.5, "Zapatos de segunda mano"),
        ("calzado para donar", 9.0, "Calzado para donar"),
        ("zapatos sin suela", 8.0, "Zapatos danados"),
        ("tenis rotos", 8.0, "Tenis rotos"),
        ("zapatos para reparar", 8.0, "Zapatos reparables"),
    ],
    "trash": [
        ("residuo no recuperable", 8.0, "Residuo no recuperable"),
        ("basura del baño", 8.0, "Basura sanitaria"),
        ("papel de baño", 9.0, "Papel higienico usado"),
        ("toalla sanitaria", 9.0, "Residuo sanitario"),
        ("tampon", 9.0, "Residuo sanitario"),
        ("curita", 8.0, "Residuo sanitario"),
        ("algodon usado", 8.0, "Residuo sanitario"),
        ("empaque sucio", 8.0, "Empaque sucio"),
        ("envoltura con grasa", 8.0, "Envoltura contaminada"),
        ("bolsa sucia", 7.5, "Bolsa contaminada"),
        ("plato desechable sucio", 8.0, "Desechable sucio"),
        ("vaso desechable sucio", 8.0, "Desechable sucio"),
        ("tecnopor", 8.5, "Poliestireno expandido"),
        ("unicel", 8.5, "Poliestireno expandido"),
        ("cinta adhesiva", 7.0, "Cinta adhesiva"),
        ("papel plastificado", 7.5, "Papel plastificado"),
        ("papel encerado", 7.5, "Papel encerado"),
    ],
}

for label, entries in DEMO_ALIAS_PACK.items():
    ALIASES.setdefault(label, []).extend(entries)

CONTEXT_BOOSTS: dict[str, list[tuple[list[str], float, str]]] = {
    "paper": [
        (["escuela", "escrito"], 10.0, "Hojas escolares escritas"),
        (["escuela", "escrita"], 10.0, "Hojas escolares escritas"),
        (["escuela", "escritas"], 10.5, "Hojas escolares escritas"),
        (["hojas", "escuela"], 10.5, "Hojas escolares"),
        (["papeles", "escuela"], 10.5, "Papeles escolares"),
        (["hojas", "escritas"], 10.5, "Hojas escritas"),
        (["papel", "escrito"], 10.0, "Papel escrito"),
        (["papel", "oficina"], 9.0, "Papel de oficina"),
        (["documentos", "oficina"], 9.0, "Documentos de oficina"),
        (["colegio", "escrito"], 9.0, "Hojas escolares"),
        (["cuaderno", "hoja"], 9.0, "Hojas de cuaderno"),
        (["cuaderno", "escrito"], 9.0, "Cuaderno escrito"),
        (["apuntes", "clase"], 8.5, "Apuntes de clase"),
        (["tarea", "impresa"], 8.5, "Tarea impresa"),
    ],
    "cardboard": [
        (["caja", "carton"], 10.0, "Caja de carton"),
        (["caja", "cereal"], 8.5, "Caja de cereal"),
        (["empaque", "carton"], 8.0, "Empaque de carton"),
        (["carton", "seco"], 9.0, "Carton seco"),
        (["carton", "grasa"], 9.0, "Carton con grasa"),
        (["caja", "envio"], 9.0, "Caja de envio"),
    ],
    "plastic": [
        (["botella", "pet"], 10.0, "Botella PET"),
        (["envase", "plastico"], 9.0, "Envase plastico"),
        (["bolsa", "plastica"], 8.5, "Bolsa plastica"),
        (["agua", "compre"], 11.0, "Botella plastica de agua"),
        (["compre", "agua"], 11.0, "Botella plastica de agua"),
        (["agua", "comprada"], 10.5, "Botella plastica de agua"),
        (["agua", "embotellada"], 11.0, "Botella plastica de agua"),
        (["envase", "agua"], 10.0, "Envase plastico de agua"),
        (["botella", "agua"], 9.0, "Botella plastica"),
        (["botella", "gaseosa"], 9.0, "Botella plastica"),
        (["tapa", "plastica"], 8.5, "Tapa plastica"),
        (["funda", "supermercado"], 8.5, "Funda plastica"),
    ],
    "metal": [
        (["lata", "aluminio"], 10.0, "Lata de aluminio"),
        (["tapa", "metalica"], 8.0, "Tapa metalica"),
        (["envase", "metalico"], 8.0, "Envase metalico"),
        (["lata", "bebida"], 9.0, "Lata de bebida"),
        (["lata", "atun"], 9.0, "Lata de atun"),
        (["papel", "aluminio"], 8.5, "Papel aluminio"),
    ],
    "white-glass": [
        (["frasco", "vidrio"], 10.0, "Frasco de vidrio"),
        (["botella", "vidrio"], 8.5, "Botella de vidrio"),
        (["vidrio", "transparente"], 9.0, "Vidrio transparente"),
        (["frasco", "mermelada"], 9.0, "Frasco de mermelada"),
    ],
    "battery": [
        (["power", "bank"], 10.0, "Power bank"),
        (["pila", "usada"], 9.0, "Pila usada"),
        (["bateria", "celular"], 9.0, "Bateria de celular"),
        (["bateria", "hinchada"], 10.0, "Bateria danada"),
        (["pila", "control"], 9.0, "Pila de control remoto"),
    ],
    "biological": [
        (["restos", "comida"], 10.0, "Restos de comida"),
        (["borra", "cafe"], 9.0, "Borra de cafe"),
        (["cascara", "huevo"], 8.5, "Cascara de huevo"),
        (["cascara", "platano"], 8.5, "Cascara de platano"),
        (["sobras", "almuerzo"], 8.5, "Sobras de comida"),
        (["hojas", "jardin"], 8.0, "Restos de jardin"),
    ],
    "trash": [
        (["mascarilla", "usada"], 10.0, "Mascarilla usada"),
        (["servilleta", "sucia"], 9.0, "Servilleta sucia"),
        (["papel", "higienico", "usado"], 10.0, "Papel higienico usado"),
        (["papel", "grasa"], 9.0, "Papel con grasa"),
        (["empaque", "metalizado"], 8.5, "Empaque metalizado"),
        (["muy", "sucio"], 8.0, "Residuo contaminado"),
    ],
}

MATERIAL_TERMS = {
    "paper": {"papel", "hoja", "hojas", "cuaderno", "libreta", "escuela", "colegio", "apuntes", "tarea", "escrita", "escritas", "impreso", "fotocopia", "folio"},
    "cardboard": {"carton", "caja", "corrugado", "huevera", "tetrapak"},
    "plastic": {"plastico", "plastica", "pet", "botella", "envase", "bolsa", "tupper", "blister"},
    "metal": {"metal", "metalico", "metalica", "lata", "aluminio", "aerosol", "clavo", "tornillo", "llave"},
    "glass": {"vidrio", "frasco", "cristal", "botella"},
    "battery": {"bateria", "pila", "power", "bank", "litio"},
}

APPAREL_TERMS = {
    "ropa",
    "prenda",
    "prendas",
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
}

EXPLICIT_DONATION_TERMS = {"donar", "donacion", "regalar", "regalo", "segunda mano", "marketplace"}
SANITARY_TERMS = {
    "panal",
    "panales",
    "papel higienico usado",
    "toalla sanitaria",
    "tampon",
    "mascarilla usada",
    "tapabocas usado",
    "guante quirurgico",
    "hisopo",
    "curita",
}
BEVERAGE_TERMS = {"jugo", "bebida", "gaseosa", "refresco", "soda", "energizante"}
BABY_CARE_TERMS = {"mi hijo", "mi hija", "bebe", "bebes", "nino pequeno", "nina pequena"}
UNUSED_CLEAN_TERMS = {
    "no los uso",
    "no lo uso",
    "no las uso",
    "ya no los uso",
    "ya no lo uso",
    "estan limpios",
    "estan sin usar",
    "limpios",
    "sin usar",
}


def _has_word(text: str, term: str) -> bool:
    return re.search(rf"\b{re.escape(term)}\b", text) is not None


def _has_any(text: str, terms: set[str]) -> bool:
    return any(_has_word(text, term) for term in terms)


def _match_phrase(text: str, phrase: str) -> bool:
    return phrase in text if " " in phrase else _has_word(text, phrase)


def _has_apparel_context(text: str) -> bool:
    return _has_any(text, APPAREL_TERMS)


def _has_explicit_donation(text: str) -> bool:
    return any(_match_phrase(text, term) for term in EXPLICIT_DONATION_TERMS)


def _has_sanitary_context(text: str) -> bool:
    explicit_sanitary = any(_match_phrase(text, term) for term in SANITARY_TERMS)
    baby_care = any(_match_phrase(text, term) for term in BABY_CARE_TERMS)
    unused_clean = any(_match_phrase(text, term) for term in UNUSED_CLEAN_TERMS)
    return explicit_sanitary or (baby_care and unused_clean and not _has_apparel_context(text))


def _detect_intents(normalized_text: str) -> dict[str, bool]:
    flags = {
        intent: any(_match_phrase(normalized_text, pattern) for pattern in patterns)
        for intent, patterns in INTENT_PATTERNS.items()
    }
    sanitary_context = _has_sanitary_context(normalized_text)
    if sanitary_context:
        flags["sanitary"] = True
        flags["donation"] = False
    elif flags.get("donation") and not (_has_apparel_context(normalized_text) or _has_explicit_donation(normalized_text)):
        flags["donation"] = False
    return flags


@dataclass(slots=True)
class SemanticSignals:
    probabilities: dict[str, float]
    matched_terms: dict[str, list[str]]
    detected_items: dict[str, str]
    text_scores: dict[str, float]
    image_scores: dict[str, float]
    strong_labels: set[str]
    white_ratio: float
    brown_ratio: float
    blue_ratio: float
    metallic_hint: float
    reusable_hint: bool
    intent_flags: dict[str, bool]


def _normalize_scores(scores: dict[str, float]) -> dict[str, float]:
    total = sum(max(score, 0.0) for score in scores.values())
    if total <= 0:
        return {label: 1.0 / max(len(scores), 1) for label in scores}
    return {label: max(score, 0.0) / total for label, score in scores.items()}


def _score_image_hints(image_path: str | Path) -> tuple[dict[str, float], dict[str, float]]:
    scores = {label: 0.0 for label in LABEL_FAMILIES}
    meta = {
        "white_ratio": 0.0,
        "brown_ratio": 0.0,
        "blue_ratio": 0.0,
        "metallic_hint": 0.0,
    }

    try:
        image = Image.open(image_path).convert("RGB").resize((96, 96))
        array = np.asarray(image, dtype=np.float32)
    except Exception:
        return scores, meta

    mean_rgb = array.mean(axis=(0, 1))
    brightness = float(mean_rgb.mean())
    saturation_proxy = float(np.mean(np.max(array, axis=2) - np.min(array, axis=2)))

    white_mask = (array[..., 0] > 185) & (array[..., 1] > 185) & (array[..., 2] > 185)
    brown_mask = (array[..., 0] > 120) & (array[..., 1] > 85) & (array[..., 2] < 105)
    blue_mask = (array[..., 2] > array[..., 0] + 20) & (array[..., 2] > array[..., 1] + 10)
    gray_mask = np.abs(array[..., 0] - array[..., 1]) < 18
    gray_mask &= np.abs(array[..., 1] - array[..., 2]) < 18

    white_ratio = float(np.mean(white_mask))
    brown_ratio = float(np.mean(brown_mask))
    blue_ratio = float(np.mean(blue_mask))
    gray_ratio = float(np.mean(gray_mask))
    metallic_hint = gray_ratio if 70 < brightness < 190 else 0.0

    meta["white_ratio"] = white_ratio
    meta["brown_ratio"] = brown_ratio
    meta["blue_ratio"] = blue_ratio
    meta["metallic_hint"] = metallic_hint

    if white_ratio > 0.32 and saturation_proxy < 38:
        scores["paper"] += 3.9

    if white_ratio > 0.50 and brightness > 175:
        scores["paper"] += 1.8

    if brown_ratio > 0.18:
        scores["cardboard"] += 3.2

    if blue_ratio > 0.16 and saturation_proxy > 20:
        scores["plastic"] += 2.0

    if white_ratio > 0.28 and blue_ratio > 0.04 and brightness > 145:
        scores["plastic"] += 3.4

    if metallic_hint > 0.45 and saturation_proxy < 28 and white_ratio < 0.30:
        scores["metal"] += 1.8

    if saturation_proxy > 45 and 70 < brightness < 185 and white_ratio < 0.28:
        scores["metal"] += 1.2
        scores["plastic"] += 0.8

    color_std = float(np.mean(np.std(array, axis=(0, 1))))
    if color_std > 42 and saturation_proxy > 38 and white_ratio < 0.42:
        scores["clothes"] += 2.6

    if color_std > 35 and 65 < brightness < 205 and saturation_proxy > 30:
        scores["shoes"] += 0.9

    if mean_rgb[1] > mean_rgb[0] + 16 and mean_rgb[1] > mean_rgb[2] + 12:
        scores["green-glass"] += 1.2

    if mean_rgb[0] > mean_rgb[1] > mean_rgb[2] and (mean_rgb[0] - mean_rgb[2]) > 34:
        scores["brown-glass"] += 1.1

    return scores, meta


def build_supported_objects(catalog: dict[str, Any]) -> dict[str, list[str]]:
    supported_objects: dict[str, list[str]] = {}

    for label, label_info in catalog["labels"].items():
        items = {
            label_info["display_name"],
            DEFAULT_ITEMS.get(label, label_info["display_name"]),
            *label_info.get("common_objects", []),
            *(item_name for _, _, item_name in ALIASES.get(label, [])),
        }
        supported_objects[label] = sorted(item for item in items if item)

    return supported_objects


def build_taxonomy_overview(
    catalog: dict[str, Any],
    supported_objects: dict[str, list[str]] | None = None,
) -> dict[str, Any]:
    supported_objects = supported_objects or build_supported_objects(catalog)
    labels = catalog["labels"]
    waste_streams = sorted({label_info["waste_stream"] for label_info in labels.values()})
    top_labels = sorted(
        (
            {
                "label_key": label,
                "label_display": label_info["display_name"],
                "supported_object_count": len(supported_objects.get(label, [])),
            }
            for label, label_info in labels.items()
        ),
        key=lambda item: (-item["supported_object_count"], item["label_display"]),
    )

    recyclable_label_count = sum(1 for label_info in labels.values() if label_info["recyclable"])

    return {
        "base_label_count": len(labels),
        "family_count": len(set(LABEL_FAMILIES.values())),
        "waste_stream_count": len(waste_streams),
        "waste_streams": waste_streams,
        "supported_item_count": sum(len(items) for items in supported_objects.values()),
        "recyclable_label_count": recyclable_label_count,
        "special_handling_label_count": len(labels) - recyclable_label_count,
        "top_labels": top_labels[:5],
    }


def analyze_semantics(normalize_text_fn: Any, image_path: str | Path, user_text: str) -> SemanticSignals:
    normalized = normalize_text_fn(user_text)
    scores = {label: 0.0 for label in LABEL_FAMILIES}
    matched_terms = {label: [] for label in LABEL_FAMILIES}
    detected_items = {label: DEFAULT_ITEMS[label] for label in LABEL_FAMILIES}
    best_item_weights = {label: 0.0 for label in LABEL_FAMILIES}

    for label, entries in ALIASES.items():
        for alias, weight, item_name in entries:
            if _has_word(normalized, alias) if " " not in alias else alias in normalized:
                scores[label] += weight
                matched_terms[label].append(alias)
                if weight > best_item_weights[label]:
                    detected_items[label] = item_name
                    best_item_weights[label] = weight

    for label, rules in CONTEXT_BOOSTS.items():
        for terms, weight, item_name in rules:
            if all(_has_word(normalized, term) for term in terms):
                scores[label] += weight
                matched_terms[label].append(" ".join(terms))
                if weight > best_item_weights[label]:
                    detected_items[label] = item_name
                    best_item_weights[label] = weight

    if "botella" in normalized and "vidrio" not in normalized and "plastico" not in normalized:
        scores["plastic"] += 2.0
        if detected_items["plastic"] == DEFAULT_ITEMS["plastic"]:
            detected_items["plastic"] = "Botella"

    if "frasco" in normalized and all(color not in normalized for color in ["verde", "cafe", "ambar"]):
        scores["white-glass"] += 2.2

    if "caja" in normalized and "papel" in normalized:
        scores["cardboard"] += 1.5

    if any(token in normalized for token in ["hojas", "folio", "papel bond"]):
        scores["paper"] += 2.0

    if _has_word(normalized, "agua") and any(_has_word(normalized, token) for token in ["compre", "comprada", "embotellada", "botella", "envase"]):
        scores["plastic"] += 8.0
        matched_terms["plastic"].append("agua comprada")
        detected_items["plastic"] = "Botella plastica de agua"
        scores["paper"] *= 0.20
        scores["cardboard"] *= 0.35

    if _has_any(normalized, MATERIAL_TERMS["paper"]):
        scores["paper"] += 4.0
        if not _has_any(normalized, MATERIAL_TERMS["metal"]):
            scores["metal"] *= 0.25

    if _has_any(normalized, MATERIAL_TERMS["cardboard"]):
        scores["cardboard"] += 3.0
        if not _has_any(normalized, MATERIAL_TERMS["metal"]):
            scores["metal"] *= 0.45

    intent_flags = _detect_intents(normalized)
    if intent_flags.get("sanitary"):
        scores["trash"] += 18.0
        scores["clothes"] *= 0.04
        scores["shoes"] *= 0.04
        scores["paper"] *= 0.25
        scores["plastic"] *= 0.30
        if not matched_terms["trash"]:
            matched_terms["trash"].append("residuo sanitario")
        if _has_word(normalized, "panal") or _has_word(normalized, "panales"):
            detected_items["trash"] = "Panal sanitario"
            matched_terms["trash"].append("panales" if _has_word(normalized, "panales") else "panal")
        elif intent_flags.get("baby_care"):
            detected_items["trash"] = "Panales o producto sanitario infantil"
            matched_terms["trash"].append("contexto bebe/hijo")
        else:
            detected_items["trash"] = "Residuo sanitario"

    reusable_hint = intent_flags["donation"] or intent_flags["reuse_container"] or any(
        token in normalized for token in ["taza", "mug", "vaso", "jarro", "reutilizable"]
    )
    if intent_flags.get("sanitary"):
        reusable_hint = False

    if reusable_hint and not any(token in normalized for token in ["vidrio", "plastico", "metal"]):
        scores["plastic"] += 1.0

    if intent_flags["donation"]:
        scores["clothes"] += 12.0
        scores["shoes"] += 7.0
        scores["trash"] *= 0.55
        if not _has_any(normalized, MATERIAL_TERMS["plastic"]):
            scores["plastic"] *= 0.18
        if not _has_any(normalized, MATERIAL_TERMS["paper"]):
            scores["paper"] *= 0.12
        if not _has_any(normalized, MATERIAL_TERMS["cardboard"]):
            scores["cardboard"] *= 0.20
        if detected_items["clothes"] == DEFAULT_ITEMS["clothes"]:
            detected_items["clothes"] = "Prenda para donar"
        if detected_items["shoes"] == DEFAULT_ITEMS["shoes"]:
            detected_items["shoes"] = "Calzado para donar"

    if intent_flags["repair"]:
        scores["clothes"] += 1.5
        scores["shoes"] += 1.5

    image_scores, image_meta = _score_image_hints(image_path)
    for label, score in image_scores.items():
        scores[label] += score

    beverage_context = _has_any(normalized, BEVERAGE_TERMS)
    if beverage_context and not any(matched_terms[label] for label in ["paper", "cardboard"]):
        scores["metal"] += 1.6 + min(image_scores.get("metal", 0.0), 2.0)
        scores["plastic"] += 1.2 + min(image_scores.get("plastic", 0.0), 1.6)
        scores["cardboard"] += 0.6
        matched_terms["metal"].append("bebida en envase")
        if detected_items["metal"] == DEFAULT_ITEMS["metal"]:
            detected_items["metal"] = "Envase de bebida"
        if image_meta["metallic_hint"] > 0.30 or _has_word(normalized, "lata"):
            scores["metal"] += 4.0
            detected_items["metal"] = "Lata de bebida"

    paper_like_image = image_scores.get("paper", 0.0) >= 2.5 or image_meta["white_ratio"] > 0.34
    paper_like_text = scores["paper"] >= 7.0 or bool(matched_terms["paper"])
    if paper_like_image and paper_like_text and not _has_any(normalized, MATERIAL_TERMS["metal"]):
        scores["paper"] += 8.0
        scores["metal"] *= 0.12

    plastic_water_text = "agua comprada" in matched_terms["plastic"] or any(
        term in matched_terms["plastic"] for term in ["agua que compre", "de agua que compre", "compre agua", "agua embotellada"]
    )
    plastic_like_image = image_scores.get("plastic", 0.0) >= 2.0 or image_meta["blue_ratio"] > 0.05
    if plastic_water_text and plastic_like_image:
        scores["plastic"] += 10.0
        scores["paper"] *= 0.08
        scores["cardboard"] *= 0.12

    if image_scores.get("metal", 0.0) > 0 and not _has_any(normalized, MATERIAL_TERMS["metal"]):
        if _has_any(normalized, MATERIAL_TERMS["paper"]) or _has_any(normalized, MATERIAL_TERMS["cardboard"]):
            scores["metal"] *= 0.20

    dataset_folder = Path(image_path).parent.name
    if dataset_folder in scores:
        scores[dataset_folder] += 4.5

    strong_labels = {
        label
        for label, score in scores.items()
        if score >= 6.5 or len(matched_terms[label]) >= 2 or image_scores.get(label, 0.0) >= 2.5
    }

    probabilities = _normalize_scores(scores)
    return SemanticSignals(
        probabilities=probabilities,
        matched_terms=matched_terms,
        detected_items=detected_items,
        text_scores=scores,
        image_scores=image_scores,
        strong_labels=strong_labels,
        white_ratio=image_meta["white_ratio"],
        brown_ratio=image_meta["brown_ratio"],
        blue_ratio=image_meta["blue_ratio"],
        metallic_hint=image_meta["metallic_hint"],
        reusable_hint=reusable_hint,
        intent_flags=intent_flags,
    )


def build_semantic_enrichment(
    label_key: str,
    final_probabilities: dict[str, float],
    catalog: dict[str, Any],
    semantic: SemanticSignals,
) -> dict[str, Any]:
    label_info = catalog["labels"][label_key]
    sorted_labels = sorted(final_probabilities.items(), key=lambda item: item[1], reverse=True)
    alternatives = [
        {
            "label_key": alt_label,
            "label_display": catalog["labels"][alt_label]["display_name"],
            "score": round(float(score), 4),
        }
        for alt_label, score in sorted_labels[1:4]
    ]

    matched_terms = semantic.matched_terms.get(label_key, [])
    detected_item = semantic.detected_items.get(label_key, label_info["display_name"])

    review_required = False
    review_reason = ""

    if final_probabilities.get(label_key, 0.0) < 0.42:
        review_required = True
        review_reason = "La confianza aun es baja; conviene confirmar el material manualmente."

    if label_key == "battery" and not semantic.matched_terms["battery"]:
        review_required = True
        review_reason = "La clase bateria requiere evidencia fuerte de texto o apariencia."

    if label_key in GLASS_LABELS and not any(semantic.matched_terms[label] for label in GLASS_LABELS) and semantic.image_scores.get(label_key, 0.0) < 1.0:
        review_required = True
        review_reason = "El subtipo exacto de vidrio no es totalmente seguro sin mas contexto."

    if semantic.reusable_hint:
        review_required = True
        review_reason = "Parece un objeto reutilizable; antes de desecharlo, considera si aun puede seguir en uso."

    has_text_support = bool(matched_terms)
    has_image_support = semantic.image_scores.get(label_key, 0.0) > 0.0

    if has_text_support and has_image_support:
        summary = f"EcoSort reconocio la descripcion ({', '.join(matched_terms[:4])}) y la foto acompana esa decision."
    elif has_text_support:
        summary = f"EcoSort priorizo tu descripcion: {', '.join(matched_terms[:4])}."
    elif has_image_support:
        summary = "EcoSort uso la foto para orientar la clasificacion. Agrega descripcion si quieres una recomendacion mas precisa."
    else:
        summary = "EcoSort combino foto y descripcion para elegir la recomendacion mas probable."

    user_guidance = build_user_guidance(label_key, detected_item, semantic)
    confidence = float(final_probabilities.get(label_key, 0.0))
    modality_evidence = build_modality_evidence(label_key, matched_terms, semantic)
    safety_level = infer_safety_level(label_key, semantic)
    decision_badges = build_decision_badges(label_key, confidence, safety_level, catalog, semantic)
    confidence_explanation = build_confidence_explanation(confidence, matched_terms, semantic, label_key)
    quick_verdict = build_quick_verdict(label_key, detected_item, catalog, safety_level, semantic)

    primary_actions = user_guidance.get("preparation_steps") or [label_info["primary_action"]]

    return {
        "family_display": LABEL_FAMILIES.get(label_key, label_info["waste_stream"]),
        "detected_item": detected_item,
        "matched_terms": matched_terms,
        "alternatives": alternatives,
        "decision_summary": summary,
        "quick_verdict": quick_verdict,
        "next_best_action": primary_actions[0],
        "confidence_explanation": confidence_explanation,
        "modality_evidence": modality_evidence,
        "safety_level": safety_level,
        "decision_badges": decision_badges,
        "material_cues": build_material_cues(label_key, detected_item, matched_terms, semantic),
        **user_guidance,
        "is_text_boosted": label_key in semantic.strong_labels,
        "review_required": review_required,
        "review_reason": review_reason,
    }


def _evidence_level(value: float, medium: float, high: float) -> str:
    if value >= high:
        return "fuerte"
    if value >= medium:
        return "media"
    return "debil"


def build_modality_evidence(
    label_key: str,
    matched_terms: list[str],
    semantic: SemanticSignals,
) -> list[dict[str, str]]:
    image_score = float(semantic.image_scores.get(label_key, 0.0))
    text_score = float(semantic.text_scores.get(label_key, 0.0))
    text_terms = ", ".join(matched_terms[:4]) if matched_terms else "sin terminos directos"

    if image_score > 0:
        image_detail = "La foto aporta color, brillo o textura compatible con la categoria."
    elif label_key == "trash" and semantic.intent_flags.get("sanitary") and semantic.image_scores.get("paper", 0.0) > 0:
        image_score = max(image_score, min(float(semantic.image_scores.get("paper", 0.0)), 2.0))
        image_detail = "La foto sugiere material blanco o absorbente; el texto evita confundirlo con papel reciclable."
    else:
        image_detail = "La foto no aporta una pista visual fuerte; una imagen mas centrada puede ayudar."

    return [
        {
            "source": "Foto",
            "signal": _evidence_level(image_score, medium=1.0, high=2.5),
            "detail": image_detail,
        },
        {
            "source": "Descripcion",
            "signal": _evidence_level(text_score, medium=4.0, high=8.0),
            "detail": f"Pistas usadas: {text_terms}.",
        },
        {
            "source": "Reglas EcoSort",
            "signal": "activa" if semantic.intent_flags and any(semantic.intent_flags.values()) else "base",
            "detail": build_rule_evidence_detail(label_key, semantic),
        },
    ]


def build_rule_evidence_detail(label_key: str, semantic: SemanticSignals) -> str:
    intents = semantic.intent_flags
    if intents.get("sanitary"):
        return "Se bloquea reuso/compost/reciclaje por residuo sanitario."
    if label_key == "battery" or intents.get("hazardous"):
        return "Se aplican reglas de residuo peligroso o manejo especial."
    if intents.get("sharp"):
        return "Se prioriza seguridad por posible borde filoso o cortante."
    if intents.get("donation") or intents.get("resale"):
        return "Se prioriza reuso, donacion o segunda mano antes de desechar."
    if intents.get("repair"):
        return "Se detecta oportunidad de reparar antes de botar."
    if intents.get("compost"):
        return "Se prioriza compostaje o flujo organico."
    if intents.get("wet") or intents.get("greasy") or intents.get("dirty"):
        return "La condicion de limpieza cambia la reciclabilidad."
    if intents.get("personal_data"):
        return "Se agregan pasos de privacidad antes del reciclaje."
    if intents.get("reuse_container"):
        return "Se recomienda reusar el envase o caja antes de reciclar."
    return "Se cruzan categoria, reciclabilidad y flujo de disposicion."


def infer_safety_level(label_key: str, semantic: SemanticSignals) -> str:
    intents = semantic.intent_flags
    if label_key == "battery" or intents.get("hazardous") or intents.get("sharp") or intents.get("sanitary"):
        return "alto"
    if label_key in GLASS_LABELS or intents.get("full") or intents.get("dirty") or intents.get("greasy"):
        return "medio"
    return "bajo"


def build_decision_badges(
    label_key: str,
    confidence: float,
    safety_level: str,
    catalog: dict[str, Any],
    semantic: SemanticSignals,
) -> list[str]:
    label_info = catalog["labels"][label_key]
    badges = [
        f"Confianza {int(round(confidence * 100))}%",
        f"Riesgo {safety_level}",
        label_info["waste_stream"],
    ]
    if label_info["recyclable"]:
        badges.append("Recuperable si esta limpio")
    else:
        badges.append("No va a reciclaje comun")
    if semantic.reusable_hint:
        badges.append("Reuso primero")
    if semantic.intent_flags.get("sanitary"):
        badges.append("Sanitario")
    if semantic.intent_flags.get("compost"):
        badges.append("Compostaje")
    return badges[:5]


def build_confidence_explanation(
    confidence: float,
    matched_terms: list[str],
    semantic: SemanticSignals,
    label_key: str,
) -> str:
    image_score = float(semantic.image_scores.get(label_key, 0.0))
    has_text = bool(matched_terms)
    has_image = image_score > 0
    if confidence >= 0.75 and has_text and has_image:
        return "Alta: la foto y la descripcion apuntan a la misma decision."
    if confidence >= 0.55 and (has_text or has_image):
        return "Media: hay una pista principal clara, pero conviene revisar detalles del material."
    if has_text and not has_image:
        return "Media-baja: el texto ayuda mas que la foto; usa una imagen mas clara si dudas."
    if has_image and not has_text:
        return "Media-baja: la foto ayuda, pero falta una descripcion corta del estado o material."
    return "Baja: EcoSort recomienda confirmar manualmente antes de desechar."


def build_quick_verdict(
    label_key: str,
    detected_item: str,
    catalog: dict[str, Any],
    safety_level: str,
    semantic: SemanticSignals,
) -> str:
    label_info = catalog["labels"][label_key]
    if label_key == "battery":
        return f"{detected_item}: llevalo a punto limpio; no lo mezcles con basura comun."
    if semantic.intent_flags.get("sanitary"):
        return f"{detected_item}: cierre seguro y basura comun; no va a donar, compost ni reciclaje."
    if safety_level == "alto":
        return f"{detected_item}: maneja con cuidado y separa antes de entregar."
    if semantic.reusable_hint:
        return f"{detected_item}: reusar, donar o reparar vale mas que botar."
    if label_key == "biological":
        return f"{detected_item}: separalo para compost u organicos si tu ciudad lo permite."
    if label_info["recyclable"]:
        return f"{detected_item}: puede recuperarse si esta limpio, vacio y separado."
    return f"{detected_item}: va a disposicion comun salvo que tenga partes recuperables."


def build_material_cues(
    label_key: str,
    detected_item: str,
    matched_terms: list[str],
    semantic: SemanticSignals,
) -> list[str]:
    cues = [detected_item]
    if matched_terms:
        cues.extend(matched_terms[:3])
    if semantic.intent_flags.get("dirty") or semantic.intent_flags.get("greasy"):
        cues.append("condicion: sucio o grasoso")
    if semantic.intent_flags.get("wet"):
        cues.append("condicion: mojado")
    if semantic.intent_flags.get("empty"):
        cues.append("condicion: vacio")
    if semantic.intent_flags.get("full"):
        cues.append("condicion: con contenido")
    if semantic.intent_flags.get("sanitary"):
        cues.append("condicion: sanitario")
    if label_key in GLASS_LABELS:
        cues.append("material: vidrio")
    return list(dict.fromkeys(cues))[:5]


def build_user_guidance(label_key: str, detected_item: str, semantic: SemanticSignals) -> dict[str, Any]:
    matched = set(semantic.matched_terms.get(label_key, []))
    intents = semantic.intent_flags
    is_school_paper = label_key == "paper" and bool(
        matched
        & {
            "escuela",
            "colegio",
            "universidad",
            "clase",
            "clases",
            "apunte",
            "apuntes",
            "tarea",
            "tareas",
            "cuaderno",
            "hojas escuela",
            "papeles escuela",
            "escuela escritas",
        }
    )
    is_water_bottle = label_key == "plastic" and bool(
        matched
        & {
            "agua que compre",
            "de agua que compre",
            "compre agua",
            "agua comprada",
            "agua embotellada",
            "envase de agua",
            "botellas de agua",
            "botella de agua",
            "botella agua",
            "agua compre",
        }
    )

    plans: dict[str, dict[str, Any]] = {
        "paper": {
            "primary_outcome": "Recuperar papel limpio para reciclaje seco o reuso.",
            "preparation_steps": [
                "Apila las hojas y mantenlas secas.",
                "Retira clips, espirales, plasticos o separadores que no sean papel.",
                "Rompe o raya datos personales antes de reciclar documentos.",
                "Reutiliza hojas en blanco como borrador antes de desecharlas.",
            ],
            "useful_options": [
                "Reciclar con papel y carton limpio.",
                "Reusar para apuntes, listas o borradores.",
                "Donar cuadernos con hojas limpias si aun sirven.",
            ],
            "avoid": [
                "No mezclar con servilletas usadas, papel sanitario o papel con grasa.",
                "No reciclar papel mojado, plastificado o encerado junto con hojas comunes.",
            ],
            "impact_note": "El papel limpio se aprovecha mejor cuando llega seco, separado y sin contaminantes.",
        },
        "cardboard": {
            "primary_outcome": "Aprovechar carton seco en reciclaje de papel y carton.",
            "preparation_steps": [
                "Aplasta la caja para ahorrar espacio.",
                "Retira cintas, plasticos, tecnopor o rellenos si puedes.",
                "Mantena el carton seco antes de llevarlo al contenedor.",
                "Separa partes con grasa o comida si la caja esta contaminada.",
            ],
            "useful_options": [
                "Reusar cajas firmes para guardar o enviar objetos.",
                "Reciclar carton seco y limpio.",
                "Compostar partes sin tinta pesada si tu sistema local lo acepta.",
            ],
            "avoid": [
                "No reciclar carton empapado.",
                "No mezclar carton con restos de comida.",
            ],
            "impact_note": "El carton compactado ocupa menos volumen y facilita la recuperacion.",
        },
        "plastic": {
            "primary_outcome": "Enviar plastico aceptado a reciclaje seco.",
            "preparation_steps": [
                "Vacia el envase por completo.",
                "Enjuaga si tuvo bebida, shampoo, comida o aceite.",
                "Aplasta botellas si el sistema local lo permite.",
                "Deja la tapa puesta solo si tu reciclador acepta tapas.",
            ],
            "useful_options": [
                "Reciclar botellas PET limpias.",
                "Reusar recipientes resistentes si estan en buen estado.",
                "Llevar envases de quimicos a punto limpio cuando corresponda.",
            ],
            "avoid": [
                "No reciclar envases con residuos peligrosos.",
                "No mezclar plasticos sucios con materiales limpios.",
            ],
            "impact_note": "El plastico limpio tiene mas probabilidad de ser aceptado y recuperado.",
        },
        "metal": {
            "primary_outcome": "Recuperar metal limpio en reciclaje seco.",
            "preparation_steps": [
                "Vacia la lata o envase.",
                "Enjuaga si tuvo comida o bebida.",
                "Aplasta latas si el centro local lo permite.",
                "Separa tapas filosas o piezas punzantes para evitar cortes.",
            ],
            "useful_options": [
                "Reciclar latas de aluminio o conserva limpias.",
                "Agrupar tapas metalicas en un envase seguro.",
                "Llevar aerosoles o envases especiales a punto limpio si aplica.",
            ],
            "avoid": [
                "No depositar aerosoles presurizados sin confirmar manejo local.",
                "No mezclar metales con residuos organicos.",
            ],
            "impact_note": "El metal se recicla muy bien cuando esta vacio y sin restos.",
        },
        "battery": {
            "primary_outcome": "Evitar contaminacion: requiere punto limpio o acopio especial.",
            "preparation_steps": [
                "No la abras, aplastes ni perfores.",
                "Cubre polos con cinta si es una bateria suelta.",
                "Guardala seca, separada de metales y lejos del calor.",
                "Llevala a un punto de acopio de pilas o residuos electronicos.",
            ],
            "useful_options": [
                "Punto limpio municipal.",
                "Tiendas o centros con recoleccion de pilas.",
                "Gestion de residuos electronicos.",
            ],
            "avoid": [
                "No va a basura comun.",
                "No va al reciclaje seco domestico.",
            ],
            "impact_note": "Una bateria mal dispuesta puede liberar metales y quimicos.",
        },
        "biological": {
            "primary_outcome": "Convertir restos organicos en compost o manejo organico.",
            "preparation_steps": [
                "Retira envolturas, ligas, stickers o plasticos.",
                "Deposita solo restos vegetales o comida aceptada por tu compost.",
                "Escurre liquidos para evitar malos olores.",
                "Si no hay compost, usa el contenedor de organicos o basura comun segun tu ciudad.",
            ],
            "useful_options": [
                "Compostaje casero o comunitario.",
                "Contenedor de organicos.",
                "Separar empaques para reciclaje si estan limpios.",
            ],
            "avoid": [
                "No mezclar con vidrio, metal o plastico.",
                "No poner residuos sanitarios en compost.",
            ],
            "impact_note": "Separar organicos reduce olor y evita contaminar reciclables.",
        },
        "clothes": {
            "primary_outcome": "Priorizar reuso, donacion o reciclaje textil.",
            "preparation_steps": [
                "Lava o seca la prenda si es posible.",
                "Revisa si puede donarse, repararse o convertirse en trapo.",
                "Separa prendas muy contaminadas de ropa reutilizable.",
                "Llevala a recoleccion textil si ya no sirve.",
            ],
            "useful_options": [
                "Donacion.",
                "Reparacion o reuso.",
                "Reciclaje textil.",
            ],
            "avoid": [
                "No donar ropa humeda o con contaminacion peligrosa.",
                "No mezclar textiles reutilizables con basura comun.",
            ],
            "impact_note": "La ropa suele tener mas valor ambiental si se reutiliza antes de reciclarse.",
        },
        "shoes": {
            "primary_outcome": "Priorizar reuso o recoleccion especializada de calzado.",
            "preparation_steps": [
                "Limpia y seca el par si aun puede usarse.",
                "Ata o junta ambos zapatos para no separarlos.",
                "Dona si conserva suela y estructura utiles.",
                "Busca reciclaje de calzado si esta muy desgastado.",
            ],
            "useful_options": [
                "Donacion si aun sirven.",
                "Reparacion basica.",
                "Reciclaje textil o de calzado.",
            ],
            "avoid": [
                "No mezclar calzado reutilizable con basura comun.",
                "No donar zapatos mojados o con mal estado sanitario.",
            ],
            "impact_note": "Reusar calzado evita descartar textiles, goma y plastico mezclados.",
        },
        "trash": {
            "primary_outcome": "Disponer de forma segura lo que no puede recuperarse.",
            "preparation_steps": [
                "Cierra o envuelve residuos sanitarios o de alto contacto.",
                "Separa cualquier pila, vidrio roto o objeto punzante.",
                "Deposita en basura comun si no tiene ruta de reciclaje.",
                "Reduce volumen si es seguro hacerlo.",
            ],
            "useful_options": [
                "Basura comun.",
                "Punto limpio si contiene partes peligrosas.",
                "Separar componentes reciclables limpios antes de desechar.",
            ],
            "avoid": [
                "No contaminar reciclables limpios con basura comun.",
                "No poner objetos cortantes sueltos.",
            ],
            "impact_note": "Separar lo no recuperable protege el flujo de reciclaje.",
        },
    }

    glass_plan = {
        "primary_outcome": "Recuperar vidrio limpio en el flujo de vidrio.",
        "preparation_steps": [
            "Vacia el frasco o botella.",
            "Enjuaga restos de comida, bebida o salsa.",
            "Retira tapas si puedes y depositalas segun su material.",
            "Si esta roto, envuelvelo o manipulalo con cuidado antes de llevarlo.",
        ],
        "useful_options": [
            "Reciclaje de vidrio.",
            "Reuso de frascos limpios.",
            "Punto seguro si esta roto o contaminado.",
        ],
        "avoid": [
            "No mezclar vidrio roto suelto con reciclables de mano.",
            "No incluir ceramica, loza o espejos con vidrio de envases.",
        ],
        "impact_note": "El vidrio de envases se recupera mejor cuando va limpio y separado por flujo.",
    }
    for glass_label in GLASS_LABELS:
        plans[glass_label] = glass_plan

    selected = dict(plans.get(label_key, plans["trash"]))

    if is_school_paper:
        selected.update(
            {
                "primary_outcome": "Dar una segunda vida a hojas escolares limpias antes de reciclarlas.",
                "preparation_steps": [
                    "Separa hojas limpias de hojas mojadas, plastificadas o con grasa.",
                    "Retira clips, grapas grandes, espirales, carpetas plasticas o separadores.",
                    "Reutiliza caras en blanco para borradores, ejercicios o listas.",
                    "Rompe nombres, notas privadas o datos personales antes de reciclar.",
                ],
                "useful_options": [
                    "Reusar hojas con espacio libre.",
                    "Reciclar hojas secas en papel y carton.",
                    "Donar cuadernos con hojas utiles.",
                ],
                "avoid": [
                    "No mezclar con servilletas usadas, papel higienico o papel con grasa.",
                    "No enviar hojas mojadas o plastificadas al reciclaje de papel.",
                ],
                "impact_note": "Las hojas escolares limpias son valiosas porque la fibra de papel se recupera bien si llega seca y separada.",
            }
        )

    if is_water_bottle:
        selected.update(
            {
                "primary_outcome": "La descripcion apunta a agua embotellada; EcoSort prioriza PET o envase plastico limpio.",
                "preparation_steps": [
                    "Vacia cualquier resto de agua.",
                    "Aplasta la botella para reducir volumen si tu sistema local lo permite.",
                    "Coloca la tapa con la botella solo si el reciclador acepta tapas; si no, separala.",
                    "Depositala en reciclaje seco o punto de recuperacion de plasticos.",
                ],
                "useful_options": [
                    "Reciclar como botella PET limpia.",
                    "Reusar temporalmente si esta en buen estado.",
                    "Agrupar botellas de agua para entrega por volumen.",
                ],
                "avoid": [
                    "No mezclar botellas con papel o carton limpio.",
                    "No dejar liquidos dentro antes de reciclar.",
                ],
                "impact_note": "Las botellas PET de agua se recuperan mejor cuando llegan vacias, compactadas y separadas de otros materiales.",
                "smart_reason": "Aunque escribas solo 'agua que compre', EcoSort lo interpreta como agua embotellada y refuerza plastico/PET.",
            }
        )

    if intents["donation"] and label_key in {"clothes", "shoes"}:
        item_name = "la prenda" if label_key == "clothes" else "el calzado"
        selected.update(
            {
                "primary_outcome": f"Como indicas que ya no te queda o ya no lo usas, EcoSort prioriza donacion si {item_name} esta en buen estado.",
                "preparation_steps": [
                    "Revisa que no tenga humedad, mal olor fuerte o contaminacion.",
                    "Limpiala o lavala antes de entregarla." if label_key == "clothes" else "Limpialo antes de entregarlo.",
                    "Dobla y separa lo que esta listo para donar de lo que necesita reparacion.",
                    "Si esta roto pero reparable, considera arreglo o reciclaje textil antes de basura comun.",
                ],
                "useful_options": [
                    "Donar a alguien que pueda usarlo.",
                    "Llevar a banco de ropa o recoleccion textil.",
                    "Vender, intercambiar o regalar si esta en buen estado.",
                ],
                "avoid": [
                    "No desechar ropa util solo porque ya no te queda.",
                    "No donar prendas humedas, con moho o contaminadas.",
                ],
                "impact_note": "La mejor opcion ambiental para textiles en buen estado suele ser alargar su vida util antes de reciclarlos.",
            }
        )

    if intents["resale"] and label_key in {"clothes", "shoes"}:
        selected["primary_outcome"] = "La descripcion sugiere segunda mano: vender, intercambiar o donar es mejor que desechar."
        selected["preparation_steps"] = [
            "Limpia y seca el articulo.",
            "Revisa costuras, cierres, suela o detalles visibles.",
            "Agrupalo con otros articulos en buen estado para venta, trueque o donacion.",
            "Si no pasa revision de uso, separalo para reciclaje textil o de calzado.",
        ]
        selected["useful_options"] = ["Venta de segunda mano", "Intercambio", "Donacion", "Reparacion menor"]

    if intents["repair"] and label_key in {"clothes", "shoes"}:
        selected["primary_outcome"] = "EcoSort detecta posibilidad de reparacion: intenta arreglar antes de desechar."
        selected["preparation_steps"] = [
            "Identifica si el dano es reparable: costura, cierre, boton, suela o pegado.",
            "Si la reparacion es simple, arreglalo o llevalo a un taller.",
            "Si no se puede reparar, separalo para reciclaje textil o de calzado.",
            "Desecha en basura comun solo si esta contaminado o sin ruta de recuperacion.",
        ]
        selected["useful_options"] = ["Reparar", "Reusar", "Donar tras reparar", "Reciclaje textil"]

    if intents["dirty"] and label_key in {"clothes", "shoes"}:
        selected["preparation_steps"] = [
            "Limpia o lava antes de donar o reciclar.",
            "Si tiene contaminacion fuerte, separalo de prendas reutilizables.",
            "Cuando este seco, decide entre donacion, reparacion o reciclaje textil.",
        ]
        selected["avoid"] = [
            "No donar prendas con mal olor, moho o suciedad fuerte.",
            "No mezclar textiles sucios con ropa lista para reuso.",
        ]

    if intents.get("sanitary") and label_key == "trash":
        selected["primary_outcome"] = "Residuo sanitario: proteger a otras personas y evitar contaminar reciclables."
        selected["preparation_steps"] = [
            "No lo abras ni lo mezcles con reciclaje.",
            "Envuelvelo o cierralo en una bolsa resistente.",
            "Si esta humedo, usa doble bolsa para evitar derrames.",
            "Depositalo en basura comun o flujo sanitario local.",
        ]
        selected["useful_options"] = [
            "Basura comun cerrada.",
            "Contenedor sanitario si existe.",
            "Lavarse las manos despues de manipularlo.",
        ]
        selected["avoid"] = [
            "No va a compost.",
            "No va a reciclaje seco.",
            "No debe donarse ni reutilizarse.",
        ]
        selected["impact_note"] = "Separar residuos sanitarios evita riesgos de higiene y mantiene limpio el reciclaje."

    if intents["reuse_container"] and label_key in {"white-glass", "green-glass", "brown-glass", "plastic", "cardboard"}:
        selected["primary_outcome"] = "EcoSort detecta posibilidad de reuso: prioriza usarlo de nuevo antes de reciclar."
        selected["preparation_steps"] = [
            "Limpia y seca el envase o caja.",
            "Revisa que no tenga olores, grasa o residuos peligrosos.",
            "Usalo para guardar objetos, organizar materiales o transportar cosas.",
            "Recicla solo cuando ya no sea util o este danado.",
        ]
        selected["useful_options"] = ["Reusar en casa", "Guardar objetos", "Organizar materiales", "Reciclar al final de su vida util"]

    if intents["empty"] and label_key in {"plastic", "metal", "white-glass", "green-glass", "brown-glass"}:
        selected["preparation_steps"] = [
            "Confirma que este vacio y sin liquidos.",
            "Enjuaga si tuvo comida, bebida, shampoo, salsa o aceite.",
            "Separa tapa, etiqueta o piezas externas solo si tu sistema local lo pide.",
            "Depositalo en el flujo de reciclaje correspondiente.",
        ]
        selected["smart_reason"] = "Como indicas que esta vacio, EcoSort prioriza limpieza breve y reciclaje del material."

    if intents["full"] and label_key in {"plastic", "metal", "white-glass", "green-glass", "brown-glass"}:
        selected["primary_outcome"] = "Antes de reciclar, el envase debe quedar vacio y seguro."
        selected["preparation_steps"] = [
            "No lo pongas lleno en reciclaje.",
            "Usa, dona o dispone el contenido segun corresponda.",
            "Enjuaga el envase si el contenido no era peligroso.",
            "Si contenia quimicos, busca punto limpio o manejo especial.",
        ]
        selected["avoid"] = ["No mezclar envases llenos con reciclables limpios.", "No vaciar quimicos al desague."]

    if intents["personal_data"] and label_key == "paper":
        selected["preparation_steps"] = [
            "Separa papeles limpios y secos.",
            "Rompe, raya o tritura datos personales antes de reciclar.",
            "Retira clips, grapas grandes, plasticos o carpetas.",
            "Apila el papel para reciclaje seco.",
        ]
        selected["avoid"] = [
            "No depositar documentos con datos sensibles sin romperlos.",
            *selected.get("avoid", [])[:1],
        ]

    if (intents["wet"] or intents["greasy"]) and label_key in {"paper", "cardboard"}:
        selected["primary_outcome"] = "La humedad o grasa puede impedir el reciclaje de papel y carton."
        selected["preparation_steps"] = [
            "Separa las partes limpias y secas que si pueden reciclarse.",
            "Retira o corta las zonas mojadas, grasosas o con comida.",
            "Recicla solo la parte seca y limpia.",
            "La parte contaminada va a basura comun o compost si es organica y tu sistema lo permite.",
        ]
        selected["avoid"] = [
            "No mezclar papel o carton grasoso con material limpio.",
            "No cerrar bolsas con papel humedo porque puede contaminar el lote.",
        ]

    if intents["compost"] and label_key == "biological":
        selected["primary_outcome"] = "Tu descripcion sugiere compostaje: EcoSort prioriza convertirlo en abono."
        selected["preparation_steps"] = [
            "Retira plasticos, stickers, ligas o empaques.",
            "Corta restos grandes para acelerar el compostaje.",
            "Mezcla con material seco como hojas secas o carton sin tinta pesada.",
            "Evita exceso de liquido para controlar olores.",
        ]
        selected["useful_options"] = ["Compost casero", "Compost comunitario", "Contenedor de organicos", "Abono para jardin"]

    if intents["bulk"]:
        selected["preparation_steps"] = [
            *selected.get("preparation_steps", [])[:3],
            "Si tienes muchos articulos, agrupalo por material antes de llevarlo al punto de entrega.",
        ]
        selected["impact_note"] = "Cuando hay volumen, separar por material mejora la recuperacion y hace mas rapida la entrega."

    if intents["hazardous"] and label_key in {"plastic", "metal", "white-glass", "green-glass", "brown-glass", "battery"}:
        selected["primary_outcome"] = "EcoSort detecta posible riesgo: confirma manejo especial antes de reciclar."
        selected["preparation_steps"] = [
            "No mezcles este residuo con reciclaje comun si tuvo quimicos o esta danado.",
            "Mantelo cerrado, seco y lejos de calor.",
            "Consulta punto limpio o recoleccion especial.",
            "Recicla solo si el envase esta vacio, limpio y aceptado localmente.",
        ]
        selected["useful_options"] = ["Punto limpio", "Recoleccion especial", "Reciclaje solo si esta limpio y aceptado"]

    if intents["sharp"] and label_key in {"metal", "white-glass", "green-glass", "brown-glass", "trash"}:
        selected["primary_outcome"] = "EcoSort detecta riesgo de corte: primero hay que proteger a quien manipula el residuo."
        selected["preparation_steps"] = [
            "Envuelve puntas o bordes filosos en papel grueso o carton.",
            "Colocalo en un recipiente rigido si es pequeno.",
            "Marca o separa el paquete si va a basura comun.",
            "Llevalo a punto seguro si el material es vidrio o metal recuperable.",
        ]
        selected["avoid"] = ["No dejar objetos filosos sueltos.", "No mezclar vidrio roto con papel o plastico reciclable."]

    selected["recommendation_title"] = f"Plan para {detected_item}"
    selected.setdefault("smart_reason", build_smart_reason(label_key, detected_item, intents))
    return selected


def build_smart_reason(label_key: str, detected_item: str, intents: dict[str, bool]) -> str:
    if intents.get("sanitary"):
        return "La descripcion menciona un residuo sanitario; EcoSort bloquea donacion, compost y reciclaje seco."
    if intents["resale"] and label_key in {"clothes", "shoes"}:
        return "La descripcion sugiere segunda mano; EcoSort prioriza vender, intercambiar o donar antes de reciclar."
    if intents["donation"] and label_key in {"clothes", "shoes"}:
        return f"Tu descripcion sugiere que {detected_item.lower()} aun podria servir; por eso EcoSort prioriza donacion o reuso."
    if intents["repair"] and label_key in {"clothes", "shoes"}:
        return "La descripcion sugiere reparacion posible, asi que conviene intentar arreglar antes de desechar."
    if intents["hazardous"]:
        return "La descripcion menciona posible riesgo, asi que EcoSort prioriza manejo especial."
    if intents["sharp"]:
        return "La descripcion sugiere riesgo de corte, por eso EcoSort prioriza seguridad antes de disposicion."
    if intents["reuse_container"]:
        return "La descripcion sugiere que el objeto puede reutilizarse antes de ir a reciclaje."
    if intents["empty"] and label_key in {"plastic", "metal", "white-glass", "green-glass", "brown-glass"}:
        return "La descripcion indica que esta vacio; EcoSort puede recomendar reciclaje con limpieza simple."
    if intents["full"] and label_key in {"plastic", "metal", "white-glass", "green-glass", "brown-glass"}:
        return "La descripcion indica que aun tiene contenido; EcoSort evita mandarlo directo a reciclaje."
    if intents["compost"] and label_key == "biological":
        return "La descripcion apunta a compostaje, asi que EcoSort prioriza convertir el residuo organico en abono."
    if intents["personal_data"] and label_key == "paper":
        return "Como podria contener datos personales, EcoSort recomienda romper o tachar informacion sensible."
    if (intents["wet"] or intents["greasy"]) and label_key in {"paper", "cardboard"}:
        return "La humedad o grasa cambia la recomendacion porque puede contaminar el reciclaje de papel y carton."
    if intents["dirty"]:
        return "La descripcion indica suciedad; EcoSort ajusta los pasos de limpieza antes de recuperar el material."
    return "EcoSort ajusto la recomendacion combinando categoria, descripcion y reglas de manejo."
