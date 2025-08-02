import os
import uuid
from io import BytesIO
from PIL import Image
import cairosvg

from generated.paths import (
    PUBLIC_LAYER_FOLDER,
    PUBLIC_TEMP_UPLOAD_FOLDER
)
from config.data.constant import (
    VIEWPORT_CONFIG,
    LAYERS
)
from model.fonts_model import FontsModel
from components import (generate_pdf_map, generate_tga_map, generate_dds_map)
from utils import layer_transform, alpha_as_bg


class ExportModel:

    @staticmethod
    def update(mode, quality, type, dpi, title, compress,
               inlineCss=False, paperSize=None, landscape=False, margin=10, mipmap=True, ddsCompress="DTX3"):

        if not LAYERS:
            return {"error": "No layers to export"}, 404

        width = VIEWPORT_CONFIG[0]["width"]
        height = VIEWPORT_CONFIG[0]["height"]

        export_id = str(uuid.uuid4())
        preview_id = str(uuid.uuid4())  # eigene UUID für Vorschau

        filename_base = f"{title or 'export'}_{export_id}"
        export_ext = type.lower()
        compress_type = ddsCompress


        export_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, f"{filename_base}.{export_ext}")
        preview_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, f"{preview_id}.png")

        try:
            composite = Image.new("RGBA", (width, height), (0, 0, 0, 0))

            for layer in LAYERS:
                if layer.get("hidden", 0) == 1:
                    continue

                layer_img = None

                if layer.get("type") == 2:
                    svg_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, f"{layer['id']}.svg")
                    if os.path.exists(svg_path):
                        with open(svg_path, "r", encoding="utf-8") as f:
                            svg_data = f.read()
                        img_bytes = cairosvg.svg2png(bytestring=svg_data.encode("utf-8"), dpi=dpi)
                        layer_img = Image.open(BytesIO(img_bytes)).convert("RGBA")
                    else:
                        continue

                elif layer.get("type") == 1:
                    layer_img = FontsModel.render(layer)

                else:
                    path = os.path.join(PUBLIC_LAYER_FOLDER, f"{layer['id']}.png")
                    if not os.path.exists(path):
                        continue
                    layer_img = Image.open(path)

                if not layer_img:
                    continue

                transformed_img, paste_x, paste_y = layer_transform(layer, layer_img, apply_opacity=True)
                composite.paste(transformed_img, (paste_x, paste_y), transformed_img)

            # Vorschau immer als PNG speichern
            if mode == 0 and export_ext in ["jpeg"]:
                # JPG unterstützt keine Transparenz – also RGB
                composite.convert("RGB").save(preview_path, format="JPEG")
            elif mode == 0 and export_ext in ["dds"] and compress_type in ["DXT1", "BC1", "BC4", "BC5", "R5G6B5", "RGB8"]:
                # JPG unterstützt keine Transparenz – also RGB
                composite.convert("RGB").save(preview_path, format="JPEG")
            else:
                # Für PNG oder PDF-Preview etc. RGBA beibehalten
                composite.save(preview_path, format="PNG")

            # Export je nach Modus/Typ
            if mode == 1 and export_ext == "svg":
                svg_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, f"{layer['id']}.svg")
                if os.path.exists(svg_path):
                    with open(svg_path, "r", encoding="utf-8") as f_src, \
                         open(export_path, "w", encoding="utf-8") as f_dest:
                        f_dest.write(f_src.read())
                else:
                    return {"error": "No SVG file found to export"}, 404

            elif mode == 2 and export_ext == "pdf":
                composite = alpha_as_bg(composite)
                generate_pdf_map(
                    composite,
                    margin,
                    paperSize,
                    landscape,
                    export_path
                )

            elif mode == 0 and export_ext in ["png", "jpeg"]:
                if export_ext in ["jpeg"]:
                    export_image = composite.convert("RGB")  # JPEG: kein Alpha
                else:
                    export_image = composite.convert("RGBA")  # PNG: Alpha behalten

                export_image.save(export_path, format=export_ext.upper(), quality=quality)

            elif mode == 0 and export_ext == "tga":
                generate_tga_map(composite, export_path, rle=True)  # oder False

            elif mode == 0 and export_ext == "dds":
                generate_dds_map(composite, export_path, mipmap, ddsCompress)  # oder False

            else:
                return {"error": f"Unsupported export mode/type: {mode}/{type}"}, 400

        except Exception as e:
            return {"error": f"Export failed: {str(e)}"}, 500

        return {
            "src": f"/download/{preview_id}.png",
            "file": f"/download/{filename_base}.{export_ext}",
            "title": title or "export",
            "id": export_id
        }, 200
