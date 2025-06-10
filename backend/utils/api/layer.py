from PIL import Image
import math
from components import apply_edge_smooth

def layer_transform(layer, img, apply_opacity=True, apply_smooth=None):
    """
    Führt Transformationen auf ein Layer-Bild aus: rotate → scale → translate.
    Gibt transformiertes Bild und Position (paste_x, paste_y) zurück.
    """

    matrix = layer.get("matrix", {
        "a": 1, "b": 0, "c": 0, "d": 1,
        "x": 0, "y": 0, "rotate": 0
    })
    scale_x = matrix.get("a", 1)
    scale_y = matrix.get("d", 1)
    pos_x = matrix.get("x", 0)
    pos_y = matrix.get("y", 0)
    rotate_angle = float(matrix.get("rotate", 0))

    original_width, original_height = img.size
    center_x = original_width / 2
    center_y = original_height / 2

    # 1. Rotation (optional mit Kantenglättung)
    if rotate_angle != 0:
        img = img.rotate(-rotate_angle, resample=Image.BICUBIC, expand=True, center=(center_x, center_y))
        if apply_smooth:
            img = apply_edge_smooth(img)

    # 2. Skalierung
    rotated_width, rotated_height = img.size
    new_width = int(round(rotated_width * scale_x))
    new_height = int(round(rotated_height * scale_y))
    img = img.resize((new_width, new_height), resample=Image.BICUBIC)

    # 3. Alphakanal-Opacity anwenden
    if apply_opacity and layer.get("opacity", 1.0) < 1.0:
        r, g, b, a = img.split()
        a = a.point(lambda p: int(p * layer["opacity"]))
        img = Image.merge("RGBA", (r, g, b, a))

    # 4. Translation / Positionierung
    center_scaled_x = new_width / 2
    center_scaled_y = new_height / 2
    offset_x = center_scaled_x - center_x
    offset_y = center_scaled_y - center_y

    paste_x = int(round(pos_x - offset_x))
    paste_y = int(round(pos_y - offset_y))

    return img, paste_x, paste_y
