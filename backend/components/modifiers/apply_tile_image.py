from PIL import Image

def apply_tile_image(image, tile_x, tile_y):
    """
    Wiederholt das Bild in einem Raster von Kacheln basierend auf den angegebenen Kachelzahlen (x, y).
    Extrahiert den Alpha-Kanal, wenn vorhanden, und stellt sicher, dass Transparenz erhalten bleibt.

    :param image: PIL.Image - Das ursprüngliche Bild.
    :param tile_x: int - Anzahl der horizontalen Kacheln.
    :param tile_y: int - Anzahl der vertikalen Kacheln.
    :return: PIL.Image - Das neu erstellte gekachelte Bild mit erhaltenem Alpha-Kanal.
    """
    original_width, original_height = image.size

    # Überprüfe, ob das Bild einen Alpha-Kanal (Transparenz) hat
    if image.mode == "RGBA":
        # Extrahiere den Alpha-Kanal
        r, g, b, alpha = image.split()
        image_without_alpha = Image.merge("RGB", (r, g, b))  # Entferne den Alpha-Kanal für das Kacheln
    else:
        image_without_alpha = image
        alpha = None

    # Berechne die Größe jeder Kachel in Pixeln
    tile_width = int(original_width * (100 / tile_x) / 100)
    tile_height = int(original_height * (100 / tile_y) / 100)

    # Neues Bild erstellen (mit oder ohne Alpha)
    if alpha:
        new_image = Image.new("RGBA", (tile_width * tile_x, tile_height * tile_y))
    else:
        new_image = Image.new("RGB", (tile_width * tile_x, tile_height * tile_y))

    # Wiederhole das Bild in x- und y-Richtung, um das neue Bild zu füllen
    for i in range(tile_x):
        for j in range(tile_y):
            left = i * tile_width
            top = j * tile_height

            # Kachel extrahieren und skalieren
            tile = image_without_alpha.resize((tile_width, tile_height), Image.ANTIALIAS)

            # Falls Alpha-Kanal vorhanden, fügen wir ihn wieder hinzu
            if alpha:
                # Erstelle die Kachel mit dem extrahierten Alpha-Kanal
                tile_alpha = alpha.resize((tile_width, tile_height), Image.ANTIALIAS)
                tile_with_alpha = Image.merge("RGBA", (tile.split()[0], tile.split()[1], tile.split()[2], tile_alpha))
                new_image.paste(tile_with_alpha, (left, top), tile_with_alpha)
            else:
                new_image.paste(tile, (left, top))

    return new_image
