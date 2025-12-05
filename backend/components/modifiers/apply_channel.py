from PIL import Image

def apply_channel(img: Image.Image, channel_config: dict) -> Image.Image:
    if img is None:
        return None

    base = img.convert("RGBA")
    r, g, b, a = base.split()

    # RGB-Kanäle auf 0 setzen, wenn False
    r = r if channel_config.get("red", True) else Image.new("L", base.size, 0)
    g = g if channel_config.get("green", True) else Image.new("L", base.size, 0)
    b = b if channel_config.get("blue", True) else Image.new("L", base.size, 0)
    # Alpha auf 0 setzen, wenn deaktiviert
    a = a if channel_config.get("alpha", True) else Image.new("L", base.size, 0)

    result = Image.merge("RGBA", (r, g, b, a))

    # Grey-Flag: Durchschnitt der RGB-Kanäle berechnen
    if channel_config.get("grey", False):
        grey = result.convert("L")
        result = Image.merge("RGBA", (grey, grey, grey, a))

    # Cyan-Flag: CMYK C-Kanal verwenden, Rest auf 0
    if channel_config.get("cyan", False):
        cmyk = result.convert("CMYK")
        c, _, _, _ = cmyk.split()
        result = Image.merge("RGBA", (c, c, c, a))

    # Combined = Originalbild, keine Änderung notwendig
    if channel_config.get("combined", False):
        return base

    return result
