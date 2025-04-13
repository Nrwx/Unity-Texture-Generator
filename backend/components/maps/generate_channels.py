import numpy as np
import cv2
from PIL import Image

def generate_channels(image: Image.Image):
    # Stelle sicher, dass das Bild RGBA ist
    image = image.convert("RGBA")

    # PIL → NumPy (H x W x 4)
    np_img = np.array(image)

    # Splitte in Kanäle
    b, g, r, a = cv2.split(np_img)  # OpenCV: Reihenfolge ist BGR(A)

    # Optional: zu PIL zurückwandeln
    channels = {
        "R": Image.fromarray(r),
        "G": Image.fromarray(g),
        "B": Image.fromarray(b),
        "A": Image.fromarray(a)
    }

    return channels