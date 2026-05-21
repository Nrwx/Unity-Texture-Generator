from PIL import Image, ImageChops
import numpy as np


def apply_mask(image: Image.Image, mask: Image.Image) -> Image.Image:
    """
    Wendet eine Maske auf den Alpha-Kanal des Bildes an.

    Weiß = sichtbar
    Schwarz = transparent
    """

    if isinstance(image, np.ndarray):
        image = Image.fromarray(image)

    if isinstance(mask, np.ndarray):
        mask = Image.fromarray(mask)

    image = image.convert("RGBA")

    if mask.mode != "L":
        mask = mask.convert("L")

    if mask.size != image.size:
        mask = mask.resize(image.size, resample=Image.Resampling.BICUBIC)

    r, g, b, a = image.split()
    new_alpha = ImageChops.multiply(a, mask)

    return Image.merge("RGBA", (r, g, b, new_alpha))