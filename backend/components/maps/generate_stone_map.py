import numpy as np
import cv2
from PIL import Image

def generate_stone_map(img, stone_size, density, intensity, stone_variance):
    """
    Generiert eine Steinkarte, die nahtlose Steine mit der angegebenen Größe, Dichte, Intensität und Variabilität enthält.
    """
    img_array = np.array(img)
    height, width, _ = img_array.shape

    # Basistextur initialisieren
    stone_map = np.zeros_like(img_array)

    # Steinmuster erstellen
    num_stones = int(density * height * width // (stone_size**2))
    for _ in range(num_stones):
        # Zufällige Position für Steine
        center_x = np.random.randint(stone_size, width - stone_size)
        center_y = np.random.randint(stone_size, height - stone_size)

        # Radius mit Variabilität berechnen
        radius = np.random.randint(
            max(1, int(stone_size * (1 - stone_variance))),
            int(stone_size * (1 + stone_variance))
        )

        # Steinfarbe mit Variabilität berechnen
        stone_color = np.clip(
            np.random.randint(intensity - 30, intensity + 30, 3),
            0, 255
        )

        # Steine als gefüllte Kreise zeichnen
        cv2.circle(stone_map, (center_x, center_y), radius, stone_color.tolist(), -1)

    # Nahtloses Mischen mit der Originaltextur
    blended_map = cv2.addWeighted(img_array, 0.6, stone_map, 0.4, 0)
    return Image.fromarray(blended_map)
