from PIL import Image, ImageChops

def apply_mask(image: Image.Image, mask: Image.Image) -> Image.Image:
    if mask.mode != "L":
        mask = mask.convert("L")
    if mask.size != image.size:
        mask = mask.resize(image.size, resample=Image.BICUBIC)

    r, g, b, a = image.split()
    new_alpha = ImageChops.multiply(a, mask)
    return Image.merge("RGBA", (r, g, b, new_alpha))
