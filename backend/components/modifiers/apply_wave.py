from PIL import Image
import numpy as np

def apply_wave(image, wave_strength=5, wave_frequency=5):
    """
    Wendet eine Wellenverzerrung auf das Bild an, um eine wellenartige Verzerrung zu erzeugen.

    :param image: Das Eingabebild (PIL.Image oder numpy Array).
    :param wave_strength: Die Stärke der Wellenverzerrung.
    :param wave_frequency: Die Häufigkeit der Wellen.
    :return: Das verzerrte Bild (numpy Array).
    """
    # Überprüfen, ob das Bild ein PIL Image ist, und in NumPy Array umwandeln, wenn ja
    if isinstance(image, Image.Image):
        img_array = np.array(image)
    else:
        img_array = image

    height, width, channels = img_array.shape

    # Sinuswellen-Verzerrung anwenden
    for y in range(height):
        for x in range(width):
            # Berechnung der Wellenverschiebung basierend auf der Y-Position
            wave_offset = int(wave_strength * np.sin(2 * np.pi * y / wave_frequency))
            # Vertikale Wellenverschiebung auf das Bild anwenden
            img_array[y, x] = img_array[(y + wave_offset) % height, x]

    return img_array
