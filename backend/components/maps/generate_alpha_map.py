from PIL import Image
import cv2
import numpy as np
def generate_alpha_map(image):
    """Erstellt eine Alpha Map (basierend auf Transparenz)."""
    gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
    _, alpha_map = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY)
    return Image.fromarray(alpha_map)
