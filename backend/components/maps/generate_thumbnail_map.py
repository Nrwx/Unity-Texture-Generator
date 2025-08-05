# generate_thumbnail_map.py

import os
import uuid
from PIL import Image

# Falls der Ordner extern definiert ist, übergebe ihn als Argument oder importiere ihn.
from generated.paths import (PUBLIC_TEMP_RENDER_FOLDER )


def generate_thumbnail_map(id, path=None, size=128, image=None):
    """
    Erzeugt ein Thumbnail aus einem Pfad oder einem gegebenen PIL-Image-Objekt.

    :param id: Referenz-ID (z.B. Channel- oder Layer-ID).
    :param path: Optionaler Pfad zur Quelldatei (wenn kein Image übergeben wurde).
    :param size: Größe des Thumbnails (quadratisch).
    :param image: Optionales PIL.Image-Objekt (wird bevorzugt verwendet).
    :return: Thumbnail-Download-URL oder None bei Fehler.
    """
    if not id or (image is None and (path is None or not os.path.exists(path))):
        print(f"[WARN] Thumbnail skipped – invalid ID, image, or path: {id}, {path}")
        return None

    if not os.path.exists(PUBLIC_TEMP_RENDER_FOLDER):
        os.makedirs(PUBLIC_TEMP_RENDER_FOLDER, exist_ok=True)

    try:
        img = image if image else Image.open(path).convert("RGBA")
        img.thumbnail((size, size), Image.LANCZOS)

        thumb_id = f"thumbnail_{size}_{uuid.uuid4()}"
        thumbnail_path = os.path.join(PUBLIC_TEMP_RENDER_FOLDER, f"{thumb_id}.png")
        img.save(thumbnail_path)

        url = f"/download/{thumb_id}.png"
        print(f"[INFO] Thumbnail created: {url}")
        return url

    except Exception as e:
        print(f"[ERROR] Thumbnail generation failed for {id}: {e}")
        return None
