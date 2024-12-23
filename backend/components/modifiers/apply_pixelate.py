from PIL import Image

def apply_pixelate(image, pixel_size=10):
    """
    Wendet einen Pixelate-Filter auf das Bild an, um den Pixelblock-Effekt zu erzeugen.

    :param image: Das Eingabebild (PIL.Image oder numpy Array).
    :param pixel_size: Die Größe des Pixelblocks.
    :return: Das pixelierte Bild (numpy Array).
    """
    img_array = np.array(image)
    height, width, channels = img_array.shape

    # Pixelblock-Effekt anwenden
    for y in range(0, height, pixel_size):
        for x in range(0, width, pixel_size):
            block = img_array[y:y+pixel_size, x:x+pixel_size]
            avg_color = block.mean(axis=(0, 1), dtype=int)  # Durchschnitt der Farben im Block
            img_array[y:y+pixel_size, x:x+pixel_size] = avg_color

    return img_array
