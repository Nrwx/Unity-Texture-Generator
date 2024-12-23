import cv2
import numpy as np
from PIL import Image

def apply_brightness_contrast(img, brightness, contrast):
    """
    Wendet Helligkeit und Kontrast auf das Bild an.
    Der Helligkeit- und Kontrastwert kann auch negativ sein, um die Helligkeit zu subtrahieren
    oder den Kontrast zu verringern.
    """
    # Umrechnung der Helligkeit und des Kontrasts in den OpenCV-Bereich
    brightness = int(brightness * 255)  # Helligkeit: -255 bis +255
    contrast = 1 + contrast  # Kontrast: -1 bis +1 -> 0 bis 2 (Skalierung 1 bis 3)

    # Anwenden der Helligkeit und des Kontrasts
    img = cv2.convertScaleAbs(img, alpha=contrast, beta=brightness)

    return img
