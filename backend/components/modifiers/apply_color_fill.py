import numpy as np
from PIL import Image

def hex_to_rgba(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4)) + (255,)

def color_mask(data, target_rgb, tolerance):
    # Vektorisiert: Erzeuge Maske aller Pixel, die innerhalb Toleranz liegen
    diff = np.abs(data[..., :3].astype(int) - np.array(target_rgb).reshape(1,1,3))
    mask = np.all(diff <= tolerance, axis=2)
    return mask

def apply_color_fill(image_input, x, y, fill_color, mask=None, tolerance=30):
    if isinstance(image_input, Image.Image):
        img = image_input.convert("RGBA")
        data = np.array(img)
    elif isinstance(image_input, np.ndarray):
        data = image_input.copy()
    else:
        return None, {"error": "Input must be a PIL.Image or NumPy array."}

    height, width = data.shape[:2]

    if not (0 <= x < width and 0 <= y < height):
        return None, {"error": "Click position out of image bounds."}

    target_rgb = tuple(data[y, x, :3])
    fill_rgba = np.array(hex_to_rgba(fill_color), dtype=np.uint8)

    if np.allclose(data[y, x, :3], fill_rgba[:3], atol=tolerance) and np.array_equal(data[y, x], fill_rgba):
        return data, {"status": "no_change"}

    # Erzeuge Farbmismatch-Maske (True = Pixel zum Füllen)
    fill_mask = color_mask(data, target_rgb, tolerance)

    # Falls Maske übergeben, kombiniere
    if mask is not None:
        if isinstance(mask, Image.Image):
            mask_array = np.array(mask.convert("L")) > 0
        elif isinstance(mask, np.ndarray):
            mask_array = mask.astype(bool)
        else:
            return None, {"error": "Mask must be PIL.Image or numpy array."}
        fill_mask &= mask_array

    visited = np.zeros((height, width), dtype=bool)
    stack = [(x, y)]
    filled = 0

    while stack:
        cx, cy = stack.pop()

        # Überspringe wenn schon besucht oder nicht im fill_mask
        if visited[cy, cx] or not fill_mask[cy, cx]:
            continue

        # Scanline nach links
        left = cx
        while left >= 0 and not visited[cy, left] and fill_mask[cy, left]:
            left -= 1
        left += 1

        # Scanline nach rechts
        right = cx
        while right < width and not visited[cy, right] and fill_mask[cy, right]:
            right += 1
        right -= 1

        # Fülle Linie und markiere besucht
        data[cy, left:right+1, :3] = fill_rgba[:3]
        data[cy, left:right+1, 3] = 255
        visited[cy, left:right+1] = True
        filled += right - left + 1

        # Nachbarzeilen prüfen
        for nx in range(left, right+1):
            for ny in [cy-1, cy+1]:
                if 0 <= ny < height and not visited[ny, nx] and fill_mask[ny, nx]:
                    stack.append((nx, ny))

    return data.astype(np.uint8), {"status": "filled", "filled_pixels": filled}
