from PIL import Image
import numpy as np

def apply_crop_image(image, crop_left, crop_top, crop_right, crop_bottom):
    """
    Schneidet das Bild entsprechend den angegebenen Werten zu.
    Funktioniert sowohl mit PIL Image als auch mit NumPy Array als Eingabe.
    """
    # Überprüfen, ob das Bild ein PIL Image oder ein NumPy Array ist
    if isinstance(image, np.ndarray):
        image = Image.fromarray(image)

    width, height = image.size
    return image.crop((
        crop_left,
        crop_top,
        width - crop_right,
        height - crop_bottom
    ))
