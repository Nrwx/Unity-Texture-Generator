from PIL import Image
import cv2
import numpy as np
def generate_normal_map(image):
    """Erstellt eine Normal Map."""
    gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
    sobel_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    magnitude = cv2.magnitude(sobel_x, sobel_y)
    normal_map = cv2.normalize(magnitude, None, 0, 255, cv2.NORM_MINMAX)
    return Image.fromarray(normal_map.astype(np.uint8))
