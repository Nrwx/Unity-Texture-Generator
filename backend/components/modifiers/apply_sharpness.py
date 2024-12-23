import cv2
import numpy as np
from PIL import Image

def apply_sharpness(img, sharpness):
    """
    Wendet Schärfe auf das Bild an, indem ein Schärfungs-Kernel verwendet wird.
    Der Schärfungsfaktor wird durch den Parameter `sharpness` bestimmt.
    Unterstützt sowohl PIL Images als auch NumPy Arrays.

    :param img: Das Eingabebild (PIL.Image oder numpy Array).
    :param sharpness: Der Schärfungsfaktor (je größer, desto schärfer).
    :return: Das geschärfte Bild (numpy Array).
    """
    # Prüfen, ob das Bild ein PIL Image ist
    if isinstance(img, Image.Image):
        # Konvertiere das PIL Image in ein NumPy Array
        img = np.array(img)

    # Überprüfen, ob das Bild ein NumPy Array ist
    if isinstance(img, np.ndarray):
        # Erstelle den Schärfungs-Kernel
        kernel = np.array([[-1, -1, -1], [-1, 8 + sharpness, -1], [-1, -1, -1]])

        # Wende den Schärfungs-Kernel auf das Bild an
        sharp_img = cv2.filter2D(img, -1, kernel)

        return sharp_img
    else:
        raise TypeError("Das Bild muss entweder ein PIL Image oder ein NumPy Array sein.")

