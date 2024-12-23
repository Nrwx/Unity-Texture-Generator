from PIL import Image
import numpy as np

def apply_rotation(img, rotation_angle):
    """
    Rotiert das Bild um den angegebenen `rotation_angle`.
    Unterstützt sowohl PIL Images als auch NumPy Arrays.

    :param img: Das Eingabebild (PIL.Image oder numpy Array).
    :param rotation_angle: Der Rotationswinkel in Grad.
    :return: Das rotierte Bild (numpy Array).
    """
    # Prüfen, ob das Bild ein PIL Image ist
    if isinstance(img, Image.Image):
        img_array = np.array(img)  # Konvertiere PIL Image in NumPy Array
    elif isinstance(img, np.ndarray):
        img_array = img  # Falls es schon ein NumPy Array ist, nutze es direkt
    else:
        raise TypeError("Das Bild muss entweder ein PIL Image oder ein NumPy Array sein.")

    # Bildgröße
    height, width = img_array.shape[:2]

    # Wenn der Winkel nicht 0 ist, rotiere das Bild
    if rotation_angle != 0:
        # Konvertiere das NumPy Array in ein PIL Image
        img = Image.fromarray(img_array).convert("RGBA")

        # Berechne das Zentrum des Bildes
        center_x = width / 2
        center_y = height / 2

        # Drehe das Bild um den angegebenen Winkel
        img = img.rotate(rotation_angle, resample=Image.BICUBIC, expand=True, center=(center_x, center_y), fillcolor=(0, 0, 0, 0))

        # Konvertiere das Bild nach der Rotation zurück in ein NumPy Array
        img_array = np.array(img)

    return img_array
