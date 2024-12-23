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
    blur_radius=15,
    blur_type=1,
    blur_mode=1,
    blur_center=None,
    blur_falloff_mode=1,
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

    # Gaussian Blur
    if blur_mode == 1:
        kernel_size = (int(blur * 3), int(blur * 3))
        kernel_size = (kernel_size[0] | 1, kernel_size[1] | 1)  # Ensure kernel size is odd
        img_array = cv2.GaussianBlur(img_array, kernel_size, blur)

    # Radial Blur
    elif blur_mode == 2:
        fade_mask = np.zeros((height, width), dtype=np.float32)
        for y in range(height):
            for x in range(width):
                distance = np.sqrt((x - blur_center[0]) ** 2 + (y - blur_center[1]) ** 2) / blur_radius
                fade_mask[y, x] = falloff(distance, mode=blur_falloff_mode, strength=blur_falloff_strength)
        img_array = (img_array * fade_mask[..., None]).astype(np.uint8)

    # Quadratic Blur
    elif blur_mode == 3:
        fade_mask = np.zeros((height, width), dtype=np.float32)
        for y in range(height):
            for x in range(width):
                distance = ((x - blur_center[0]) ** 2 + (y - blur_center[1]) ** 2) / blur_radius
                fade_mask[y, x] = falloff(distance, mode=4, strength=blur_falloff_strength)  # Quadratic
        img_array = (img_array * fade_mask[..., None]).astype(np.uint8)

    # Motion Blur
    elif blur_mode == 4:
        if blur_direction is None:
            blur_direction = [1, 0]  # Horizontal by default
        kernel_size = blur_radius
        kernel = np.zeros((kernel_size, kernel_size), dtype=np.float32)
        kernel[int((kernel_size - 1) / 2), :] = np.ones(kernel_size, dtype=np.float32)
        kernel /= kernel_size
        img_array = cv2.filter2D(img_array, -1, kernel)

    # Fisheye Blur
    elif blur_mode == 5:
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

    # Radial Rays
    elif blur_mode == 8:
        fade_mask = np.zeros((height, width), dtype=np.float32)
        for y in range(height):
            for x in range(width):
                dx = x - blur_center[0]
                dy = y - blur_center[1]
                angle = np.arctan2(dy, dx)
                distance = np.sqrt(dx**2 + dy**2) / blur_radius
                fade_mask[y, x] = falloff(np.abs(np.sin(angle)), mode=blur_falloff_mode, strength=blur_falloff_strength)
        img_array = (img_array * fade_mask[..., None]).astype(np.uint8)

    # Quadratic Rays
    elif blur_mode == 9:
        fade_mask = np.zeros((height, width), dtype=np.float32)
        for y in range(height):
            for x in range(width):
                dx = x - blur_center[0]
                dy = y - blur_center[1]
                angle = np.arctan2(dy, dx)
                distance = np.sqrt(dx**2 + dy**2) / blur_radius
                fade_mask[y, x] = falloff(np.abs(np.sin(angle)) ** 2, mode=4, strength=blur_falloff_strength)  # Quadratic
        img_array = (img_array * fade_mask[..., None]).astype(np.uint8)

    # Apply iterations if specified
    for _ in range(blur_iterations - 1):
        img_array = apply_blur(
            img_array,
            blur=blur,
            blur_radius=blur_radius,
            blur_type=blur_type,
            blur_mode=blur_mode,
        )

    return img_array
