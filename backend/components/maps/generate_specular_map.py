from PIL import Image
import cv2
import numpy as np
def generate_specular_map(image):
    """Erstellt eine Specular Map."""
    gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
    _, specular_map = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
    return Image.fromarray(specular_map)
