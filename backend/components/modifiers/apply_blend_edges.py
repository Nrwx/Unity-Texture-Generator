from PIL import Image
import numpy as np

def apply_blend_edges(img, width, height, blending_intensity):
    """
    Blendet die Ränder des Bildes nahtlos mit einstellbarer Intensität.
    Funktioniert sowohl mit PIL Image als auch mit NumPy Array als Eingabe.
    """
    # Überprüfen, ob das Bild ein PIL Image ist, und in NumPy Array umwandeln, wenn nötig
    if isinstance(img, Image.Image):
        img = np.array(img)

    # Wenn blending_intensity <= 0, keine Mischung notwendig
    if blending_intensity <= 0:
        return img

    blended_array = img.copy()
    blend_factor = blending_intensity / 100  # Normalisierung des Faktors

    # Horizontale Übergänge
    blended_array[:, :width // 4] = (
        blend_factor * img[:, :width // 4] +
        (1 - blend_factor) * np.roll(img, shift=-(width // 2), axis=1)[:, :width // 4]
    )
    blended_array[:, -width // 4:] = (
        blend_factor * img[:, -width // 4:] +
        (1 - blend_factor) * np.roll(img, shift=width // 2, axis=1)[:, -width // 4:]
    )

    # Vertikale Übergänge
    blended_array[:height // 4, :] = (
        blend_factor * img[:height // 4, :] +
        (1 - blend_factor) * np.roll(img, shift=-(height // 2), axis=0)[:height // 4, :]
    )
    blended_array[-height // 4:, :] = (
        blend_factor * img[-height // 4:, :] +
        (1 - blend_factor) * np.roll(img, shift=height // 2, axis=0)[-height // 4:, :]
    )

    return blended_array
