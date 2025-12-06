# ------------------------------
# APPLY CHANNEL MIT ID SUPPORT
# ------------------------------
from PIL import Image
from utils import get_img

def _resolve_custom_channel(channel_value, default_channel, base_size):
    """
    - True → Standardkanal
    - False → Schwarz
    - str (ID) → lade Bild von ID
    """
    if channel_value is True:
        return default_channel
    if channel_value is False:
        return Image.new("L", base_size, 0)
    if isinstance(channel_value, str):
        try:
            img = get_img(channel_value).convert("L")
            if img.size != base_size:
                img = img.resize(base_size, Image.LANCZOS)
            return img
        except Exception:
            return default_channel
    return default_channel


def apply_channel(img: Image.Image, channel_config: dict) -> Image.Image:
    if img is None:
        return None

    base = img.convert("RGBA")
    r, g, b, a = base.split()
    size = base.size

    # --------------------------
    # RGB + Alpha Kanäle
    # --------------------------
    r = _resolve_custom_channel(channel_config.get("red", True), r, size)
    g = _resolve_custom_channel(channel_config.get("green", True), g, size)
    b = _resolve_custom_channel(channel_config.get("blue", True), b, size)
    a = _resolve_custom_channel(channel_config.get("alpha", True), a, size)

    result = Image.merge("RGBA", (r, g, b, a))

    # --------------------------
    # Grey
    # --------------------------
    grey_setting = channel_config.get("grey", False)
    if grey_setting:
        default_grey = result.convert("L")
        grey_img = _resolve_custom_channel(grey_setting, default_grey, size)
        result = Image.merge("RGBA", (grey_img, grey_img, grey_img, a))

    # --------------------------
    # Cyan
    # --------------------------
    cyan_setting = channel_config.get("cyan", False)
    if cyan_setting:
        default_cyan = result.convert("CMYK").split()[0]
        cyan_img = _resolve_custom_channel(cyan_setting, default_cyan, size)
        result = Image.merge("RGBA", (cyan_img, cyan_img, cyan_img, a))

    # --------------------------
    # Combined → Original
    # --------------------------
    if channel_config.get("combined", False) is True:
        return base

    return result
