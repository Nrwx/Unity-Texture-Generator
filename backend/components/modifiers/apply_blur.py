import cv2
import numpy as np
from PIL import Image

def falloff(distance, mode=1, strength=1.0):
    if mode == 1:  # Linear
        return max(0, 1 - distance)
    elif mode == 2:  # Exponential
        return max(0, np.exp(-distance * strength))
    elif mode == 3:  # Logarithmic
        return max(0, -np.log(1 - distance + 1e-6) / strength)
    elif mode == 4:  # Quadratic
        return max(0, 1 - distance ** 2)
    elif mode == 5:  # Cubic
        return max(0, 1 - distance ** 3)
    else:
        raise ValueError(f"Unbekannter Falloff-Modus: {mode}")

def apply_blur(
    image,
    blur=5,
    blur_mode=1,
    blur_radius=15,
    blur_falloff_mode=1,
    blur_type=1,  # 1 = Inner, 2 = Outer
    blur_center=None,
    blur_falloff_strength=1.0,
    blur_harmonic_strength=1.0,
    blur_fisheye_strength=1.0,
    blur_channel_weights=[1.0, 1.0, 1.0],
    blur_direction=None,
    blur_mask=None,
    blur_iterations=1,
    blur_edge_sensitivity=0.5,
    blur_randomness=0.0,
    blur_transition_width=10,
    blur_motion_angle=0,
    blur_boost=1.0,
    blur_lightness_limit=1.0,
):
    # Convert image to numpy array if needed
    if isinstance(image, Image.Image):
        img_array = np.array(image)
    else:
        img_array = image.copy()

    height, width, channels = img_array.shape

    # Set default blur center if not provided
    if blur_center is None:
        blur_center = (width // 2, height // 2)

    # Apply channel weighting
    for c in range(channels):
        img_array[..., c] = (img_array[..., c] * blur_channel_weights[c]).astype(np.uint8)

    fade_mask = np.zeros((height, width), dtype=np.float32)

    if blur_mode == 1:  # Gaussian Blur
        kernel_size = (int(blur * 3), int(blur * 3))
        kernel_size = (kernel_size[0] | 1, kernel_size[1] | 1)  # Ensure kernel size is odd
        img_array = cv2.GaussianBlur(img_array, kernel_size, blur)

    elif blur_mode in [2, 3, 6, 7]:  # Radial, Quadratic Blur, Radial Rays, Quadratic Rays
        for y in range(height):
            for x in range(width):
                dx = x - blur_center[0]
                dy = y - blur_center[1]
                distance = np.sqrt(dx**2 + dy**2) / blur_radius

                if blur_mode == 2:  # Radial Blur
                    fade_mask[y, x] = falloff(distance, mode=blur_falloff_mode, strength=blur_falloff_strength)

                elif blur_mode == 3:  # Quadratic Blur
                    fade_mask[y, x] = falloff(distance**2, mode=4, strength=blur_falloff_strength)

                elif blur_mode == 6:  # Radial Rays
                    angle = np.arctan2(dy, dx)
                    fade_mask[y, x] = falloff(np.abs(np.sin(angle)), mode=blur_falloff_mode, strength=blur_falloff_strength)

                elif blur_mode == 7:  # Quadratic Rays
                    angle = np.arctan2(dy, dx)
                    fade_mask[y, x] = falloff(np.abs(np.sin(angle))**2, mode=4, strength=blur_falloff_strength)

        fade_mask = np.clip(fade_mask, 0, 1)
        fade_mask_blurred = cv2.GaussianBlur(fade_mask, (21, 21), sigmaX=10)
        fade_mask_blurred = np.clip(fade_mask_blurred, 0, 1)  # Sicherheitsmaßnahme

    elif blur_mode == 4:  # Motion Blur
        if blur_direction is None:
            blur_direction = [1, 0]  # Horizontal by default

        # Stelle sicher, dass kernel_size eine Ganzzahl ist
        kernel_size = int(blur_radius)  # Umwandeln in int, um den Fehler zu vermeiden

        # Überprüfen, ob kernel_size eine gültige Zahl ist (größer als 1)
        if kernel_size < 1:
            kernel_size = 1  # Minimale Größe für den Kernel

        kernel = np.zeros((kernel_size, kernel_size), dtype=np.float32)
        kernel[int((kernel_size - 1) / 2), :] = np.ones(kernel_size, dtype=np.float32)
        kernel /= kernel_size

        # Anwenden des Filters
        img_array = cv2.filter2D(img_array, -1, kernel)

    elif blur_mode == 5:  # Fisheye Blur
        for y in range(height):
            for x in range(width):
                dx = x - blur_center[0]
                dy = y - blur_center[1]
                distance = np.sqrt(dx**2 + dy**2) / blur_radius
                factor = 1 + blur_fisheye_strength * (distance**2)
                new_x = int(blur_center[0] + dx * factor)
                new_y = int(blur_center[1] + dy * factor)
                if 0 <= new_x < width and 0 <= new_y < height:
                    img_array[y, x] = img_array[new_y, new_x]

    # Gaussian Blur für das gesamte Bild erzeugen
    blurred_image = cv2.GaussianBlur(img_array, (21, 21), sigmaX=10)

    # Normalisierung der Fade-Maske
    fade_mask = np.clip(fade_mask, 0, 1)

    # Anwenden eines Gaussian Blurs auf die Maske
    fade_mask_blurred = cv2.GaussianBlur(fade_mask, (21, 21), sigmaX=10)
    fade_mask_blurred = np.clip(fade_mask_blurred, 0, 1)  # Sicherheitsmaßnahme

    # Erzeuge das Ergebnis durch Mischung des Originalbildes und des verschwommenen Bildes
    if blur_type == 1:  # Inner Blur
        fade_mask_blurred = np.clip(fade_mask_blurred, 0, 1)  # Maske invertieren
        img_array = (img_array * (1 - fade_mask_blurred[..., None]) + blurred_image * fade_mask_blurred[..., None]).astype(np.uint8)
    elif blur_type == 2:  # Outer Blur
        fade_mask_blurred = 1 - np.clip(fade_mask_blurred, 0, 1)  # Maske invertieren
        img_array = (img_array * (1 - fade_mask_blurred[..., None]) + blurred_image * fade_mask_blurred[..., None]).astype(np.uint8)

    # Apply iterations if specified
    for _ in range(blur_iterations - 1):
        img_array = apply_blur(
            img_array,
            blur=blur,
            blur_radius=blur_radius,
            blur_mode=blur_mode,
            blur_type=blur_type,
        )

    return img_array
