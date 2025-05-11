import os
from PIL import Image
from config.data.constant import EXTENSION
from generated.paths import ( PUBLIC_LAYER_FOLDER , PUBLIC_TEMP_UPLOAD_FOLDER , PUBLIC_TEMP_CHANNEL_FOLDER  )

def get_path(image_id, folders=None, extensions=None):
    folders = folders or [
        PUBLIC_LAYER_FOLDER,
        PUBLIC_TEMP_UPLOAD_FOLDER,
        PUBLIC_TEMP_CHANNEL_FOLDER,
    ]
    extensions = extensions or EXTENSION

    for folder in folders:
        for ext in extensions:
            path = os.path.join(folder, f"{image_id}{ext}")
            if os.path.exists(path):
                return path
    return None

def get_img(image_id):
    try:
        path = get_path(image_id)
        if not path:
            raise FileNotFoundError(f"No image found for ID: {image_id}")
        return Image.open(path).convert("RGBA")
    except Exception as e:
        raise RuntimeError(f"Error loading image '{image_id}': {e}")