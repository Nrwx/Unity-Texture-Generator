import numpy as np
import cv2
from PIL import Image

def generate_grass_map(
    img, base_brightness, base_opacity, base_contrast, base_sharpness, blur, blur_mode, base_tile_x, base_tile_y, base_fade_alpha
):
    """
    Erstellt eine Grastextur basierend auf den gegebenen Parametern.
    """
    # Konvertiere das Bild in ein numpy-Array
    img_array = np.array(img)
    height, width, channels = img_array.shape

    # --- Schritt 1: Helligkeit und Kontrast anwenden ---
    img_array = cv2.convertScaleAbs(img_array, alpha=base_contrast, beta=int((base_brightness - 1) * 255))

    # --- Schritt 2: Schärfen des Bildes ---
    if base_sharpness > 1:
        kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]]) * base_sharpness
        img_array = cv2.filter2D(img_array, -1, kernel)

    # --- Schritt 3: Weichzeichnungsfilter anwenden ---
    if blur > 0:
        if blur_mode == 1:
            img_array = cv2.GaussianBlur(img_array, (15, 15), blur)
        elif blur_mode == 2:
            # Radialer Weichzeichner durch kreisförmige Maske
            fade_mask = np.zeros((height, width), dtype=np.float32)
            cv2.circle(fade_mask, (width // 2, height // 2), min(width, height) // 2, 1, -1)
            fade_mask = cv2.GaussianBlur(fade_mask, (21, 21), 0) * blur
            img_array = (img_array * fade_mask[..., None]).astype(np.uint8)

    # --- Schritt 4: Kachelgröße berechnen ---
    tile_width = width // base_tile_x
    tile_height = height // base_tile_y

    # Bildgröße auf ein Vielfaches der Kachelgröße zuschneiden
    img_array = img_array[:tile_height * base_tile_y, :tile_width * base_tile_x]

    # --- Schritt 5: Tiles generieren ---
    tiles = []
    for i in range(base_tile_y):
        for j in range(base_tile_x):
            tile = img_array[i * tile_height:(i + 1) * tile_height, j * tile_width:(j + 1) * tile_width]
            tiles.append(tile)

    # --- Schritt 6: Fade-Effekt (base_fade_alpha) auf Kacheln anwenden ---
    for i in range(len(tiles)):
        fade_mask = np.zeros((tile_height, tile_width), dtype=np.float32)
        cv2.circle(fade_mask, (tile_width // 2, tile_height // 2), min(tile_width, tile_height) // 2, 1, -1)
        fade_mask = cv2.GaussianBlur(fade_mask, (15, 15), 0) * (1 - base_fade_alpha) + base_fade_alpha
        tiles[i] = (tiles[i] * fade_mask[..., None]).astype(np.uint8)

    # --- Schritt 7: Tiles zu einer neuen Textur zusammensetzen ---
    output_texture = np.zeros_like(img_array)
    for i in range(base_tile_y):
        for j in range(base_tile_x):
            output_texture[
                i * tile_height:(i + 1) * tile_height,
                j * tile_width:(j + 1) * tile_width,
            ] = tiles[i * base_tile_x + j]

    # --- Schritt 8: Opacity (Deckkraft) anwenden ---
    if base_opacity < 1.0:
        overlay = np.zeros_like(output_texture)
        output_texture = cv2.addWeighted(output_texture, base_opacity, overlay, 1 - base_opacity, 0)

    # --- Schritt 9: Rückgabe des Ergebnisses ---
    return Image.fromarray(output_texture)
