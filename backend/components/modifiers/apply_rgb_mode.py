import numpy as np
from PIL import Image, ImageFilter, ImageOps
import cv2

def apply_rgb_mode(image, mode: int = 0) -> np.ndarray:
    """
    RGB-Optimierungsmodi zur Pre-Kompression und FX-Pipeline-Vorbereitung.
    """

    if not isinstance(image, Image.Image):
        image = Image.fromarray(image)

    if image.mode not in ["RGB", "RGBA"]:
        image = image.convert("RGB")

    arr = np.array(image).astype(np.float32)
    has_alpha = arr.shape[-1] == 4
    rgb = arr[..., :3] / 255.0

    # --------------------------
    # 🎨 0–2: Farbraum / Gamma
    # --------------------------
    if mode == 0:
        return np.array(image)

    if mode == 1:  # sRGB -> Linear
        linear = np.power(rgb, 2.2)
        return (linear * 255).astype(np.uint8)

    if mode == 2:  # Linear -> sRGB
        srgb = np.power(rgb, 1/2.2)
        return (srgb * 255).astype(np.uint8)

    # --------------------------
    # 🧪 3–6: Konvertierungen
    # --------------------------
    if mode == 3:
        gray = np.mean(rgb, axis=-1, keepdims=True)
        return (np.repeat(gray, 3, axis=-1) * 255).astype(np.uint8)

    if mode == 4:
        bgr = rgb[..., ::-1]
        return (bgr * 255).astype(np.uint8)

    if mode == 5:
        gray = np.dot(rgb, [0.3, 0.59, 0.11])
        desat = np.repeat(gray[..., np.newaxis], 3, axis=-1)
        return (desat * 255).astype(np.uint8)

    if mode == 6:
        clamped = np.clip(rgb, 0.05, 1.0)
        return (clamped * 255).astype(np.uint8)

    # --------------------------
    # ⚙️ 7–9: Engine Hacks
    # --------------------------
    if mode == 7:
        norm = np.linalg.norm(rgb, axis=-1, keepdims=True)
        norm[norm == 0] = 1
        normalized = rgb / norm
        return (normalized * 255).astype(np.uint8)

    if mode == 8:
        img_gray = Image.fromarray((np.mean(rgb, axis=-1) * 255).astype(np.uint8))
        edges = img_gray.filter(ImageFilter.FIND_EDGES)
        edges_np = np.array(edges)
        return np.repeat(edges_np[..., np.newaxis], 3, axis=-1)

    if mode == 9:
        threshold = (rgb > 0.1).astype(np.float32)
        return (rgb * threshold * 255).astype(np.uint8)

    # --------------------------
    # 🌈 10–12: FX Tools
    # --------------------------
    if mode == 10:
        inverted = 1.0 - rgb
        return (inverted * 255).astype(np.uint8)

    if mode == 11:
        lowpass = cv2.GaussianBlur((rgb * 255).astype(np.uint8), (7, 7), 0)
        highpass = (rgb * 255 - lowpass).clip(0, 255)
        return highpass.astype(np.uint8)

    if mode == 12:
        stretched = (rgb - rgb.min()) / (rgb.max() - rgb.min() + 1e-5)
        return (stretched * 255).astype(np.uint8)

    # Fallback: Original
    return np.array(image)