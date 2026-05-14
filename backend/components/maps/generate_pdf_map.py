import os
from io import BytesIO
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import (
    A0, A1, A2, A3, A4, A5, A6, A7, A8, A9, A10,
    B0, B1, B2, B3, B4, B5, B6, B7, B8, B9, B10,
    C0, C1, C2, C3, C4, C5, C6, C7, C8, C9, C10,
    letter, legal
)
import cairosvg
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
        "LETTER": letter,
        "LEGAL": legal,
    }

    size_key = str(size_str or "A4").upper()
    size = sizes.get(size_key, A4)

    return (size[1], size[0]) if landscape else size


def _flatten_transparency(image, background=(255, 255, 255)):
    """
    PDF kann Transparenz je nach Viewer/Workflow unterschiedlich behandeln.
    Für stabile Raster-PDF-Ausgabe wird RGBA sauber auf Hintergrund gelegt.
    """
    if image.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", image.size, background)

        if image.mode == "RGBA":
            bg.paste(image, mask=image.getchannel("A"))
        else:
            rgba = image.convert("RGBA")
            bg.paste(rgba, mask=rgba.getchannel("A"))

        return bg

    if image.mode != "RGB":
        return image.convert("RGB")

    return image


def _resize_for_pdf(image, target_width_pt, target_height_pt, dpi=300, fit_mode="contain"):
    """
    Erzeugt ein für PDF passendes Rasterbild.

    ReportLab arbeitet in Points.
    1 inch = 72 pt.
    dpi bestimmt, wie viele Pixel für die Zielgröße verwendet werden.
    """
    target_px_w = max(1, int((target_width_pt / 72.0) * dpi))
    target_px_h = max(1, int((target_height_pt / 72.0) * dpi))

    fit_mode = str(fit_mode or "contain").lower()

    if fit_mode == "stretch":
        return image.resize((target_px_w, target_px_h), Image.LANCZOS)

    img_w, img_h = image.size

    if fit_mode == "cover":
        scale = max(target_px_w / img_w, target_px_h / img_h)

        new_w = max(1, int(img_w * scale))
        new_h = max(1, int(img_h * scale))

        resized = image.resize((new_w, new_h), Image.LANCZOS)

        left = max(0, int((new_w - target_px_w) / 2))
        top = max(0, int((new_h - target_px_h) / 2))

        return resized.crop((
            left,
            top,
            left + target_px_w,
            top + target_px_h,
        ))

    # Default: contain
    scale = min(target_px_w / img_w, target_px_h / img_h)

    new_w = max(1, int(img_w * scale))
    new_h = max(1, int(img_h * scale))

    return image.resize((new_w, new_h), Image.LANCZOS)


def generate_pdf_map(
    image,
    margin_mm,
    paper_size,
    landscape,
    export_path,
    fit_mode="contain",
    dpi=300,
    background=(255, 255, 255),
    align_x="center",
    align_y="center",
):
    """
    Rasterbasierter PDF Export.

    landscape steuert allein die Ausrichtung.
    Es gibt keine automatische Orientierung.

    fit_mode:
        contain  = Bild vollständig sichtbar, Content-Fläche maximal ausgenutzt
        cover    = Content-Fläche komplett gefüllt, ggf. Crop
        stretch  = exakt auf Content-Fläche verzerrt
    """
    if not isinstance(image, Image.Image):
        raise ValueError("generate_pdf_map erwartet ein PIL.Image Objekt.")

    if dpi is None:
        dpi = 300

    dpi = int(dpi)
    dpi = max(72, min(dpi, 600))

    margin_mm = float(margin_mm or 0)
    margin_pt = max(0, margin_mm * mm)

    page_width, page_height = get_paper_size(paper_size, landscape)

    content_width = max(1, page_width - 2 * margin_pt)
    content_height = max(1, page_height - 2 * margin_pt)

    img_width, img_height = image.size
    image = _flatten_transparency(image, background=background)

    fit_mode = str(fit_mode or "contain").lower()

    if fit_mode == "stretch":
        draw_width = content_width
        draw_height = content_height

        pdf_image = _resize_for_pdf(
            image,
            draw_width,
            draw_height,
            dpi=dpi,
            fit_mode="stretch",
        )

    elif fit_mode == "cover":
        draw_width = content_width
        draw_height = content_height

        pdf_image = _resize_for_pdf(
            image,
            draw_width,
            draw_height,
            dpi=dpi,
            fit_mode="cover",
        )

    else:
        img_ratio = img_width / img_height
        content_ratio = content_width / content_height

        if img_ratio >= content_ratio:
            draw_width = content_width
            draw_height = content_width / img_ratio
        else:
            draw_height = content_height
            draw_width = content_height * img_ratio

        pdf_image = _resize_for_pdf(
            image,
            draw_width,
            draw_height,
            dpi=dpi,
            fit_mode="contain",
        )

    align_x = str(align_x or "center").lower()
    align_y = str(align_y or "center").lower()

    if align_x == "left":
        x = margin_pt
    elif align_x == "right":
        x = page_width - margin_pt - draw_width
    else:
        x = margin_pt + (content_width - draw_width) / 2

    if align_y == "bottom":
        y = margin_pt
    elif align_y == "top":
        y = page_height - margin_pt - draw_height
    else:
        y = margin_pt + (content_height - draw_height) / 2

    img_buffer = BytesIO()
    pdf_image.save(img_buffer, format="PNG")
    img_buffer.seek(0)

    c = canvas.Canvas(export_path, pagesize=(page_width, page_height))

    c.drawImage(
        ImageReader(img_buffer),
        x,
        y,
        width=draw_width,
        height=draw_height,
        preserveAspectRatio=False,
        mask="auto",
    )

    c.showPage()
    c.save()

    return export_path


