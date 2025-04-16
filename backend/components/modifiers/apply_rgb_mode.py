import numpy as np
from PIL import Image, ImageFilter
import cv2
from utils.rgba import apply_rgb_rgba, apply_alpha

def apply_rgb_mode(image, mode: int = 0) -> Image.Image:
    """
    RGB-Optimierungsmodi zur Pre-Kompression und FX-Pipeline-Vorbereitung.
    """

    # Alpha extrahieren, falls vorhanden
    image_rgb, alpha_channel = apply_rgb_rgba(image)

    if not isinstance(image_rgb, Image.Image):
        image_rgb = Image.fromarray(image_rgb)

    arr = np.array(image_rgb).astype(np.float32) / 255.0
    rgb = arr[..., :3]

    # 🎨 Farbraum / Gamma
    if mode == 0:
        result = rgb
    elif mode == 1:  # sRGB -> Linear
        result = np.power(rgb, 2.2)
    elif mode == 2:  # Linear -> sRGB
        result = np.power(rgb, 1 / 2.2)

    # 🧪 Konvertierungen
    elif mode == 3:
        gray = np.mean(rgb, axis=-1, keepdims=True)
        result = np.repeat(gray, 3, axis=-1)
    elif mode == 4:
        result = rgb[..., ::-1]  # BGR
    elif mode == 5:
        gray = np.dot(rgb, [0.3, 0.59, 0.11])
        result = np.repeat(gray[..., np.newaxis], 3, axis=-1)
    elif mode == 6:
        result = np.clip(rgb, 0.05, 1.0)

    # ⚙️ Engine Hacks
    elif mode == 7:
        norm = np.linalg.norm(rgb, axis=-1, keepdims=True)
        norm[norm == 0] = 1
        result = rgb / norm
    elif mode == 8:
        img_gray = Image.fromarray((np.mean(rgb, axis=-1) * 255).astype(np.uint8))
        edges = img_gray.filter(ImageFilter.FIND_EDGES)
        edges_np = np.array(edges)
        result = np.repeat(edges_np[..., np.newaxis], 3, axis=-1) / 255.0
    elif mode == 9:
        threshold = (rgb > 0.1).astype(np.float32)
        result = rgb * threshold

    # 🌈 FX Tools
    elif mode == 10:
        result = 1.0 - rgb
    elif mode == 11:
        blurred = cv2.GaussianBlur((rgb * 255).astype(np.uint8), (7, 7), 0)
        highpass = (rgb * 255 - blurred).clip(0, 255)
        return Image.fromarray(highpass.astype(np.uint8), 'RGB')
    elif mode == 12:
        stretched = (rgb - rgb.min()) / (rgb.max() - rgb.min() + 1e-5)
        result = stretched

    else:
        result = rgb

    result = (result * 255).clip(0, 255).astype(np.uint8)

    # Erstelle PIL-Image
    rgb_image = Image.fromarray(result, 'RGB')

    # Optional: alpha wieder drüberlegen (falls du das brauchst)
    # return apply_alpha(rgb_image, alpha_channel)

    return apply_alpha(rgb_image, alpha_channel)
