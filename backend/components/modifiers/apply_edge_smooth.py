import numpy as np
import cv2
from PIL import Image

def apply_edge_smooth(pil_img, edge_threshold=(1, 250), mask_expand=1.5, sharpness_boost=1.2):
    """
    Intelligente Kantenrestaurierung für transformierte Bilder mit halbtransparenten Kanten.
    Kombiniert edge-preserving Blur, Highpass-Schärfung und selektives Blending.
    """

    if pil_img.mode != "RGBA":
        pil_img = pil_img.convert("RGBA")

    np_img = np.array(pil_img)
    b, g, r, a = cv2.split(np_img)

    # Halbtransparente Pixel identifizieren (z. B. durch Rotation entstanden)
    edge_mask = cv2.inRange(a, edge_threshold[0], edge_threshold[1])

    if mask_expand > 0:
        edge_mask = cv2.GaussianBlur(edge_mask, (0, 0), mask_expand)
        edge_mask = np.clip(edge_mask, 0, 255).astype(np.uint8)

    # Edge-Maske in float
    edge_alpha = edge_mask.astype(np.float32) / 255.0
    edge_alpha = edge_alpha[..., np.newaxis]

    # --- Edge-preserving Blur statt Gaussian ---
    rgb = cv2.merge((b, g, r))
    smooth_rgb = cv2.bilateralFilter(rgb, d=5, sigmaColor=50, sigmaSpace=5)
    smooth = cv2.merge((*cv2.split(smooth_rgb), a))  # RGBA wiederherstellen

    # --- Highpass-Boost für Schärfung ---
    blurred = cv2.GaussianBlur(np_img, (0, 0), 2.0)
    highpass = cv2.addWeighted(np_img, 1 + sharpness_boost, blurred, -sharpness_boost, 0)

    # Combine smooth and sharpened edges
    combined = highpass.astype(np.float32) * edge_alpha + smooth.astype(np.float32) * (1 - edge_alpha)

    # Nur betroffene Kanten mischen, Rest bleibt original
    result_np = np_img.astype(np.float32) * (1 - edge_alpha) + combined * edge_alpha
    result_np = np.clip(result_np, 0, 255).astype(np.uint8)

    return Image.fromarray(result_np)
