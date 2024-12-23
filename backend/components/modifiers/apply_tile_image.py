from PIL import Image
import numpy as np

def apply_tile_image(image, tile_x, tile_y):
    """
    Wiederholt das Bild in einem Raster von Kacheln basierend auf den angegebenen Kachelzahlen (x, y).
    :param image: PIL.Image oder numpy Array - Das ursprüngliche Bild.
    :param tile_x: int - Anzahl der horizontalen Kacheln.
    :param tile_y: int - Anzahl der vertikalen Kacheln.
    :return: numpy Array - Das neu erstellte gekachelte Bild.
    """
    # Überprüfen, ob das Bild ein PIL Image ist, und in NumPy Array umwandeln, wenn ja
    if isinstance(image, Image.Image):
        img_array = np.array(image)
    else:
        img_array = image

    original_height, original_width, channels = img_array.shape

    # Berechne die Größe jeder Kachel in Pixeln
    tile_width = original_width // tile_x
    tile_height = original_height // tile_y

    # Neues Bild erstellen, das groß genug ist, um alle Kacheln zu füllen
    new_image_array = np.zeros((tile_height * tile_y, tile_width * tile_x, channels), dtype=np.uint8)

    # Wiederhole das Bild in x- und y-Richtung, um das neue Bild zu füllen
    for i in range(tile_x):
        for j in range(tile_y):
            # Berechne die Position der Kachel im neuen Bild
            left = i * tile_width
            top = j * tile_height

            # Extrahiere und skaliere das Bild, um die Kachelgröße zu erhalten
            tile = img_array[:tile_height, :tile_width]  # Beispielweise Kachel von oben links
            new_image_array[top:top + tile_height, left:left + tile_width] = tile

    return new_image_array
