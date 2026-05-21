# model/cursor_model.py
import os
import hashlib
from PIL import Image, ImageOps

from model.base.main import BaseModel
from components import generate_cursor
from utils import apply_rgb_rgba, apply_alpha
from generated.paths import PUBLIC_TEMP_CURSOR_FOLDER, PUBLIC_BRUSH_FOLDER
from config.data.constant import CURSOR, BRUSHES


class CursorModel(BaseModel):
    @classmethod
    def create(cls, id, size=64, rotation=0, opacity=1.0):
        try:
            size = int(float(size))

            # Rotation und Opacity werden nur noch im Frontend genutzt.
            # Backend normalisiert nur size.
            size = max(1, min(2048, size))

            image_path = cls._resolve_brush(id)

            if not image_path or not os.path.exists(image_path):
                return {"error": f"Brush-ID nicht gefunden oder Datei fehlt: {id}"}, 404

            # Cursor hängt serverseitig nur noch von Brush + Size ab.
            cache_key = cls._get_cache_key(
                image_path=image_path,
                size=size,
            )

            vector_cache_key = cache_key

            if cache_key in CURSOR:
                return CURSOR[cache_key], 200

            cursor_url = cls._create_cursor_png(
                image_path=image_path,
                cache_key=cache_key,
                size=size,
            )

            vector = generate_cursor(
                image_path=image_path,
                key=vector_cache_key,
                size=size,
                alpha_threshold=28,
                simplify_tolerance=0.35 if size <= 32 else 0.65,
                min_path_length=max(6, size * 0.08),
                max_paths=12,
                simple_size_threshold=16,
                simple_shape="auto",
                fragmented_path_limit=3,
            )

            result = {
                "cursor": cursor_url,
                "vector": vector,
            }

            CURSOR[cache_key] = result

            return result, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def _create_cursor_png(cls, image_path, cache_key, size):
        img = Image.open(image_path)

        img, original_alpha = apply_rgb_rgba(img)
        img = img.resize((size, size), Image.Resampling.LANCZOS)

        grayscale = ImageOps.grayscale(img)

        img = img.convert("RGBA")
        img.putalpha(grayscale)

        # Keine Rotation.
        # Keine Opacity.
        # Beides passiert im Frontend.

        img = apply_alpha(img, original_alpha)

        filename = f"{cache_key}.png"
        filepath = os.path.join(PUBLIC_TEMP_CURSOR_FOLDER, filename)

        os.makedirs(PUBLIC_TEMP_CURSOR_FOLDER, exist_ok=True)

        img.save(filepath, format="PNG", quality=100)

        return f"/download/{filename}"

    @staticmethod
    def _get_cache_key(image_path, size):
        key_raw = f"{image_path}|{size}"
        return hashlib.md5(key_raw.encode()).hexdigest()

    @staticmethod
    def _resolve_brush(id):
        for brush in BRUSHES:
            for child in brush.get("children", []):
                if child["id"] == id:
                    return os.path.join(
                        PUBLIC_BRUSH_FOLDER,
                        child["path"].lstrip("/"),
                    )

        return None