from PIL import Image
import numpy as np

def apply_rgb_rgba(image):
    """
    Stellt sicher, dass das Bild im RGB- oder RGBA-Format vorliegt.
    Wenn das Bild im RGBA-Modus vorliegt, wird der Alpha-Kanal extrahiert und das Bild in RGB konvertiert.
    Nach der Bearbeitung wird der Alpha-Kanal wieder hinzugefügt.

    Args:
        image (PIL.Image): Das Bild, das überprüft und konvertiert werden muss.

    Returns:
        PIL.Image: Das Bild im RGB-Modus oder mit wiederhergestelltem RGBA-Modus.
    """
    if image.mode == 'RGBA':
        # Speichern des Alpha-Kanals
        alpha_channel = np.array(image.getchannel('A'))
        # Bild in RGB konvertieren (Alpha-Kanal entfernen)
        image = image.convert('RGB')
        return image, alpha_channel
    else:
        return image, None

def apply_alpha(image, alpha_channel):
    """
    Fügt den gespeicherten Alpha-Kanal wieder zum Bild hinzu.

    Args:
        image (PIL.Image): Das bearbeitete Bild im RGB-Modus.
        alpha_channel (np.array): Der gespeicherte Alpha-Kanal.

    Returns:
        PIL.Image: Das Bild mit wiederhergestelltem Alpha-Kanal im RGBA-Modus.
    """
    if alpha_channel is not None:
        # Den Alpha-Kanal wieder zum RGB-Bild hinzufügen
        image = np.array(image)
        image = np.dstack([image, alpha_channel])
        return Image.fromarray(image, 'RGBA')
    return image