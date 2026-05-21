import numpy as np
from PIL import Image


def apply_cut_out(image: Image.Image, mask: Image.Image, invert=True) -> Image.Image:
    """
    Erzeugt Transparenz anhand einer Maske.

    invert=True:
        Schwarz = behalten
        Weiß = ausschneiden

    invert=False:
        Weiß = behalten
        Schwarz = ausschneiden
    """

    if isinstance(image, np.ndarray):
        image = Image.fromarray(image)

    if isinstance(mask, np.ndarray):
        mask = Image.fromarray(mask)

    image = image.convert("RGBA")
    mask = mask.resize(image.size).convert("L")

    alpha_data = np.array(mask, dtype=np.uint8)

    if invert:
        alpha_data = 255 - alpha_data

    image_data = np.array(image)
    image_data[:, :, 3] = alpha_data

    return Image.fromarray(image_data.astype(np.uint8), "RGBA")