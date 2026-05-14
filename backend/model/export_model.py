# model/export_model.py
import os
import uuid
import base64
import html
import re
import math
from io import BytesIO

from PIL import Image
import cairosvg

from model.base.main import BaseModel
from generated.paths import PUBLIC_LAYER_FOLDER, PUBLIC_TEMP_UPLOAD_FOLDER
from config.data.constant import VIEWPORT_CONFIG, LAYERS
from model.fonts_model import FontsModel
from components import generate_pdf_map, generate_vector_pdf_map, generate_tga_map, generate_dds_map
from utils import layer_transform, alpha_as_bg
from typing import Dict, Any, Optional, Iterable, Callable


class ExportModel(BaseModel):
    @classmethod
    def _nvcompress(cls):
        try:
            reg = syslink.get("registry")
            value = reg.get("NVCOMPRESS_PATH")

            if isinstance(value, dict) and "value" in value:
                value = value.get("value")

            if value:
                return os.path.abspath(os.path.expanduser(str(value)))
        except Exception:
            pass

        return None

    # -------------------------------------------------------------------------
    # Generic Helpers
    # -------------------------------------------------------------------------

    @staticmethod
    def _to_bool(value, default=False):
        if isinstance(value, bool):
            return value

        if value is None:
            return default

        if isinstance(value, (int, float)):
            return bool(value)

        if isinstance(value, str):
            return value.strip().lower() in ("1", "true", "yes", "on", "y")

        return default

    # -------------------------------------------------------------------------
    # SVG Helpers
    # -------------------------------------------------------------------------

    @staticmethod
    def _svg_escape(value):
        return html.escape(str(value or ""), quote=True)

    @staticmethod
    def _image_to_png_data_uri(image):
        if image.mode != "RGBA":
            image = image.convert("RGBA")

        buffer = BytesIO()
        image.save(buffer, format="PNG")

        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return f"data:image/png;base64,{encoded}"

    @staticmethod
    def _file_to_data_uri(path, mime="image/png"):
        with open(path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("ascii")

        return f"data:{mime};base64,{encoded}"

    @classmethod
    def _svg_opacity(cls, layer):
        try:
            opacity = float(layer.get("opacity", 1))
        except Exception:
            opacity = 1

        return max(0, min(opacity, 1))

    @classmethod
    def _svg_transform(cls, layer):
        """
        Transform für lokale SVG-Inhalte, z.B. Text-Pfade oder eingebettete Rasterbilder.

        Entspricht grob:
            translate(x, y)
            rotate(...)
            scale/matrix(...)
        """
        matrix = layer.get("matrix", {}) or {}

        a = float(matrix.get("a", 1))
        b = float(matrix.get("b", 0))
        c = float(matrix.get("c", 0))
        d = float(matrix.get("d", 1))
        x = float(matrix.get("x", 0))
        y = float(matrix.get("y", 0))
        rotate = float(matrix.get("rotate", 0))

        width = float(layer.get("width", 0) or 0)
        height = float(layer.get("height", 0) or 0)

        if width <= 0:
            width = 1

        if height <= 0:
            height = 1

        cx = width / 2
        cy = height / 2

        transforms = []

        transforms.append(f"translate({x} {y})")

        if rotate:
            transforms.append(f"rotate({rotate} {cx} {cy})")

        if not (a == 1 and b == 0 and c == 0 and d == 1):
            transforms.append(f"translate({cx} {cy})")
            transforms.append(f"matrix({a} {b} {c} {d} 0 0)")
            transforms.append(f"translate({-cx} {-cy})")

        return " ".join(transforms)

    @classmethod
    def _svg_layer_transform_matrix_like_raster(cls, layer):
        """
        SVG-Matrix für Shape-Layer, passend zu utils.layer_transform().

        Dein Raster-Helper macht:
            1. rotate(-angle, expand=True, center=original_center)
            2. resize(scale_x, scale_y)
            3. paste_x = pos_x - offset_x
               paste_y = pos_y - offset_y

        Diese Methode erzeugt eine SVG matrix(a b c d e f), die denselben
        visuellen Effekt für lokal normalisierte SVG-Formen erzeugt.

        Wichtig:
            - SVG-Inhalt muss vorher per viewBox-Normalisierung lokal sein.
            - matrix.b/c werden absichtlich nicht als Shear genutzt, weil
              layer_transform() aktuell auch nur a und d als scale_x/scale_y nutzt.
        """
        matrix = layer.get("matrix", {}) or {}

        scale_x = float(matrix.get("a", 1))
        scale_y = float(matrix.get("d", 1))
        pos_x = float(matrix.get("x", 0))
        pos_y = float(matrix.get("y", 0))
        rotate = float(matrix.get("rotate", 0))

        width = float(layer.get("width", 0) or 0)
        height = float(layer.get("height", 0) or 0)

        if width <= 0:
            width = 1

        if height <= 0:
            height = 1

        cx = width / 2
        cy = height / 2

        # PIL nutzt img.rotate(-rotate_angle).
        # In SVG mit y-down entspricht rotate(+angle) meistens derselben visuellen Richtung.
        angle = math.radians(rotate)
        cos_a = math.cos(angle)
        sin_a = math.sin(angle)

        # Rotation um Center, danach nicht-uniforme Skalierung wie beim gerenderten Bild.
        # SVG matrix:
        #   x' = a*x + c*y + e
        #   y' = b*x + d*y + f
        a = scale_x * cos_a
        b = scale_y * sin_a
        c = -scale_x * sin_a
        d = scale_y * cos_a

        # Entspricht der vereinfachten layer_transform-Positionierung.
        # Herleitung aus:
        #   paste_x = pos_x - (rotated_scaled_width/2 - original_width/2)
        #   plus Rotation um original center.
        e = pos_x + cx + scale_x * (-cos_a * cx + sin_a * cy)
        f = pos_y + cy + scale_y * (-sin_a * cx - cos_a * cy)

        if (
            abs(a - 1) < 1e-9
            and abs(b) < 1e-9
            and abs(c) < 1e-9
            and abs(d - 1) < 1e-9
            and abs(e) < 1e-9
            and abs(f) < 1e-9
        ):
            return ""

        return f"matrix({a} {b} {c} {d} {e} {f})"

    @classmethod
    def _svg_vector_layer_transform(cls, layer):
        """
        Shape-Layer-Transform.

        Shape-SVGs aus generate_svg_map() haben eigene viewBox-Werte und Pfade
        mit ursprünglichen Koordinaten. Deshalb wird der Inhalt über
        _extract_svg_inner() lokal normalisiert und diese Matrix übernimmt danach
        x/y, scale und rotate.
        """
        return cls._svg_layer_transform_matrix_like_raster(layer)

    @classmethod
    def _extract_svg_inner(cls, svg_data):
        """
        Extrahiert den inneren Inhalt einer SVG und normalisiert die viewBox.

        generate_svg_map() erzeugt z.B.:
            <svg viewBox="min_x min_y width height" width="width" height="height">
                <path d="M absolute_x absolute_y ..." />
            </svg>

        Wenn man nur den inneren Pfad übernimmt, bleiben die alten absoluten
        Koordinaten erhalten. Deshalb wird hier ein:
            translate(-min_x, -min_y)
        um den Inhalt gelegt.

        Danach liegt der Shape-Inhalt lokal bei 0/0 und kann sauber über
        layer.matrix transformiert werden.
        """
        data = str(svg_data or "").strip()

        start = data.find("<svg")
        if start < 0:
            return data

        open_end = data.find(">", start)
        close_start = data.rfind("</svg>")

        if open_end < 0 or close_start < 0 or close_start <= open_end:
            return data

        svg_open_tag = data[start:open_end + 1]
        inner = data[open_end + 1:close_start].strip()

        viewbox_match = re.search(
            r'viewBox\s*=\s*["\']([^"\']+)["\']',
            svg_open_tag,
            flags=re.IGNORECASE
        )

        if viewbox_match:
            raw = viewbox_match.group(1).replace(",", " ")
            parts = [p for p in raw.split() if p]

            if len(parts) == 4:
                try:
                    min_x = float(parts[0])
                    min_y = float(parts[1])

                    if abs(min_x) > 1e-9 or abs(min_y) > 1e-9:
                        return (
                            f'<g transform="translate({-min_x} {-min_y})">'
                            f'{inner}'
                            f'</g>'
                        )
                except Exception:
                    pass

        return inner

    @classmethod
    def _strip_svg_outer_tag(cls, svg_data):
        """
        Kompatibilitätshelper.

        Für Shape-Layer wird _extract_svg_inner() genutzt, weil dort zusätzlich
        die viewBox normalisiert wird.
        """
        data = str(svg_data or "").strip()

        start = data.find("<svg")
        if start < 0:
            return data

        open_end = data.find(">", start)
        close_start = data.rfind("</svg>")

        if open_end < 0 or close_start < 0 or close_start <= open_end:
            return data

        return data[open_end + 1:close_start].strip()

    @classmethod
    def _build_svg_export(cls, dpi=72, inlineCss=False):
        width = int(VIEWPORT_CONFIG[0]["width"])
        height = int(VIEWPORT_CONFIG[0]["height"])

        svg_parts = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            (
                f'<svg xmlns="http://www.w3.org/2000/svg" '
                f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                f'width="{width}" height="{height}" '
                f'viewBox="0 0 {width} {height}">'
            ),
            "<defs></defs>",
        ]

        sorted_layers = sorted(
            LAYERS,
            key=lambda item: int(item.get("order", 0))
        )

        for layer in sorted_layers:
            if layer.get("hidden", 0) == 1:
                continue

            layer_id = layer.get("id")
            if not layer_id:
                continue

            layer_type = layer.get("type")
            layer_name = cls._svg_escape(layer.get("name") or layer_id)
            opacity = cls._svg_opacity(layer)

            if layer_type == 2:
                transform = cls._svg_vector_layer_transform(layer)
            else:
                transform = cls._svg_transform(layer)

            group_attrs = [
                f'id="layer-{cls._svg_escape(layer_id)}"',
                f'data-name="{layer_name}"',
                f'opacity="{opacity}"',
            ]

            if transform:
                group_attrs.append(f'transform="{transform}"')

            svg_parts.append(f"<g {' '.join(group_attrs)}>")

            # Type 2 = SVG Shape/Vector Layer.
            if layer_type == 2:
                svg_path = os.path.join(
                    PUBLIC_TEMP_UPLOAD_FOLDER,
                    f"{layer_id}.svg",
                )

                if os.path.exists(svg_path):
                    with open(svg_path, "r", encoding="utf-8") as f:
                        svg_data = f.read()

                    inner_svg = cls._extract_svg_inner(svg_data)
                    svg_parts.append(inner_svg)

            # Type 1 = Font/Text.
            elif layer_type == 1:
                text_svg = ""

                try:
                    if hasattr(FontsModel, "render_svg_paths"):
                        text_svg = FontsModel.render_svg_paths(layer)
                except Exception:
                    text_svg = ""

                if text_svg:
                    svg_parts.append(text_svg)
                else:
                    layer_img = FontsModel.render(layer)

                    if layer_img:
                        layer_img = layer_img.convert("RGBA")
                        data_uri = cls._image_to_png_data_uri(layer_img)

                        w = int(layer_img.width)
                        h = int(layer_img.height)

                        svg_parts.append(
                            f'<image x="0" y="0" width="{w}" height="{h}" '
                            f'href="{data_uri}" xlink:href="{data_uri}" />'
                        )

            # Alle anderen Layer = PNG/Raster.
            else:
                png_path = os.path.join(
                    PUBLIC_LAYER_FOLDER,
                    f"{layer_id}.png",
                )

                if os.path.exists(png_path):
                    data_uri = cls._file_to_data_uri(png_path, "image/png")

                    w = int(layer.get("width", 0) or 0)
                    h = int(layer.get("height", 0) or 0)

                    if w <= 0 or h <= 0:
                        try:
                            with Image.open(png_path) as img:
                                w, h = img.size
                        except Exception:
                            w = width
                            h = height

                    svg_parts.append(
                        f'<image x="0" y="0" width="{w}" height="{h}" '
                        f'href="{data_uri}" xlink:href="{data_uri}" />'
                    )

            svg_parts.append("</g>")

        svg_parts.append("</svg>")

        return "\n".join(svg_parts)

    @classmethod
    def _render_svg_export(cls, output_path, dpi=72, inlineCss=False):
        svg_data = cls._build_svg_export(
            dpi=dpi,
            inlineCss=inlineCss,
        )

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(svg_data)

        return output_path

    # -------------------------------------------------------------------------
    # Composite Helper
    # -------------------------------------------------------------------------

    @classmethod
    def _render_composite(cls, width, height, dpi):
        composite = Image.new("RGBA", (width, height), (0, 0, 0, 0))

        sorted_layers = sorted(
            LAYERS,
            key=lambda item: int(item.get("order", 0))
        )

        for layer in sorted_layers:
            if layer.get("hidden", 0) == 1:
                continue

            layer_img = None
            layer_type = layer.get("type")

            if layer_type == 2:  # SVG
                svg_path = os.path.join(
                    PUBLIC_TEMP_UPLOAD_FOLDER,
                    f"{layer['id']}.svg",
                )

                if os.path.exists(svg_path):
                    with open(svg_path, "r", encoding="utf-8") as f:
                        svg_data = f.read()

                    img_bytes = cairosvg.svg2png(
                        bytestring=svg_data.encode("utf-8"),
                        dpi=dpi,
                    )

                    layer_img = Image.open(BytesIO(img_bytes)).convert("RGBA")
                else:
                    continue

            elif layer_type == 1:  # Font/Text Preview als Raster
                layer_img = FontsModel.render(layer)

                if layer_img:
                    layer_img = layer_img.convert("RGBA")

            else:  # Normal PNG Layer
                path = os.path.join(
                    PUBLIC_LAYER_FOLDER,
                    f"{layer['id']}.png",
                )

                if os.path.exists(path):
                    layer_img = Image.open(path).convert("RGBA")

            if not layer_img:
                continue

            transformed_img, paste_x, paste_y = layer_transform(
                layer,
                layer_img,
                apply_opacity=True,
            )

            if not transformed_img:
                continue

            if transformed_img.mode != "RGBA":
                transformed_img = transformed_img.convert("RGBA")

            paste_x = int(paste_x)
            paste_y = int(paste_y)

            src_x = max(0, -paste_x)
            src_y = max(0, -paste_y)
            dst_x = max(0, paste_x)
            dst_y = max(0, paste_y)

            visible_w = min(
                transformed_img.width - src_x,
                composite.width - dst_x,
            )
            visible_h = min(
                transformed_img.height - src_y,
                composite.height - dst_y,
            )

            if visible_w <= 0 or visible_h <= 0:
                continue

            cropped = transformed_img.crop(
                (
                    src_x,
                    src_y,
                    src_x + visible_w,
                    src_y + visible_h,
                )
            )

            composite.alpha_composite(cropped, dest=(dst_x, dst_y))

        return composite

    # -------------------------------------------------------------------------
    # Export
    # -------------------------------------------------------------------------

    @classmethod
    def update(
        cls,
        mode,
        quality,
        type,
        dpi,
        title,
        compress,
        inlineCss=False,
        paperSize=None,
        landscape=False,
        margin=10,
        mipmap=True,
        ddsCompress="DTX3",
        raster=True,
        pdfFitMode="contain",
    ):
        try:
            if not LAYERS:
                return {"error": "No layers to export"}, 404

            raster = cls._to_bool(raster, default=True)

            width = int(VIEWPORT_CONFIG[0]["width"])
            height = int(VIEWPORT_CONFIG[0]["height"])

            export_id = str(uuid.uuid4())
            preview_id = str(uuid.uuid4())
            filename_base = f"{title or 'export'}_{export_id}"
            export_ext = str(type or "").lower()

            export_path = os.path.join(
                PUBLIC_TEMP_UPLOAD_FOLDER,
                f"{filename_base}.{export_ext}",
            )
            preview_path = os.path.join(
                PUBLIC_TEMP_UPLOAD_FOLDER,
                f"{preview_id}.png",
            )

            log(
                f"Erzeuge Composite für {len(LAYERS)} Layer ...",
                "EXPORT",
                "INFO",
                "🧩"
            )

            try:
                composite = cls._render_composite(width, height, dpi)
                composite.save(preview_path, format="PNG")

                # Raster Export
                if mode == 0 and export_ext in ["png", "jpeg", "jpg"]:
                    if export_ext in ["jpeg", "jpg"]:
                        export_image = composite.convert("RGB")
                        export_image.save(
                            export_path,
                            format="JPEG",
                            quality=int(quality),
                        )
                    else:
                        export_image = composite.convert("RGBA")
                        export_image.save(
                            export_path,
                            format="PNG",
                        )

                elif mode == 0 and export_ext == "tga":
                    generate_tga_map(composite, export_path, rle=True)

                elif mode == 0 and export_ext == "dds":
                    nvcompress_path = cls._nvcompress()

                    if not nvcompress_path:
                        return {"error": "NVCompress path is not configured"}, 500

                    generate_dds_map(
                        nvcompress_path,
                        composite,
                        export_path,
                        mipmap,
                        ddsCompress,
                    )

                # SVG Vector Export
                elif mode == 1 and export_ext == "svg":
                    cls._render_svg_export(
                        output_path=export_path,
                        dpi=dpi,
                        inlineCss=inlineCss,
                    )

                # PDF Export
                elif mode == 2 and export_ext == "pdf":
                    if raster:
                        pdf_image = alpha_as_bg(composite)

                        generate_pdf_map(
                            pdf_image,
                            margin,
                            paperSize,
                            landscape,
                            export_path,
                            fit_mode=pdfFitMode,
                            dpi=dpi,
                        )
                    else:
                        svg_data = cls._build_svg_export(
                            dpi=dpi,
                            inlineCss=inlineCss,
                        )

                        generate_vector_pdf_map(
                            svg_data,
                            margin,
                            paperSize,
                            landscape,
                            export_path,
                            fit_mode=pdfFitMode,
                            dpi=dpi,
                            viewport_width=width,
                            viewport_height=height,
                            background="#ffffff",
                        )

                else:
                    return {
                        "error": f"Unsupported export mode/type: {mode}/{type}"
                    }, 400

            except Exception as e:
                return {"error": f"Export failed: {str(e)}"}, 500

            return {
                "src": f"/download/{preview_id}.png",
                "file": f"/download/{filename_base}.{export_ext}",
                "title": title or "export",
                "id": export_id,
            }, 200

        except Exception as e:
            return cls.handle_error(e)