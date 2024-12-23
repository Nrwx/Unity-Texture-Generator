from PIL import ImageFilter
def generate_light_map(image):
    """Erstellt eine Light Map."""
    return image.filter(ImageFilter.GaussianBlur(10))
