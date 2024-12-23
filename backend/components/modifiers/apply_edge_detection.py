import cv2
import numpy as np
from PIL import Image

def apply_edge_detection(img, edge_detection):
    """
    Fügt Kantenhervorhebung hinzu, wenn `edge_detection` aktiv ist.
    Das Bild kann sowohl als PIL Image oder NumPy Array übergeben werden.
    """
    # Wenn das Bild ein PIL-Image ist, konvertiere es in ein NumPy-Array
    if isinstance(img, Image.Image):
        img_array = np.array(img)
    else:
        img_array = img

    # Kantenhervorhebung nur anwenden, wenn aktiviert
    if edge_detection:
        # Bild in Graustufen konvertieren
        gray_img = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

        # Kanten mit Canny-Algorithmus finden
        edges = cv2.Canny(gray_img, threshold1=50, threshold2=150)

        # Kanten wieder in RGB umwandeln, um es mit dem Originalbild zu kombinieren
        edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)

        # Kanten mit dem Originalbild kombinieren
        img_array = cv2.addWeighted(img_array, 1.0, edges_rgb, 0.5, 0)

    # Rückgabe: Falls das Bild ein PIL-Image war, wieder in dieses Format umwandeln
    if isinstance(img, Image.Image):
        img_array = Image.fromarray(img_array)

    return img_array
