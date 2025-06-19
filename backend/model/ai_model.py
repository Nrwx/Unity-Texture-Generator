import os
import uuid
import time
import requests
from PIL import Image
from io import BytesIO

from generated.paths import PUBLIC_LAYER_FOLDER, PUBLIC_BACKUP_FOLDER
from config.data.constant import VIEWPORT_CONFIG, LAYERS
from utils import time

class AIModel:
    @staticmethod
    def generate_image_from_prompt(prompt, model="dall-e-2", size="1024x1024", type=0):
        OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
        if not OPENAI_API_KEY:
            raise Exception("OpenAI API Key fehlt in den Umgebungsvariablen")

        url = "https://api.openai.com/v1/images/generations"
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        data = {
            "model": model,
            "prompt": prompt,
            "n": 1,
            "size": size
        }

        response = requests.post(url, headers=headers, json=data)
        if response.status_code != 200:
            raise Exception(response.json().get("error", {}).get("message", "Fehler bei der API-Anfrage"))

        image_url = response.json()["data"][0]["url"]

        # Bild herunterladen
        image_response = requests.get(image_url)
        if image_response.status_code != 200:
            raise Exception("Fehler beim Herunterladen des generierten Bildes")

        image = Image.open(BytesIO(image_response.content))

        # Bild speichern im Backup-Ordner
        source_id = str(uuid.uuid4())
        source_path = os.path.join(PUBLIC_BACKUP_FOLDER, f"{source_id}.png")
        image.save(source_path)

        # Layer-ID und Pfad
        layer_id = str(uuid.uuid4())
        layer_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{layer_id}.png")

        # Viewport Größen
        viewport_width = VIEWPORT_CONFIG[0]["width"]
        viewport_height = VIEWPORT_CONFIG[0]["height"]

        width, height = image.size

        # Skalierungsfaktor berechnen
        scale_factor = min(viewport_width / width, viewport_height / height)

        if scale_factor < 1:
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            image = image.resize((new_width, new_height), Image.LANCZOS)
            image.save(layer_path)
            translate_x = int((viewport_width - new_width) / 2)
            translate_y = int((viewport_height - new_height) / 2)
        else:
            image.save(layer_path)
            new_width = width
            new_height = height
            translate_x = int((viewport_width - width) / 2)
            translate_y = int((viewport_height - height) / 2)

        matrix = {
            "a": 1,
            "b": 0,
            "c": 0,
            "d": 1,
            "x": translate_x,
            "y": translate_y,
            "rotate": 0,
        }

        layer = {
            "time": time('unix_ms'),
            "type": type,
            "id": layer_id,
            "name": prompt[:10],
            "width": new_width,
            "height": new_height,
            "url": f"/download/{layer_id}.png",
            "matrix": matrix,
            "source": source_id,
            "order": len(LAYERS),
            "hidden": 0,
            "opacity": 1,
            "blend_mode": 0,
            "color": "#ffffff",
            "mask": ""
        }

        LAYERS.append(layer)
        print("Aktuelle Layers:", LAYERS)

        return {"message": "Bild erfolgreich generiert und Layer hinzugefügt."}, 200
