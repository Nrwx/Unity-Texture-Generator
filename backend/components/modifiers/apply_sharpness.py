import cv2
import numpy as np
from PIL import Image

def apply_sharpness(img, sharpness=1.5):
    """
    Wendet Schärfe auf das Bild an, indem Unsharp Masking verwendet wird.
    Der Schärfungsfaktor wird durch den Parameter `sharpness` bestimmt.
    Höhere Werte für `sharpness` führen zu stärkerer Schärfung.

    :param img: Das Eingabebild (PIL.Image oder numpy Array).
    :param sharpness: Der Schärfungsfaktor (je größer, desto schärfer). Standard ist 1.5.
    :return: Das geschärfte Bild (numpy Array).
    """
    # Prüfen, ob das Bild ein PIL Image ist und es in ein NumPy Array umwandeln
    if isinstance(img, Image.Image):
        img = np.array(img)

    # Wenn das Bild ein NumPy Array ist
    if isinstance(img, np.ndarray):
        # Konvertiere das Bild in RGB (im Fall von RGBA oder anderen Formaten)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)  # OpenCV lädt im BGR-Format

        # Wende Unschärfe auf das Bild an (GaussianBlur)
        blurred = cv2.GaussianBlur(img_rgb, (21, 21), 0)

        # Berechne die Differenz zwischen dem Originalbild und der unscharfen Version
        sharpened = cv2.addWeighted(img_rgb, 1 + sharpness, blurred, -sharpness, 0)

        # Rückwandlung in PIL Image (wenn nötig)
        sharpened = cv2.cvtColor(sharpened, cv2.COLOR_RGB2BGR)

        return sharpened
    else:
        raise TypeError("Das Bild muss entweder ein PIL Image oder ein NumPy Array sein.")
