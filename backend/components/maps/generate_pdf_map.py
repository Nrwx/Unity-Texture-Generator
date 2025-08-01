import os
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, A3, letter
from reportlab.lib.utils import ImageReader
from reportlab.lib.units import mm


def get_paper_size(size_str, landscape=False):
    sizes = {
        "A4": A4,
        "A3": A3,
        "Brief": letter
    }
    size = sizes.get(size_str.upper(), A4)
    return (size[1], size[0]) if landscape else size


def generate_pdf_map(
    image: Image.Image,
    margin: int,
    paperSize: str,
    landscape: bool,
    export_path: str
):
    page_width, page_height = get_paper_size(paperSize, landscape)
    margin_pt = margin * mm
    content_width = page_width - 2 * margin_pt
    content_height = page_height - 2 * margin_pt

    # Bild skalieren
    scale = min(content_width / image.width, content_height / image.height)
    target_width = int(image.width * scale)
    target_height = int(image.height * scale)
    resized = image.resize((target_width, target_height), Image.LANCZOS)

    # PDF erzeugen
    c = canvas.Canvas(export_path, pagesize=(page_width, page_height))
    img_reader = ImageReader(resized)
    x = (page_width - target_width) / 2
    y = (page_height - target_height) / 2
    c.drawImage(img_reader, x, y, width=target_width, height=target_height)
    c.showPage()
    c.save()
