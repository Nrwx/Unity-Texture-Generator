from PIL import Image
import numpy as np

def apply_random_shift(img, width, height, max_shift_ratio):
    """
    Verschiebt das Bild zufällig basierend auf dem angegebenen Maximalwert.
    Unterstützt sowohl PIL Images als auch NumPy Arrays.

    :param img: Das Eingabebild (PIL.Image oder numpy Array).
    :param width: Breite des Bildes.
    :param height: Höhe des Bildes.
    :param max_shift_ratio: Der maximal mögliche Verschiebungsfaktor.
    :return: Das zufällig verschobene Bild (numpy Array).
    """
    # Prüfen, ob das Bild ein PIL Image ist
    if isinstance(img, Image.Image):
        img_array = np.array(img)  # Konvertiere PIL Image in NumPy Array
    elif isinstance(img, np.ndarray):
        img_array = img  # Falls es schon ein NumPy Array ist, nutze es direkt
    else:
        raise TypeError("Das Bild muss entweder ein PIL Image oder ein NumPy Array sein.")

    # Zufällige Verschiebung berechnen
    random_shift_x = np.random.randint(-int(width * max_shift_ratio), int(width * max_shift_ratio))
    random_shift_y = np.random.randint(-int(height * max_shift_ratio), int(height * max_shift_ratio))

    # Verschiebung anwenden
    img_array = np.roll(img_array, shift=random_shift_x, axis=1)
    img_array = np.roll(img_array, shift=random_shift_y, axis=0)

    return img_array
