from PIL import Image, ImageFilter
import numpy as np

def apply_glass(image, effect_type=1, frost_strength=5, frost_mode=1, blur_radius=5, crack_intensity=10, reflection_strength=0.5):
    """
    Wendet verschiedene Glas-Effekte auf das Bild an.

    :param image: Das Eingabebild (PIL.Image oder numpy Array).
    :param effect_type: Der Typ des Glas-Effekts.
        1 = Frosted Glass, 2 = Blurred Glass, 3 = Cracked Glass, 4 = Reflected Glass.
    :param frost_strength: Die Stärke des Frosted-Glas-Effekts.
    :param frost_mode: Der Modus des Frost-Effekts.
        1 = Basic Frost, 2 = Directional Frost, 3 = Radial Frost.
    :param blur_radius: Der Radius der Unschärfe für Blurred Glass.
    :param crack_intensity: Die Stärke der Rissbildung für Cracked Glass.
    :param reflection_strength: Der Anteil des Bildes, der reflektiert wird (zwischen 0 und 1) für Reflected Glass.
    :return: Das bearbeitete Bild (PIL.Image oder numpy Array).
    """

    if isinstance(image, Image.Image):
        img_array = np.array(image)
    else:
        img_array = image

    height, width, channels = img_array.shape

    # Frosted Glass Effekt
    if effect_type == 1:
        if frost_mode == 1:
            # Basic Frost Mode
            for y in range(height):
                for x in range(width):
                    shift_x = int(np.random.uniform(-frost_strength, frost_strength))
                    shift_y = int(np.random.uniform(-frost_strength, frost_strength))
                    new_x = np.clip(x + shift_x, 0, width - 1)
                    new_y = np.clip(y + shift_y, 0, height - 1)
                    img_array[y, x] = img_array[new_y, new_x]

        elif frost_mode == 2:
            # Directional Frost Mode
            for y in range(height):
                for x in range(width):
                    shift_x = int(np.random.uniform(-frost_strength, frost_strength))
                    shift_y = int(np.random.uniform(-frost_strength / 2, frost_strength / 2))
                    new_x = np.clip(x + shift_x, 0, width - 1)
                    new_y = np.clip(y + shift_y, 0, height - 1)
                    img_array[y, x] = img_array[new_y, new_x]

        elif frost_mode == 3:
            # Radial Frost Mode
            center_x, center_y = width // 2, height // 2
            max_distance = np.sqrt(center_x**2 + center_y**2)

            for y in range(height):
                for x in range(width):
                    dist_x = x - center_x
                    dist_y = y - center_y
                    distance = np.sqrt(dist_x**2 + dist_y**2)
                    ratio = distance / max_distance
                    shift_strength = frost_strength * (1 - ratio)

                    shift_x = int(np.random.uniform(-shift_strength, shift_strength))
                    shift_y = int(np.random.uniform(-shift_strength, shift_strength))
                    new_x = np.clip(x + shift_x, 0, width - 1)
                    new_y = np.clip(y + shift_y, 0, height - 1)
                    img_array[y, x] = img_array[new_y, new_x]

    # Blurred Glass Effekt
    elif effect_type == 2:
        img = Image.fromarray(img_array)
        blurred_image = img.filter(ImageFilter.GaussianBlur(blur_radius))
        return np.array(blurred_image)

    # Cracked Glass Effekt
    elif effect_type == 3:
        for _ in range(crack_intensity):
            crack_x = np.random.randint(0, width)
            crack_y = np.random.randint(0, height)
            shift_x = np.random.randint(-width // 10, width // 10)
            shift_y = np.random.randint(-height // 10, height // 10)
            img_array[crack_y:, crack_x:] = np.roll(img_array[crack_y:, crack_x:], shift_x, axis=1)
            img_array[:crack_y, crack_x:] = np.roll(img_array[:crack_y, crack_x:], shift_y, axis=0)

    # Reflected Glass Effekt
    elif effect_type == 4:
        reflection_height = int(height * reflection_strength)
        reflection = np.flipud(img_array[-reflection_height:])
        new_image = np.vstack((img_array, reflection))
        return new_image

    if isinstance(image, Image.Image):
        return Image.fromarray(img_array)
    else:
        return img_array
