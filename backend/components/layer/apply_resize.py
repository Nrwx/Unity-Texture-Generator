# apply_resize.py
def apply_resize(image, width, height):
    if width and height:
        image = image.resize((width, height))
    return image