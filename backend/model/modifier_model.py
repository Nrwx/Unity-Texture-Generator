from PIL import Image, ImageDraw
import os
import uuid
import shutil
import numpy as np

from generated.paths import (
    PUBLIC_LAYER_FOLDER,
    PUBLIC_BACKUP_FOLDER
)

from config.data.constant import (
    LAYERS,
    VIEWPORT_CONFIG
)

from model.base.main import BaseModel

from components import (
    apply_color_fill,
    generate_thumbnail_map,
    apply_crop_image,
    apply_cut_out,
    apply_resize,
    apply_mask,
)

from utils import (
    apply_rgb_rgba,
    apply_alpha,
    time
)


class ModifierModel(BaseModel):

    @classmethod
    def get_viewport_box(cls):
        viewport = VIEWPORT_CONFIG[0] if VIEWPORT_CONFIG else {}

        return {
            "x": 0,
            "y": 0,
            "width": int(viewport.get("width", 0) or 0),
            "height": int(viewport.get("height", 0) or 0),
        }

    @classmethod
    def get_layer_viewport_box(cls, layer, image):
        width, height = image.size

        x = int(
            layer.get(
                "x",
                layer.get(
                    "left",
                    layer.get("position", {}).get("x", 0)
                )
            ) or 0
        )

        y = int(
            layer.get(
                "y",
                layer.get(
                    "top",
                    layer.get("position", {}).get("y", 0)
                )
            ) or 0
        )

        return {
            "x": x,
            "y": y,
            "width": width,
            "height": height,
        }

    @classmethod
    def intersect_boxes(cls, a, b):
        left = max(int(a["x"]), int(b["x"]))
        top = max(int(a["y"]), int(b["y"]))
        right = min(int(a["x"] + a["width"]), int(b["x"] + b["width"]))
        bottom = min(int(a["y"] + a["height"]), int(b["y"] + b["height"]))

        if right <= left or bottom <= top:
            return None

        return {
            "x": left,
            "y": top,
            "width": right - left,
            "height": bottom - top,
        }

    @classmethod
    def resolve_viewport_select_box_for_image(
        cls,
        layer,
        image,
        crop_left,
        crop_top,
        select_mask_x,
        select_mask_y,
        select_mask_width,
        select_mask_height,
    ):
        select_box = {
            "x": int(select_mask_x or 0),
            "y": int(select_mask_y or 0),
            "width": int(select_mask_width or 0),
            "height": int(select_mask_height or 0),
        }

        if select_box["width"] <= 0 or select_box["height"] <= 0:
            return None

        viewport_box = cls.get_viewport_box()

        if viewport_box["width"] <= 0 or viewport_box["height"] <= 0:
            return None

        visible_select_box = cls.intersect_boxes(select_box, viewport_box)

        if not visible_select_box:
            return None

        layer_box = cls.get_layer_viewport_box(layer, image)
        overlap = cls.intersect_boxes(visible_select_box, layer_box)

        if not overlap:
            return None

        return {
            "x": overlap["x"] - layer_box["x"] - int(crop_left or 0),
            "y": overlap["y"] - layer_box["y"] - int(crop_top or 0),
            "width": overlap["width"],
            "height": overlap["height"],
        }

    @classmethod
    def fill(cls, id, x, y, color, tolerance=0):
        try:
            layer = next((l for l in LAYERS if l["id"] == id), None)
            if not layer:
                return {"error": f"Layer with id '{id}' not found."}, 404

            image_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{id}.png")
            if not os.path.exists(image_path):
                return {"error": "Image file not found."}, 404

            try:
                if not os.path.exists(PUBLIC_BACKUP_FOLDER):
                    os.makedirs(PUBLIC_BACKUP_FOLDER)

                backup_path = os.path.join(PUBLIC_BACKUP_FOLDER, f"{id}.png")
                shutil.copy2(image_path, backup_path)

                image = Image.open(image_path).convert("RGBA")
                original_array = np.array(image)
                click_x, click_y = int(x), int(y)

                mask = None
                if layer.get("mask"):
                    mask_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{layer['mask']}.png")
                    if os.path.exists(mask_path):
                        mask = Image.open(mask_path)

                result_array, info = apply_color_fill(
                    original_array,
                    click_x,
                    click_y,
                    color,
                    mask,
                    tolerance
                )

                changed_pixels = np.any(
                    result_array[:, :, :3] != original_array[:, :, :3],
                    axis=-1
                )
                result_array[changed_pixels, 3] = 255

                result_image = Image.fromarray(result_array.astype(np.uint8))

                new_id = str(uuid.uuid4())
                new_filename = f"{new_id}.png"
                new_save_path = os.path.join(PUBLIC_LAYER_FOLDER, new_filename)
                result_image.save(new_save_path)

                os.remove(image_path)

                layer["url"] = f"/download/{new_filename}"
                layer["id"] = new_id
                layer["source"] = id
                layer["thumbnail"] = generate_thumbnail_map(
                    new_id,
                    path=new_save_path,
                    size=64,
                    image=None
                )
                layer["time"] = time("unix_ms")

                return {
                    "message": "Farbfüllung erfolgreich angewendet.",
                    "url": layer["url"]
                }, 200

            except Exception as e:
                return cls.handle_error(e)

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def resize(
        cls,
        id,

        crop_left=0,
        crop_top=0,
        crop_right=0,
        crop_bottom=0,

        resize_index=0,
        resize_width=0,
        resize_height=0,
        resize_keep_aspect_ratio=1,
        resize_is_custom=0,
        resize_mode=0,
        upscale_method=1,

        cutout=0,
        mask_type="none",

        select_mask_x=0,
        select_mask_y=0,
        select_mask_width=0,
        select_mask_height=0,
        select_mask_shape="rectangle",
    ):
        try:
            layer = next((l for l in LAYERS if l["id"] == id), None)

            if not layer:
                return {"error": f"Layer with id '{id}' not found."}, 404

            image_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{id}.png")

            if not os.path.exists(image_path):
                return {"error": "Image file not found."}, 404

            if not os.path.exists(PUBLIC_BACKUP_FOLDER):
                os.makedirs(PUBLIC_BACKUP_FOLDER)

            backup_path = os.path.join(PUBLIC_BACKUP_FOLDER, f"{id}.png")
            shutil.copy2(image_path, backup_path)

            image = Image.open(image_path).convert("RGBA")

            resolved_select_box = None

            if str(mask_type) == "select":
                resolved_select_box = cls.resolve_viewport_select_box_for_image(
                    layer=layer,
                    image=image,
                    crop_left=crop_left,
                    crop_top=crop_top,
                    select_mask_x=select_mask_x,
                    select_mask_y=select_mask_y,
                    select_mask_width=select_mask_width,
                    select_mask_height=select_mask_height,
                )

            image = apply_crop_image(
                image,
                crop_left,
                crop_top,
                crop_right,
                crop_bottom
            )

            use_cutout = int(cutout) == 1

            if use_cutout:
                if mask_type == "select":
                    if not resolved_select_box:
                        mask = None
                    else:
                        mask = cls.resolve_mask(
                            layer=layer,
                            image_size=image.size,
                            mask_type=mask_type,
                            select_mask_x=resolved_select_box["x"],
                            select_mask_y=resolved_select_box["y"],
                            select_mask_width=resolved_select_box["width"],
                            select_mask_height=resolved_select_box["height"],
                            select_mask_shape=select_mask_shape,
                        )
                else:
                    mask = cls.resolve_mask(
                        layer=layer,
                        image_size=image.size,
                        mask_type=mask_type,
                        select_mask_x=0,
                        select_mask_y=0,
                        select_mask_width=0,
                        select_mask_height=0,
                        select_mask_shape=select_mask_shape,
                    )

                if mask is not None:
                    if mask_type == "select":
                        image = apply_cut_out(image, mask, invert=True)
                    elif mask_type == "layer":
                        image = apply_mask(image, mask)

            image = apply_resize(
                image=image,
                resize_index=resize_index,
                resize_width=resize_width,
                resize_height=resize_height,
                resize_keep_aspect_ratio=resize_keep_aspect_ratio,
                resize_is_custom=resize_is_custom,
                resize_mode=resize_mode,
                upscale_method=upscale_method
            )

            new_id = str(uuid.uuid4())
            new_filename = f"{new_id}.png"
            new_save_path = os.path.join(PUBLIC_LAYER_FOLDER, new_filename)

            image.save(new_save_path)

            os.remove(image_path)

            layer["url"] = f"/download/{new_filename}?ts={time('unix_ms')}"
            layer["id"] = new_id
            layer["source"] = id
            layer["width"] = image.size[0]
            layer["height"] = image.size[1]
            layer["thumbnail"] = generate_thumbnail_map(
                new_id,
                path=new_save_path,
                size=64,
                image=None
            )
            layer["time"] = time("unix_ms")

            return {
                "message": "Bild erfolgreich bearbeitet.",
                "id": new_id,
                "url": layer["url"],
                "width": layer["width"],
                "height": layer["height"],
                "thumbnail": layer["thumbnail"],
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def resolve_mask(
        cls,
        layer,
        image_size,
        mask_type,
        select_mask_x=0,
        select_mask_y=0,
        select_mask_width=0,
        select_mask_height=0,
        select_mask_shape="rectangle",
    ):
        width, height = image_size

        if mask_type == "layer":
            layer_mask_id = layer.get("mask", "")

            if not layer_mask_id:
                return None

            mask_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{layer_mask_id}.png")

            if not os.path.exists(mask_path):
                return None

            return Image.open(mask_path).convert("L").resize((width, height))

        if mask_type == "select":
            x = int(select_mask_x)
            y = int(select_mask_y)
            w = int(select_mask_width)
            h = int(select_mask_height)

            if w <= 0 or h <= 0:
                return None

            left = max(0, x)
            top = max(0, y)
            right = min(width, x + w)
            bottom = min(height, y + h)

            if right <= left or bottom <= top:
                return None

            mask = Image.new("L", (width, height), 0)
            draw = ImageDraw.Draw(mask)

            box = (
                left,
                top,
                right,
                bottom
            )

            if select_mask_shape in ["circle", "ellipse"]:
                draw.ellipse(box, fill=255)
            else:
                draw.rectangle(box, fill=255)

            return mask

        return None