from PIL import Image

def apply_mask(image: Image.Image, mask: Image.Image) -> Image.Image:
    if mask not in (None, ""):
        if mask.mode != "L":
            mask = mask.convert("L")
        if mask.size != image.size:
            mask = mask.resize(image.size)
        image.putalpha(mask)
    return image