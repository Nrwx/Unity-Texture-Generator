from PIL import Image
import numpy as np
import cv2

def apply_hue_rotation(image, hue_variation=0):
    """
    Wendet eine Farbtonvariation auf das Bild an.
    OpenCV Hue liegt im Bereich 0–179.
    Frontend-Wert liegt bei -180 bis 180.
    """

    if isinstance(image, Image.Image):
        img_array = np.array(image)
    else:
        img_array = image

    if img_array is None:
        raise ValueError("image is None")

    # Falls RGBA reinkommt, Alpha sichern und nur RGB rotieren.
    alpha = None

    if img_array.ndim == 3 and img_array.shape[2] == 4:
        alpha = img_array[:, :, 3]
        img_array = img_array[:, :, :3]

    img_array = np.clip(img_array, 0, 255).astype(np.uint8)

    hsv_img = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)

    hue_value = int(hue_variation or 0)

    if hue_value != 0:
        # Wichtig: vorher nach int16/int32 casten, damit negative Werte erlaubt sind.
        hue_channel = hsv_img[:, :, 0].astype(np.int16)
        hue_channel = (hue_channel + hue_value) % 180
        hsv_img[:, :, 0] = hue_channel.astype(np.uint8)

    rotated_img = cv2.cvtColor(hsv_img, cv2.COLOR_HSV2RGB)

    if alpha is not None:
        rotated_img = np.dstack((rotated_img, alpha))

    return rotated_img