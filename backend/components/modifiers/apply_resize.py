import numpy as np
from PIL import Image, ImageOps
import cv2  #Für AI-Upscaling oder bilinear/bicubic mit mehr Kontrolle (optional)

# Zielauflösungen nach Index
RESIZE_OPTIONS = [
    None,  # 0 = Original (kein Resize)
    (32, 32),
    (64, 64),
    (128, 128),
    (256, 256),
    (512, 512),
    (1024, 1024),
    (2048, 2048),
    (4096, 4096),
    (8192, 8192),
]

def apply_resize(image: Image.Image, resize_index: int, resize_mode: int, upscale_method: int) -> Image.Image:
    """
    :param image: PIL.Image
    :param resize_index: Index aus selectedTargetResize
    :param resize_mode: 0 = Auto-Crop, 1 = Padding
    :param upscale_method: 0 = Nearest, 1 = Bicubic, 2 = AI (WIP)
    :return: resized PIL.Image
    """
    if resize_index == 0:
        return image  # Original beibehalten

    target_size = RESIZE_OPTIONS[resize_index]
    if not target_size:
        return image

    # Auto-Crop vs Padding
    if resize_mode == 0:
        # Auto-Crop: einfach zentriert zuschneiden auf Zielverhältnis
        image = ImageOps.fit(image, target_size, method=Image.Resampling.LANCZOS)
    else:
        # Padding (zentrieren + Hintergrund auffüllen)
        image = ImageOps.pad(image, target_size, method=Image.Resampling.LANCZOS, color=(0, 0, 0, 0))

    # Upscaling Methode
    if upscale_method == 0:
        resample = Image.NEAREST
    elif upscale_method == 1:
        resample = Image.BICUBIC
    elif upscale_method == 2:
        # Optional: AI-Upscaling via OpenCV super-resolution)
        image = ai_upscale(image, target_size)
        return image
    else:
        resample = Image.BICUBIC  # fallback

    return image.resize(target_size, resample=resample)

def ai_upscale(image: Image.Image, target_size):
    # Dummy Placeholder – echte AI-Modelle wie ESRGAN o. ä. kannst du später einbinden
    img = np.array(image)
    img = cv2.resize(img, target_size, interpolation=cv2.INTER_CUBIC)
    return Image.fromarray(img)