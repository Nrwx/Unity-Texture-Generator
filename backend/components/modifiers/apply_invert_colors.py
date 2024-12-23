from PIL import Image
import numpy as np

def apply_invert_colors(image, invert_colors=True):
    """
    Invertiert die Farben des Bildes, falls `invert_colors` aktiviert ist.

    :param image: Das Eingabebild (PIL.Image oder numpy Array).
    :param invert_colors: Ein boolscher Wert, der angibt, ob die Farben invertiert werden sollen.
                          Standardmäßig auf True gesetzt.
    :return: Das invertierte Bild (PIL.Image).
    """

    # Überprüfen, ob das Bild ein PIL.Image-Objekt oder ein numpy-Array ist
    if isinstance(image, Image.Image):
        # Umwandeln des PIL-Bildes in ein numpy-Array
        img_array = np.array(image)
    else:
        img_array = image

    # Wenn invert_colors True ist, invertiere die Farben
    if invert_colors:
        # Invertiere das Bild: 255 - Bildwert
        img_array = 255 - img_array

    # Rückgabe des bearbeiteten Bildes als PIL.Image
    return Image.fromarray(img_array)
