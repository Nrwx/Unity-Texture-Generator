from PIL import Image

def alpha_as_bg(image, background_color=(255, 255, 255)):
    """
    Entfernt den Alpha-Kanal eines Bildes und setzt einen Hintergrund (Standard: weiß),
    um Transparenz korrekt darzustellen.

    Args:
        image (PIL.Image.Image): Das Eingabebild.
        background_color (tuple): RGB-Farbe für den Hintergrund.

    Returns:
        PIL.Image.Image: Ein Bild ohne Alpha-Kanal.
    """
    if image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info):
        alpha = image.convert('RGBA')
        background = Image.new('RGB', alpha.size, background_color)
        background.paste(alpha, mask=alpha.split()[3])  # Alphakanal als Maske
        return background
    else:
        return image.convert('RGB')
