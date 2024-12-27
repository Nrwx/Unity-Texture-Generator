import cv2
import numpy as np

def apply_brightness_contrast(img, brightness=100, contrast=50):
    """
    Wendet Helligkeit und Kontrast auf das Bild an, ähnlich wie in Photoshop.
    Der Helligkeitsbereich geht von 0 bis 200, der Kontrastbereich von 0 bis 100.
    :param img: Eingabebild (OpenCV BGR Format)
    :param brightness: Helligkeitseinstellung (0 bis 200)
    :param contrast: Kontrasteinstellung (0 bis 100)
    :return: Bearbeitetes Bild
    """
    # Umwandlung des Bildes in float32 für präzise Berechnungen
    img = img.astype(np.float32)

    # **Helligkeit anwenden**:
    # Der Helligkeitsbereich geht von 0 bis 200, mit einem Mittelwert bei 100
    # Feinerer Bereich, von [0, 200] wird auf [-255, 255] skaliert
    brightness = (brightness - 100) * 1.27  # Skaliert Helligkeit auf den Bereich -255 bis +255
    img += brightness  # Alle Pixel gleichmäßig verschieben

    # **Kontrast anwenden**:
    # Der Kontrastbereich geht von 0 bis 100, mit dem Mittelwert bei 50
    # Umrechnung von [0, 100] auf den Bereich [1.0, 3.0] mit weicheren Übergängen
    contrast = (contrast - 50) / 50.0  # Umrechnung von [0, 100] auf [0.0, 2.0]
    contrast += 1.0  # Der Mittelwert 50 wird auf 1.0 gesetzt (neutral)

    # Anwendung des Kontrasts:
    img = (img - 128) * contrast + 128  # Kontrastanpassung, Mittelpunkt bei 128 (neutral)

    # **Schärfen der dunklen Bereiche**:
    # Hier wird ein nichtlinearer Effekt verwendet, um die dunklen Bereiche mehr zu betonen
    if contrast < 1.0:
        img = np.clip(img, 0, 255)  # Begrenzung auf [0, 255], keine Überbelichtung

    # **Feine Anpassung der Pixelwerte**:
    img = np.clip(img, 0, 255)  # Pixelwerte auf den Bereich 0 bis 255 begrenzen

    # Konvertiere das Bild zurück in uint8 (OpenCV erwartet dies für die Anzeige)
    img = img.astype(np.uint8)

    return img
