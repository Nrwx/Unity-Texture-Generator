# model/cursor_model.py
import os, hashlib
from PIL import Image, ImageOps, ImageEnhance
from model.base.main import BaseModel
from utils import apply_rgb_rgba, apply_alpha
from generated.paths import PUBLIC_TEMP_CURSOR_FOLDER, PUBLIC_BRUSH_FOLDER
from config.data.constant import CURSOR, BRUSHES

class CursorModel(BaseModel):
    @classmethod
    def create(cls, id, size=64, rotation=0, opacity=1.0):
        try:
            image_path = cls._resolve_brush(id)
            if not image_path or not os.path.exists(image_path):
                return {"error": f"Brush-ID nicht gefunden oder Datei fehlt: {id}"}, 404

            cache_key = cls._get_cache_key(image_path, size, rotation, opacity)
            if cache_key in CURSOR:
                 return CURSOR[cache_key], 200

            img = Image.open(image_path)
            img, original_alpha = apply_rgb_rgba(img)
            img = img.resize((size, size), Image.Resampling.LANCZOS)

            grayscale = ImageOps.grayscale(img)
            img = img.convert("RGBA")
            img.putalpha(grayscale)

            if opacity < 1.0:
                alpha = img.getchannel("A")
                alpha = ImageEnhance.Brightness(alpha).enhance(opacity)
                img.putalpha(alpha)

            if rotation != 0:
                img = img.rotate(-rotation, expand=True, resample=Image.BICUBIC)

            img = apply_alpha(img, original_alpha)

            filename = f"{cache_key}.png"
            filepath = os.path.join(PUBLIC_TEMP_CURSOR_FOLDER, filename)
            img.save(filepath, format="PNG", quality=100)

            result_url = f"/download/{filename}"
            CURSOR[cache_key] = result_url
            return result_url, 200
        except Exception as e:
            return cls.handle_error(e)

    @staticmethod
    def _get_cache_key(image_path, size, rotation, opacity):
        key_raw = f"{image_path}|{size}|{rotation}|{opacity}"
        return hashlib.md5(key_raw.encode()).hexdigest()

    @staticmethod
    def _resolve_brush(id):
        for brush in BRUSHES:
            for child in brush.get("children", []):
                if child["id"] == id:
                    return os.path.join(PUBLIC_BRUSH_FOLDER, child["path"].lstrip('/'))
        return None