import os
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import (
    A0, A1, A2, A3, A4, A5, A6, A7, A8, A9, A10,
    B0, B1, B2, B3, B4, B5, B6, B7, B8, B9, B10,
    C0, C1, C2, C3, C4, C5, C6, C7, C8, C9, C10,
    letter, legal
)
from reportlab.lib.utils import ImageReader
from reportlab.lib.units import mm


def get_paper_size(size_str, landscape=False):
    sizes = {
        "A0": A0, "A1": A1, "A2": A2, "A3": A3, "A4": A4, "A5": A5,
        "A6": A6, "A7": A7, "A8": A8, "A9": A9, "A10": A10,
        "B0": B0, "B1": B1, "B2": B2, "B3": B3, "B4": B4, "B5": B5,
        "B6": B6, "B7": B7, "B8": B8, "B9": B9, "B10": B10,
        "C0": C0, "C1": C1, "C2": C2, "C3": C3, "C4": C4, "C5": C5,
        "C6": C6, "C7": C7, "C8": C8, "C9": C9, "C10": C10,
        "LETTER": letter, "LEGAL": legal
    }

    size_str_upper = size_str.upper()
    if size_str_upper not in sizes:
        print(f"[WARN] Unbekanntes Papierformat '{size_str}' – fallback auf A4.")
    size = sizes.get(size_str_upper, A4)

    print(f"[DEBUG] get_paper_size('{size_str}', landscape={landscape}) = {size}")

    return (size[1], size[0]) if landscape else size


def generate_pdf_map(
    image,
    margin_mm,
    paper_size,
    landscape,
    export_path
):
    # Papiergröße holen
    page_width, page_height = get_paper_size(paper_size, landscape)
    margin_pt = margin_mm * mm

    # Verfügbare Fläche berechnen
    content_width = page_width - 2 * margin_pt
    content_height = page_height - 2 * margin_pt

    img_width, img_height = image.size

    # Falls Bild kleiner als verfügbarer Platz → nicht skalieren
    if img_width <= content_width and img_height <= content_height:
        target_width = img_width
        target_height = img_height
        resized_image = image
    else:
        # Ansonsten proportional skalieren
        scale = min(content_width / img_width, content_height / img_height)
        target_width = int(img_width * scale)
        target_height = int(img_height * scale)
        resized_image = image.resize((target_width, target_height), Image.LANCZOS)

    # PDF erzeugen
    c = canvas.Canvas(export_path, pagesize=(page_width, page_height))
    img_reader = ImageReader(resized_image)

    # Zentrierung auf Seite
    x = (page_width - target_width) / 2
    y = (page_height - target_height) / 2

    c.drawImage(img_reader, x, y, width=target_width, height=target_height)
    c.showPage()
    c.save()
