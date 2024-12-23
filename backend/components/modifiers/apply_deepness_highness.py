from PIL import Image
import numpy as np
from PIL import ImageEnhance

def apply_deepness_highness(image, deepness_factor=1.0, highness_factor=1.0):
    """
    Wendet Anpassungen der Tiefen und Höhen auf das Bild an, um die Kontraste zu erhöhen oder zu verringern.

    :param image: Das Eingabebild (PIL.Image oder numpy Array).
    :param deepness_factor: Der Faktor für die Anpassung der Schatten (Tiefen) im Bild.
    :param highness_factor: Der Faktor für die Anpassung der Lichter (Höhen) im Bild.
    :return: Das bearbeitete Bild (PIL.Image).
    """

    # Überprüfen, ob das Bild ein PIL Image ist, und in NumPy Array umwandeln, wenn ja
    if isinstance(image, Image.Image):
        img_array = np.array(image)
    else:
        img_array = image

    # Um die Tiefen und Höhen zu beeinflussen, teilen wir das Bild in 2 Bereiche: Dunkle und Helle Pixel
    # Anpassung der Tiefen (Dunkelheit) - durch Verstärkung der dunklen Bereiche
    shadow_mask = img_array < 128  # Schattige (dunkle) Bereiche des Bildes
    img_array[shadow_mask] = np.clip(img_array[shadow_mask] * deepness_factor, 0, 255)

    # Anpassung der Lichter (Helligkeit) - durch Verstärkung der hellen Bereiche
    highlight_mask = img_array > 128  # Helle Bereiche des Bildes
    img_array[highlight_mask] = np.clip(img_array[highlight_mask] * highness_factor, 0, 255)

    # Das bearbeitete Bild zurückgeben
    return Image.fromarray(img_array)

