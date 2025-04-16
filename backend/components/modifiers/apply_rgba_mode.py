import numpy as np
from PIL import Image
from utils.rgba import apply_rgb_rgba, apply_alpha

def apply_rgba_mode(image, mode: int = 0) -> Image.Image:
    """
    Wendet einen Alpha-Modus an und setzt das Bild ggf. wieder zu RGBA zusammen.
    """

    # Zerlege Bild ggf. in RGB und Alpha
    image_rgb, alpha_channel = apply_rgb_rgba(image)

    # Sicherstellen, dass es ein PIL-Bild ist
    if not isinstance(image_rgb, Image.Image):
        image_rgb = Image.fromarray(image_rgb)

    # In numpy umwandeln für Verarbeitung
    data = np.array(image_rgb).astype(np.float32)
    rgb = data[..., :3]  # RGB
    alpha = alpha_channel.astype(np.float32)[..., None] / 255.0 if alpha_channel is not None else np.ones_like(rgb[..., :1])

    # Basis-Modi
    if mode == 0:
        output = np.array(image)
    elif mode == 1:
        output = np.concatenate([rgb, alpha * 255.0], axis=-1)
    elif mode == 2:
        output = np.concatenate([rgb * alpha, alpha * 255.0], axis=-1)

    # Vereinfachung
    elif mode == 3:
        alpha_bin = (alpha > 0.5).astype(np.float32)
        output = np.concatenate([rgb, alpha_bin * 255.0], axis=-1)
    elif mode == 4:
        alpha_clean = np.round(alpha * 255.0) / 255.0
        output = np.concatenate([rgb, alpha_clean * 255.0], axis=-1)

    # DXT
    elif mode == 5:
        output = np.concatenate([rgb, alpha * 255.0], axis=-1)
        a = output[..., 3]
        a[a < 8] = 0
        a[a > 248] = 255
        output[..., 3] = a
    elif mode == 6:
        alpha_1bit = (alpha > 0.5).astype(np.float32)
        output = np.concatenate([rgb, alpha_1bit * 255.0], axis=-1)
    elif mode == 7:
        is_black = np.all(rgb <= 5, axis=-1, keepdims=True)
        alpha_colorkey = np.where(is_black, 0.0, 1.0)
        output = np.concatenate([rgb, alpha_colorkey * 255.0], axis=-1)
    elif mode == 8:
        quant_alpha = np.round(alpha * 15) / 15.0
        output = np.concatenate([rgb, quant_alpha * 255.0], axis=-1)

    # UI/GFX Tools
    elif mode == 9:
        alpha_gray = np.tile(alpha * 255.0, (1, 1, 3))
        output = alpha_gray
    elif mode == 10:
        boosted = np.clip((alpha - 0.3) * 2.0, 0, 1)
        output = np.concatenate([rgb, boosted * 255.0], axis=-1)
    elif mode == 11:
        soft = np.clip((alpha - 0.4) * 5.0, 0, 1)
        output = np.concatenate([rgb, soft * 255.0], axis=-1)
    elif mode == 12:
        alpha_inverted = 1.0 - alpha
        output = np.concatenate([rgb, alpha_inverted * 255.0], axis=-1)
    elif mode == 13:
        clamped = np.clip(alpha, 0.2, 1.0)
        output = np.concatenate([rgb, clamped * 255.0], axis=-1)

    # Finalisierung
    elif mode == 14:
        output = rgb
    else:
        output = np.array(image)

    output = output.astype(np.uint8)

    # Falls das Ergebnis RGB ist → PIL-RGB-Bild
    if output.shape[-1] == 3:
        return Image.fromarray(output, 'RGB')

    # Falls das Ergebnis RGBA ist → PIL-RGBA-Bild
    return Image.fromarray(output, 'RGBA')
