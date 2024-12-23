from PIL import Image
import cv2
import numpy as np
def generate_bump_map(image):
    """Erstellt eine Bump Map."""
    gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
    bump_map = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
    bump_map = cv2.normalize(bump_map, None, 0, 255, cv2.NORM_MINMAX)
    return Image.fromarray(bump_map.astype(np.uint8))
