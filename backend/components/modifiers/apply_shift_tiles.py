import numpy as np
from PIL import Image

def apply_shift_tiles(tiles, tile_x, tile_y, max_shift_ratio, mode):
    """
    Verschiebt und mischt die Tiles basierend auf der Mischlogik.

    Parameter:
    - tiles: Liste der Kacheln (Tiles) als Numpy-Arrays oder PIL Images.
    - tile_x: Anzahl der horizontalen Tiles.
    - tile_y: Anzahl der vertikalen Tiles.
    - max_shift_ratio: Maximale Verschiebung der Tiles als Anteil der Tile-Größe (0 bis 1).
    - mode: Mischmodus, als Integer:
        - 1: Alle Tiles werden gemischt (Standard).
        - 2: Nur die äußeren Tiles werden gemischt (ab 3x3 Tiles verfügbar).
        - 3: Nur die inneren Tiles werden gemischt (ab 3x3 Tiles verfügbar).

    Rückgabe:
    - shifted_tiles: Die gemischten Tiles als Liste von Numpy-Arrays.
    """
    total_tiles = len(tiles)
    tile_width = tiles[0].shape[1]
    tile_height = tiles[0].shape[0]

    # Hilfsfunktion, um die Indexe der äußeren und inneren Tiles zu bestimmen
    def get_outer_inner_indices():
        outer_indices = set()
        inner_indices = set()

        for i in range(tile_y):
            for j in range(tile_x):
                index = i * tile_x + j
                # Äußere Tiles
                if i == 0 or i == tile_y - 1 or j == 0 or j == tile_x - 1:
                    outer_indices.add(index)
                else:
                    inner_indices.add(index)

        return outer_indices, inner_indices

    # Index-Sets für äußere und innere Tiles, falls Modus das benötigt
    outer_indices, inner_indices = get_outer_inner_indices()

    # Zielindizes für den Mischmodus auswählen
    if mode == 1:  # "Alle Tiles" (all)
        indices_to_mix = list(range(total_tiles))
    elif mode == 2 and tile_x > 3 and tile_y > 3:  # "Äußere Tiles" (outer)
        indices_to_mix = list(outer_indices)
    elif mode == 3 and tile_x > 3 and tile_y > 3:  # "Innere Tiles" (inner)
        indices_to_mix = list(inner_indices)
    else:
        raise ValueError("Ungültiger Mischmodus oder zu wenige Tiles für diesen Modus.")

    # Tiles kopieren, um die Reihenfolge zu mischen
    tiles_to_mix = [tiles[i] for i in indices_to_mix]

    # Tiles zufällig mischen
    np.random.shuffle(tiles_to_mix)

    # Verschiebung anwenden
    shifted_tiles = tiles.copy()
    for i, idx in enumerate(indices_to_mix):
        # Wähle ein zufälliges Offset für x und y basierend auf max_shift_ratio
        shift_x = int(np.random.uniform(-max_shift_ratio, max_shift_ratio) * tile_width)
        shift_y = int(np.random.uniform(-max_shift_ratio, max_shift_ratio) * tile_height)

        # Wenn das Tile ein PIL Image ist, konvertiere es in ein NumPy Array
        if isinstance(tiles_to_mix[i], Image.Image):
            tile_array = np.array(tiles_to_mix[i])
        else:
            tile_array = tiles_to_mix[i]

        # Verschiebe das Tile und speichere es in der Liste
        shifted_tile = np.roll(tile_array, shift_x, axis=1)  # Horizontal
        shifted_tile = np.roll(shifted_tile, shift_y, axis=0)  # Vertikal

        # Wenn das Tile als NumPy Array vorliegt, speichere es als NumPy Array, ansonsten als PIL Image
        if isinstance(tiles_to_mix[i], Image.Image):
            shifted_tiles[idx] = Image.fromarray(shifted_tile)
        else:
            shifted_tiles[idx] = shifted_tile

    return shifted_tiles
