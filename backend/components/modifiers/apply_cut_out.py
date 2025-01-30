import numpy as np
from PIL import Image

def apply_cut_out(mode, image: Image.Image):

    if mode == 1:
        # Convert image to numpy array if needed
        if isinstance(image, Image.Image):
            image = np.array(image)
        else:
            image = image.copy()

        # Ensure both image and mask are in the same size
        image = image.convert("RGBA")
        mask = mask.resize(image.size).convert("L")

        # Create an alpha mask from the grayscale mask
        alpha_data = np.array(mask, dtype=np.uint8)

        # Scale grayscale values to transparency levels (0 = transparent, 255 = opaque)
        alpha_data = 255 - alpha_data  # Invert the mask to match the black exclusion rule

        # Add alpha channel to the original image
        image_data = np.array(image)
        image_data[:, :, 3] = alpha_data

        # Return image data as numpy array
        return image_data