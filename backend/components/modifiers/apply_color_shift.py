from PIL import Image
import numpy as np

def apply_color_shift(img, color_shift):
    """
    Verschiebt die Farbkanäle (RGB) um den angegebenen Wert.
    Funktioniert sowohl mit PIL Image als auch mit NumPy Array als Eingabe.
    """
    # Überprüfen, ob das Bild ein PIL Image ist, und in NumPy Array umwandeln, wenn nötig
    if isinstance(img, Image.Image):
        img = np.array(img)

    # Farbverschiebung anwenden
    if color_shift > 0:
        img[:, :, 0] = np.clip(img[:, :, 0] + color_shift, 0, 255)
        img[:, :, 1] = np.clip(img[:, :, 1] - color_shift, 0, 255)
        img[:, :, 2] = np.clip(img[:, :, 2] + color_shift // 2, 0, 255)

    return img
