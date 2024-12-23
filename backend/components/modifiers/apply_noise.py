import numpy as np
from PIL import Image

def apply_noise(image, noise_level=10):
    """
    Fügt dem Bild zufälliges Rauschen hinzu. Der Rauschlevel bestimmt die Intensität des Rauschens.

    :param image: Das Eingabebild (PIL.Image oder numpy Array).
    :param noise_level: Der Level des Rauschens (zwischen 0 und 100). Standard ist 10.
    :return: Das Bild mit hinzugefügtem Rauschen (PIL.Image).
    """

    # Überprüfen, ob das Bild ein PIL.Image-Objekt oder ein numpy-Array ist
    if isinstance(image, Image.Image):
        # Umwandeln des PIL-Bildes in ein numpy-Array
        img_array = np.array(image)
    else:
        img_array = image

    # Wenn noise_level > 0, Rauschen hinzufügen
    if noise_level > 0:
        # Berechne die maximale Rauschintensität basierend auf noise_level (0 bis 100)
        noise_intensity = int(255 * (noise_level / 100))

        # Erzeuge das Rauschen, das auf das Bild angewendet wird
        noise = np.random.randint(-noise_intensity, noise_intensity, img_array.shape)

        # Rauschen zum Bild hinzufügen und auf den Bereich [0, 255] begrenzen
        img_array = np.clip(img_array + noise, 0, 255)

    # Rückgabe des bearbeiteten Bildes als PIL.Image
    return Image.fromarray(img_array)


# Beispielaufruf:
if __name__ == "__main__":
    # Beispielbild öffnen
    img = Image.open("example.jpg")

    # Wende Rauschen an (z.B. mit einem Rauschlevel von 20%)
    noisy_img = apply_noise(img, noise_level=20)
    noisy_img.show()
