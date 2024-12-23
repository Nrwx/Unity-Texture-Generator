from PIL import Image
import numpy as np

def apply_distort(image, distortion_factor=0.2):
    """
    Wendet eine Verzerrung an, die das Bild in zufällige Richtungen dehnt.

    :param image: Das Eingabebild (PIL.Image oder numpy Array).
    :param distortion_factor: Der Verzerrungsfaktor, der die Stärke der Verzerrung steuert.
    :return: Das verzerrte Bild (numpy Array).
    """
    # Wenn das Bild ein PIL Image ist, konvertiere es zu einem NumPy Array
    if isinstance(image, Image.Image):
        img_array = np.array(image)
    else:
        img_array = image

    height, width, channels = img_array.shape

    # Verzerrung anwenden
    for y in range(height):
        for x in range(width):
            dx = int(distortion_factor * (np.random.random() - 0.5) * width)
            dy = int(distortion_factor * (np.random.random() - 0.5) * height)
            new_x = np.clip(x + dx, 0, width - 1)
            new_y = np.clip(y + dy, 0, height - 1)
            img_array[y, x] = img_array[new_y, new_x]

    return img_array
