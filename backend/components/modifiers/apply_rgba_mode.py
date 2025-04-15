import numpy as np
from PIL import Image

def apply_rgba_mode(image, mode: int = 0) -> np.ndarray:
    """
    Alpha-Optimierungs-Modi für Texture-/UI-/VFX-/Game-Pipelines

    Gruppen:
    0–2   = Basis-Modi
    3–4   = Vereinfachung/Quantisierung
    5–8   = DXT-Kompatibilität
    9–13  = UI/GFX/FX-Tools
    14    = Finalisierung/Postprozesse
    """

    if not isinstance(image, Image.Image):
        image = Image.fromarray(image)

    if mode in range(1, 15) and image.mode != "RGBA":
        image = image.convert("RGBA")

    data = np.array(image).astype(np.float32)
    rgb = data[..., :3]
    has_alpha = data.shape[-1] == 4
    alpha = data[..., 3:4] / 255.0 if has_alpha else np.ones_like(rgb[..., :1])

    # -------------------------
    # 🟦 Basis-Modi (0–2)
    # -------------------------
    if mode == 0:
        return np.array(image)

    if mode == 1:
        return np.concatenate([rgb, alpha * 255.0], axis=-1).astype(np.uint8)

    if mode == 2:
        return np.concatenate([rgb * alpha, alpha * 255.0], axis=-1).astype(np.uint8)

    # -------------------------
    # ⬛ Vereinfachung (3–4)
    # -------------------------
    if mode == 3:
        alpha_bin = (alpha > 0.5).astype(np.float32)
        return np.concatenate([rgb, alpha_bin * 255.0], axis=-1).astype(np.uint8)

    if mode == 4:
        alpha_clean = np.round(alpha * 255.0) / 255.0
        return np.concatenate([rgb, alpha_clean * 255.0], axis=-1).astype(np.uint8)

    # -------------------------
    # 🟥 DXT-Kompatibilität (5–8)
    # -------------------------
    if mode == 5:
        result = np.concatenate([rgb, alpha * 255.0], axis=-1).astype(np.uint8)
        a = result[..., 3]
        a[a < 8] = 0
        a[a > 248] = 255
        result[..., 3] = a
        return result

    if mode == 6:
        alpha_1bit = (alpha > 0.5).astype(np.float32)
        return np.concatenate([rgb, alpha_1bit * 255.0], axis=-1).astype(np.uint8)

    if mode == 7:
        is_black = np.all(rgb <= 5, axis=-1, keepdims=True)
        alpha_colorkey = np.where(is_black, 0.0, 1.0)
        return np.concatenate([rgb, alpha_colorkey * 255.0], axis=-1).astype(np.uint8)

    if mode == 8:
        quant_alpha = np.round(alpha * 15) / 15.0
        return np.concatenate([rgb, quant_alpha * 255.0], axis=-1).astype(np.uint8)

    # -------------------------
    # 🟨 GFX/UI/Design Tools (9–13)
    # -------------------------
    if mode == 9:
        alpha_gray = np.tile(alpha * 255.0, (1, 1, 3))
        return alpha_gray.astype(np.uint8)

    if mode == 10:
        boosted = np.clip((alpha - 0.3) * 2.0, 0, 1)
        return np.concatenate([rgb, boosted * 255.0], axis=-1).astype(np.uint8)

    if mode == 11:
        soft = np.clip((alpha - 0.4) * 5.0, 0, 1)
        return np.concatenate([rgb, soft * 255.0], axis=-1).astype(np.uint8)

    if mode == 12:
        alpha_inverted = 1.0 - alpha
        return np.concatenate([rgb, alpha_inverted * 255.0], axis=-1).astype(np.uint8)

    if mode == 13:
        clamped = np.clip(alpha, 0.2, 1.0)
        return np.concatenate([rgb, clamped * 255.0], axis=-1).astype(np.uint8)

    # -------------------------
    # 🟩 Finalisierung (14)
    # -------------------------
    if mode == 14:
        return rgb.astype(np.uint8)

    # -------------------------
    # Default fallback
    # -------------------------
    return np.array(image)
