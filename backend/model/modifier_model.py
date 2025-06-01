from PIL import Image
import os
import uuid
import shutil
import numpy as np
from datetime import datetime
from generated.paths import ( PUBLIC_LAYER_FOLDER, PUBLIC_BACKUP_FOLDER )
from config.data.constant import ( LAYERS )
from components import ( apply_color_fill )
from utils import ( apply_rgb_rgba, apply_alpha, time )

class ModifierModel:
    @staticmethod
    def fill(id, x, y, color, tolerance=0):
        layer = next((l for l in LAYERS if l["id"] == id), None)
        if not layer:
            return {"error": f"Layer with id '{id}' not found."}, 404

        image_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{id}.png")
        if not os.path.exists(image_path):
            return {"error": "Image file not found."}, 404

        try:
            if not os.path.exists(PUBLIC_BACKUP_FOLDER):
                os.makedirs(PUBLIC_BACKUP_FOLDER)

            backup_path = os.path.join(PUBLIC_BACKUP_FOLDER, f"{id}.png")
            shutil.copy2(image_path, backup_path)

            image = Image.open(image_path).convert("RGBA")
            original_array = np.array(image)
            click_x, click_y = int(x), int(y)

            mask = None
            if layer.get("mask"):
                mask_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{layer['mask']}.png")
                if os.path.exists(mask_path):
                    mask = Image.open(mask_path)

            result_array, info = apply_color_fill(
                original_array, click_x, click_y, color, mask, tolerance
            )

            changed_pixels = np.any(result_array[:, :, :3] != original_array[:, :, :3], axis=-1)
            result_array[changed_pixels, 3] = 255

            result_image = Image.fromarray(result_array.astype(np.uint8))

            new_id = str(uuid.uuid4())
            new_filename = f"{new_id}.png"
            new_save_path = os.path.join(PUBLIC_LAYER_FOLDER, new_filename)
            result_image.save(new_save_path)

            os.remove(image_path)

            layer["url"] = f"/download/{new_filename}"
            layer["id"] = new_id
            layer["source"] = id
            layer["time"] = time('unix_ms')

            return {
                "message": "Farbfüllung erfolgreich angewendet.",
                "url": layer["url"]
            }, 200

        except Exception as e:
            return {"error": str(e)}, 500