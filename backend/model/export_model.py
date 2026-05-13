# model/export_model.py
import os
import uuid
from io import BytesIO
from PIL import Image
import cairosvg
from model.base.main import BaseModel
from generated.paths import PUBLIC_LAYER_FOLDER, PUBLIC_TEMP_UPLOAD_FOLDER
from config.data.constant import VIEWPORT_CONFIG, LAYERS
from model.fonts_model import FontsModel
from components import generate_pdf_map, generate_tga_map, generate_dds_map
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
    ):
        try:
            if not LAYERS:
                return {"error": "No layers to export"}, 404

            width = VIEWPORT_CONFIG[0]["width"]
            height = VIEWPORT_CONFIG[0]["height"]

            export_id = str(uuid.uuid4())
            preview_id = str(uuid.uuid4())
            filename_base = f"{title or 'export'}_{export_id}"
            export_ext = type.lower()

            export_path = os.path.join(
                PUBLIC_TEMP_UPLOAD_FOLDER,
                f"{filename_base}.{export_ext}",
            )
            preview_path = os.path.join(
                PUBLIC_TEMP_UPLOAD_FOLDER,
                f"{preview_id}.png",
            )

            log(f"Erzeuge Composite für {len(LAYERS)} Layer ...", "EXPORT", "INFO", "🧩")

            try:
                composite = Image.new("RGBA", (width, height), (0, 0, 0, 0))

                for layer in LAYERS:
                    if layer.get("hidden", 0) == 1:
                        continue

                    layer_img = None

                    if layer.get("type") == 2:  # SVG
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

                    elif layer.get("type") == 1:  # Font/Text
                        layer_img = FontsModel.render(layer)

                        if layer_img:
                            layer_img = layer_img.convert("RGBA")

                    else:  # Normal PNG layer
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

                    # Sichtbaren Bereich auf Canvas clippen.
                    # Das verhindert Fehler, wenn ein Layer teilweise außerhalb liegt.
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

                # Vorschau PNG speichern
                composite.save(preview_path, format="PNG")

                # Export je nach Modus / Typ
                if mode == 0 and export_ext in ["png", "jpeg"]:
                    if export_ext == "jpeg":
                        export_image = composite.convert("RGB")
                        export_image.save(
                            export_path,
                            format="JPEG",
                            quality=quality,
                        )
                    else:
                        export_image = composite.convert("RGBA")
                        export_image.save(
                            export_path,
                            format="PNG",
                            quality=quality,
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

                elif mode == 2 and export_ext == "pdf":
                    pdf_image = alpha_as_bg(composite)
                    generate_pdf_map(
                        pdf_image,
                        margin,
                        paperSize,
                        landscape,
                        export_path,
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