def generate_vector_pdf_map(
    svg_data,
    margin_mm,
    paper_size,
    landscape,
    export_path,
    fit_mode="contain",
    dpi=300,
    viewport_width=None,
    viewport_height=None,
    background="#ffffff",
):
    """
    Vektorbasierter PDF Export.

    landscape steuert allein die Ausrichtung.
    Es gibt keine automatische Orientierung.

    Erwartet ein vollständiges SVG-Dokument als String.
    SVG-Formen bleiben Vektor.
    Text, der vorher zu SVG-Pfaden konvertiert wurde, bleibt Vektor.
    Rasterlayer bleiben eingebettete PNGs.
    """
    if not svg_data:
        raise ValueError("generate_vector_pdf_map erwartet SVG-Daten.")

    if dpi is None:
        dpi = 300

    dpi = int(dpi)
    dpi = max(72, min(dpi, 600))

    margin_mm = float(margin_mm or 0)
    margin_pt = max(0, margin_mm * mm)

    page_width, page_height = get_paper_size(paper_size, landscape)

    viewport_width = int(viewport_width or 1024)
    viewport_height = int(viewport_height or 1024)

    content_width = max(1, page_width - 2 * margin_pt)
    content_height = max(1, page_height - 2 * margin_pt)

    fit_mode = str(fit_mode or "contain").lower()

    if fit_mode == "stretch":
        scale_x = content_width / viewport_width
        scale_y = content_height / viewport_height

        x = margin_pt
        y = margin_pt

        transform = f"translate({x} {y}) scale({scale_x} {scale_y})"

    else:
        if fit_mode == "cover":
            scale = max(
                content_width / viewport_width,
                content_height / viewport_height,
            )
        else:
            scale = min(
                content_width / viewport_width,
                content_height / viewport_height,
            )

        draw_width = viewport_width * scale
        draw_height = viewport_height * scale

        x = margin_pt + (content_width - draw_width) / 2
        y = margin_pt + (content_height - draw_height) / 2

        transform = f"translate({x} {y}) scale({scale})"

    inner_svg = _strip_svg_outer(svg_data)

    clip_id = "pdf-content-clip"

    if fit_mode == "cover":
        clip_def = (
            f'<clipPath id="{clip_id}">'
            f'<rect x="{margin_pt}" y="{margin_pt}" '
            f'width="{content_width}" height="{content_height}" />'
            f'</clipPath>'
        )
        clip_attr = f'clip-path="url(#{clip_id})"'
    else:
        clip_def = ""
        clip_attr = ""

    page_svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{page_width}pt"
     height="{page_height}pt"
     viewBox="0 0 {page_width} {page_height}">
    <defs>
        {clip_def}
    </defs>
    <rect x="0" y="0" width="{page_width}" height="{page_height}" fill="{background}" />
    <g {clip_attr} transform="{transform}">
        {inner_svg}
    </g>
</svg>
'''

    cairosvg.svg2pdf(
        bytestring=page_svg.encode("utf-8"),
        write_to=export_path,
        dpi=dpi,
    )

    return export_path


def _strip_svg_outer(svg_data):
    data = str(svg_data or "").strip()

    start = data.find("<svg")
    if start < 0:
        return data

    open_end = data.find(">", start)
    close_start = data.rfind("</svg>")

    if open_end < 0 or close_start < 0 or close_start <= open_end:
        return data

    return data[open_end + 1:close_start].strip()