import os
from PIL import Image
import uuid
from generated.paths import PUBLIC_TEMP_RENDER_FOLDER

def generate_dummy_map(image, return_url=True):
    """
    Erstellt eine leere transparente RGBA-Fläche in der Größe des übergebenen Bildes,
    speichert sie als Dummy-PNG und gibt entweder die URL oder das Bildobjekt zurück.
    """
    dummy_id = str(uuid.uuid4())

    # Größe vom übergebenen Bild übernehmen
    width, height = image.size

    # Leere RGBA-Fläche erzeugen
    dummy_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))

    # Sicherstellen, dass Zielordner existiert
    os.makedirs(PUBLIC_TEMP_RENDER_FOLDER, exist_ok=True)

    # Pfad festlegen
    output_path = os.path.join(PUBLIC_TEMP_RENDER_FOLDER, f"dummy_{dummy_id}.png")

    # Speichern
    dummy_img.save(output_path, format="PNG")

    if return_url:
        return f"/download/dummy_{dummy_id}.png"
    else:
        return dummy_img
