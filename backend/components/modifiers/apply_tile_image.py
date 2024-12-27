from PIL import Image
import numpy as np

def apply_tile_image(image, tile_x, tile_y):
    """
    Wiederholt das Bild in einem Raster von Kacheln basierend auf den angegebenen Kachelzahlen (x, y).
    :param image: PIL.Image - Das ursprüngliche Bild.
    :param tile_x: int - Anzahl der horizontalen Kacheln.
    :param tile_y: int - Anzahl der vertikalen Kacheln.
    :return: PIL.Image - Das neu erstellte gekachelte Bild.
    """
    original_width, original_height = image.size

    # Berechne die Größe jeder Kachel in Pixeln
    tile_width = int(original_width * (100 / tile_x) / 100)  # Berechnet die Breite jeder Kachel
    tile_height = int(original_height * (100 / tile_y) / 100)  # Berechnet die Höhe jeder Kachel

    # Neues Bild erstellen, das groß genug ist, um alle Kacheln zu passen
    new_image = Image.new("RGB", (tile_width * tile_x, tile_height * tile_y))

    # Wiederhole das Bild in x- und y-Richtung, um das neue Bild zu füllen
    for i in range(tile_x):
        for j in range(tile_y):
            # Berechne die Position der Kachel im neuen Bild
            left = i * tile_width
            top = j * tile_height

            # Kachel extrahieren
            tile = image.resize((tile_width, tile_height), Image.ANTIALIAS)  # Bild auf Kachelgröße anpassen
            new_image.paste(tile, (left, top))

    return new_image
