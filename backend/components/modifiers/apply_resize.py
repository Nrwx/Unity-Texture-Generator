import numpy as np
from PIL import Image, ImageOps
import cv2


RESIZE_OPTIONS = [
    None,
    (32, 32),
    (64, 64),
    (128, 128),
    (256, 256),
    (512, 512),
    (1024, 1024),
    (2048, 2048),
    (4096, 4096),
    (8192, 8192),
]


def resolve_resize_target(
    image: Image.Image,
    resize_index: int = 0,
    resize_width: int = 0,
    resize_height: int = 0,
    resize_keep_aspect_ratio: int = 1,
    resize_is_custom: int = 0,
):
    image_width, image_height = image.size

    resize_index = int(resize_index or 0)
    resize_width = int(resize_width or 0)
    resize_height = int(resize_height or 0)
    resize_keep_aspect_ratio = int(resize_keep_aspect_ratio or 0)
    resize_is_custom = int(resize_is_custom or 0)

    if resize_is_custom == 1 or resize_width > 0 or resize_height > 0:
        target_width = resize_width
        target_height = resize_height

        if resize_keep_aspect_ratio == 1:
            ratio = image_width / image_height if image_height else 1

            if target_width > 0 and target_height <= 0:
                target_height = round(target_width / ratio)

            elif target_height > 0 and target_width <= 0:
                target_width = round(target_height * ratio)

            elif target_width > 0 and target_height > 0:
                # Width wins. This matches the frontend behavior:
                # when width is edited, height follows the ratio.
                target_height = round(target_width / ratio)

        if target_width <= 0:
            target_width = image_width

        if target_height <= 0:
            target_height = image_height

        target_width = max(1, int(target_width))
        target_height = max(1, int(target_height))

        if target_width == image_width and target_height == image_height:
            return None

        return target_width, target_height

    if resize_index == 0:
        return None

    if resize_index < 0 or resize_index >= len(RESIZE_OPTIONS):
        return None

    return RESIZE_OPTIONS[resize_index]


def get_resize_resample(upscale_method: int):
    upscale_method = int(upscale_method or 1)

    if upscale_method == 0:
        return Image.Resampling.NEAREST

    if upscale_method == 1:
        return Image.Resampling.BICUBIC

    return Image.Resampling.BICUBIC


def apply_resize(
    image: Image.Image,
    resize_index: int,
    resize_mode: int,
    upscale_method: int,
    resize_width: int = 0,
    resize_height: int = 0,
    resize_keep_aspect_ratio: int = 1,
    resize_is_custom: int = 0,
) -> Image.Image:
    """
    :param image: PIL.Image
    :param resize_index: Preset index
    :param resize_mode: 0 = Auto-Crop, 1 = Padding
    :param upscale_method: 0 = Nearest, 1 = Bicubic, 2 = AI/WIP
    :param resize_width: Custom target width
    :param resize_height: Custom target height
    :param resize_keep_aspect_ratio: 1 = ratio locked, 0 = free width/height
    :param resize_is_custom: 1 = use width/height over preset
    :return: resized PIL.Image
    """

    if isinstance(image, np.ndarray):
        image = Image.fromarray(image)

    image = image.convert("RGBA")

    resize_mode = int(resize_mode or 0)
    upscale_method = int(upscale_method or 1)

    target_size = resolve_resize_target(
        image=image,
        resize_index=resize_index,
        resize_width=resize_width,
        resize_height=resize_height,
        resize_keep_aspect_ratio=resize_keep_aspect_ratio,
        resize_is_custom=resize_is_custom,
    )

    if not target_size:
        return image

    if upscale_method == 2:
        return ai_upscale_with_mode(
            image=image,
            target_size=target_size,
            resize_mode=resize_mode,
        )

    resample = get_resize_resample(upscale_method)

    if resize_mode == 0:
        return ImageOps.fit(
            image,
            target_size,
            method=resample
        )

    return ImageOps.pad(
        image,
        target_size,
        method=resample,
        color=(0, 0, 0, 0)
    )


def ai_upscale_with_mode(image: Image.Image, target_size, resize_mode: int):
    """
    WIP AI placeholder.
    Respektiert trotzdem Auto-Crop/Padding, nutzt intern OpenCV Cubic.
    """

    image = image.convert("RGBA")

    if resize_mode == 0:
        image = ImageOps.fit(
            image,
            target_size,
            method=Image.Resampling.BICUBIC
        )
    else:
        image = ImageOps.pad(
            image,
            target_size,
            method=Image.Resampling.BICUBIC,
            color=(0, 0, 0, 0)
        )

    img = np.array(image)
    img = cv2.resize(img, target_size, interpolation=cv2.INTER_CUBIC)

    return Image.fromarray(img.astype(np.uint8), "RGBA")