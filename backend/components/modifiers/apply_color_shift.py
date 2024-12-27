from PIL import Image
import numpy as np
import cv2

def apply_color_shift(img, color_shift):
    """
    Applies a hue shift to the image in the HSV model, controlled by a grayscale alpha mask.

    :param img: Input image (PIL.Image or NumPy array).
    :param color_shift: The degree of hue shift (-100 to 100).
    :return: The image with the adjusted hue as a NumPy array.
    """
    # Ensure the input image is a NumPy array
    if isinstance(img, Image.Image):
        img = np.array(img)

    if not isinstance(img, np.ndarray):
        raise TypeError("Input image must be a PIL.Image or a NumPy array.")

    # Ensure color_shift is within the valid range
    color_shift = np.clip(color_shift, -100, 100)

    # Convert the image from RGB to HSV
    hsv_img = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)

    # Calculate the hue shift in degrees
    hue_shift = (abs(color_shift) / 100) * 180  # Scale to HSV hue range (0 to 180)

    # Create a grayscale alpha mask based on the image brightness
    brightness_mask = np.mean(img, axis=2) / 255.0  # Normalize to 0-1 range

    # Optional: Apply a Gaussian Blur to the alpha mask for smoother transitions
    alpha_mask = cv2.GaussianBlur(brightness_mask, (15, 15), 0)

    # Apply the hue shift with modulation by the alpha mask
    if color_shift < 0:
        hsv_img[:, :, 0] = (hsv_img[:, :, 0] - hue_shift * alpha_mask) % 180
    else:
        hsv_img[:, :, 0] = (hsv_img[:, :, 0] + hue_shift * alpha_mask) % 180

    # Convert the image back to RGB
    result_img = cv2.cvtColor(hsv_img, cv2.COLOR_HSV2RGB)

    return result_img
