import cv2
import numpy as np
from PIL import Image

def apply_edge_detection(img, edge_detection=True, method='canny', threshold1=50, threshold2=150, kernel_size=3, alpha=0.5):
    """
    Fügt eine professionelle Kantenhervorhebung hinzu, die verschiedene Methoden unterstützt:
    Canny, Sobel, Laplacian.

    :param img: Eingabebild (PIL.Image oder numpy Array).
    :param edge_detection: Aktiviert oder deaktiviert die Kantenhervorhebung.
    :param method: Die Methode zur Kantenbestimmung ('canny', 'sobel', 'laplacian').
    :param threshold1: Erstes Threshold für Canny (nur bei Canny verwendet).
    :param threshold2: Zweites Threshold für Canny (nur bei Canny verwendet).
    :param kernel_size: Kernel-Größe für den Sobel oder Laplacian-Operator.
    :param alpha: Gewichtung des Kantenbildes (zwischen 0 und 1).
    :return: Das Bild mit angewandter Kantenhervorhebung.
    """
    # Überprüfen, ob das Bild ein PIL-Image ist und es in ein NumPy-Array umwandeln
    if isinstance(img, Image.Image):
        img_array = np.array(img)
    else:
        img_array = img

    # Kantenhervorhebung nur anwenden, wenn aktiviert
    if edge_detection:
        # Bild in Graustufen konvertieren
        gray_img = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

        # Auswahl der Methode zur Kantenbestimmung
        if method == 'canny':
            # Canny-Algorithmus für Kantenbestimmung
            edges = cv2.Canny(gray_img, threshold1, threshold2)
        elif method == 'sobel':
            # Sobel-Operator für Kantenbestimmung (horizontal und vertikal)
            grad_x = cv2.Sobel(gray_img, cv2.CV_64F, 1, 0, ksize=kernel_size)
            grad_y = cv2.Sobel(gray_img, cv2.CV_64F, 0, 1, ksize=kernel_size)
            edges = cv2.magnitude(grad_x, grad_y)
            edges = np.uint8(np.clip(edges, 0, 255))  # Normalisieren
        elif method == 'laplacian':
            # Laplacian-Operator für Kantenbestimmung
            edges = cv2.Laplacian(gray_img, cv2.CV_64F, ksize=kernel_size)
            edges = np.uint8(np.clip(edges, 0, 255))  # Normalisieren
        else:
            raise ValueError(f"Unbekannte Methode: {method}. Verwende 'canny', 'sobel' oder 'laplacian'.")

        # Kanten wieder in RGB umwandeln, um sie mit dem Originalbild zu kombinieren
        edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)

        # Kanten mit dem Originalbild kombinieren (weighted addition)
        img_array = cv2.addWeighted(img_array, 1.0, edges_rgb, alpha, 0)

    # Rückgabe: Falls das Bild ein PIL-Image war, wieder in dieses Format umwandeln
    if isinstance(img, Image.Image):
        img_array = Image.fromarray(img_array)

    return img_array
