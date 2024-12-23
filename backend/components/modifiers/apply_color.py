from PIL import Image
import numpy as np
from PIL import ImageEnhance

def apply_color(image, red_factor=1.0, green_factor=1.0, blue_factor=1.0, saturation_factor=1.0, overlay_color=(0, 0, 0), overlay_opacity=0.5):
    """
    Wendet Farb- und Sättigungsanpassungen sowie einen Farb-Overlay mit einstellbarer Deckkraft auf das Bild an.

    :param image: Das Eingabebild (PIL.Image oder numpy Array).
    :param red_factor: Skalierungsfaktor für den Rot-Kanal (1.0 bedeutet keine Änderung).
    :param green_factor: Skalierungsfaktor für den Grün-Kanal (1.0 bedeutet keine Änderung).
    :param blue_factor: Skalierungsfaktor für den Blau-Kanal (1.0 bedeutet keine Änderung).
    :param saturation_factor: Skalierungsfaktor für die Sättigung (1.0 bedeutet keine Änderung).
    :param overlay_color: Ein Tupel (R, G, B) für den Farb-Overlay.
    :param overlay_opacity: Die Deckkraft des Farb-Overlays (0.0 bedeutet keine Deckkraft, 1.0 bedeutet volle Deckkraft).
    :return: Das bearbeitete Bild (PIL.Image).
    """

    # Überprüfen, ob das Bild ein PIL Image ist, und in NumPy Array umwandeln, wenn ja
    if isinstance(image, Image.Image):
        img_array = np.array(image)
    else:
        img_array = image

    # Farbkanäle anpassen
    img_array[:, :, 0] = np.clip(img_array[:, :, 0] * red_factor, 0, 255)  # Rot
    img_array[:, :, 1] = np.clip(img_array[:, :, 1] * green_factor, 0, 255)  # Grün
    img_array[:, :, 2] = np.clip(img_array[:, :, 2] * blue_factor, 0, 255)  # Blau

    # Sättigung anpassen
    img_pil = Image.fromarray(img_array)
    enhancer = ImageEnhance.Color(img_pil)
    img_pil = enhancer.enhance(saturation_factor)
    img_array = np.array(img_pil)

    # Farb-Overlay anwenden
    overlay = np.array(overlay_color, dtype=np.uint8)
    overlay = np.reshape(overlay, (1, 1, 3))  # Überlagerung in einer 1x1 Matrix umformen
    overlay_image = np.full_like(img_array, overlay, dtype=np.uint8)

    # Deckkraft des Overlay anpassen
    img_array = np.clip((1 - overlay_opacity) * img_array + overlay_opacity * overlay_image, 0, 255).astype(np.uint8)

    # Rückgabe des bearbeiteten Bildes
    return Image.fromarray(img_array)

