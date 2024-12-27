from PIL import Image
import numpy as np
import cv2

def apply_hue_rotation(image, hue_variation=0):
    """
    Wendet eine Farbtonvariation auf das Bild an.

    :param image: Das Eingabebild (PIL.Image oder numpy Array).
    :param hue_variation: Der Wert der Farbtonvariation. Positiv für eine Verschiebung nach rechts, negativ für eine Verschiebung nach links.
    :return: Das bearbeitete Bild (PIL.Image).
    """

    # Überprüfen, ob das Bild ein PIL.Image-Objekt oder ein numpy-Array ist
    if isinstance(image, Image.Image):
        # Umwandeln des PIL-Bildes in ein numpy-Array
        img_array = np.array(image)
    else:
        img_array = image

    # Konvertiere das Bild in den HSV-Farbraum (Hue, Saturation, Value)
    hsv_img = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)

    # Wende die Farbtonvariation an (die Hue-Komponente liegt zwischen 0 und 179 für OpenCV)
    if hue_variation != 0:
        hsv_img[:, :, 0] = (hsv_img[:, :, 0] + hue_variation) % 180  # Den Farbton (Hue) modifizieren

    # Konvertiere zurück in das RGB-Farbsystem
    rotated_img = cv2.cvtColor(hsv_img, cv2.COLOR_HSV2RGB)

    # Rückgabe des bearbeiteten Bildes als PIL.Image
    return rotated_img
