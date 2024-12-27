import numpy as np
from PIL import Image

def apply_noise(image, noise_level=10):
    """
    Fügt dem Bild zufälliges Rauschen hinzu. Der Rauschlevel bestimmt die Intensität des Rauschens.

    :param image: Das Eingabebild (PIL.Image oder numpy Array).
    :param noise_level: Der Level des Rauschens (zwischen 0 und 100). Standard ist 10.
    :return: Das Bild mit hinzugefügtem Rauschen (PIL.Image).
    """

    # Überprüfen, ob das Bild ein PIL.Image-Objekt oder ein numpy Array ist
    if isinstance(image, Image.Image):
        # Umwandeln des PIL-Bildes in ein numpy-Array
        img_array = np.array(image)
    else:
        img_array = image

    # Sicherstellen, dass das Bild ein korrektes Format hat (z. B. uint8)
    if img_array.dtype != np.uint8:
        img_array = img_array.astype(np.uint8)

    # Wenn noise_level > 0, Rauschen hinzufügen
    if noise_level > 0:
        # Berechne die maximale Rauschintensität basierend auf noise_level (0 bis 100)
        noise_intensity = int(255 * (noise_level / 100))

        # Erzeuge das Rauschen, das auf das Bild angewendet wird
        noise = np.random.randint(-noise_intensity, noise_intensity + 1, img_array.shape, dtype=np.int16)

        # Rauschen zum Bild hinzufügen und auf den Bereich [0, 255] begrenzen
        img_array = img_array.astype(np.int16) + noise

        # Stellen Sie sicher, dass die Werte im Bereich [0, 255] bleiben
        img_array = np.clip(img_array, 0, 255)

        # Umwandlung zurück zu uint8 nach der Rauschbearbeitung
        img_array = img_array.astype(np.uint8)

    # Rückgabe des bearbeiteten Bildes als PIL.Image
    return img_array
