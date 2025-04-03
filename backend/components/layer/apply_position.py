# apply_position.py
def apply_position(base_image, layer_image, x, y):
    base_image.paste(layer_image, (x, y), layer_image if layer_image.mode == 'RGBA' else None)
    return base_image