from PIL import Image
import numpy as np


def apply_crop_image(image, crop_left, crop_top, crop_right, crop_bottom):
    """
    Schneidet das Bild entsprechend den angegebenen Werten zu.
    Funktioniert sowohl mit PIL Image als auch mit NumPy Array als Eingabe.
    """

    if isinstance(image, np.ndarray):
        image = Image.fromarray(image)

    image = image.convert("RGBA")

    width, height = image.size

    crop_left = max(0, int(crop_left))
    crop_top = max(0, int(crop_top))
    crop_right = max(0, int(crop_right))
    crop_bottom = max(0, int(crop_bottom))

    left = crop_left
    top = crop_top
    right = width - crop_right
    bottom = height - crop_bottom

    if right <= left:
        right = left + 1

    if bottom <= top:
        bottom = top + 1

    return image.crop((left, top, right, bottom))