
# apply_rotation.py
def apply_rotation(image, rotate):
    if rotate:
        image = image.rotate(rotate, expand=True)
    return image