from PIL import Image, ImageDraw
import os
import uuid
import shutil
import numpy as np
import json
import cv2

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

    apply_brightness_contrast,
    apply_color_shift,
    apply_hue_rotation,
    apply_invert_colors,
    apply_color_lookup,

    apply_sharpness,
    apply_blur,
    apply_edge_detection,
    apply_edge_smooth,
    apply_blend_edges
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
    def parse_points(cls, points):
        if isinstance(points, list):
            raw_points = points
        else:
            try:
                raw_points = json.loads(points or "[]")
            except Exception:
                raw_points = []

        parsed = []

        for point in raw_points:
            try:
                x = float(point.get("x", 0.5))
                y = float(point.get("y", 0.5))

                parsed.append({
                    "x": max(0.0, min(1.0, x)),
                    "y": max(0.0, min(1.0, y)),
                })
            except Exception:
                continue

        return parsed


    @classmethod
    def point_distance_to_segment(cls, px, py, ax, ay, bx, by):
        abx = bx - ax
        aby = by - ay

        apx = px - ax
        apy = py - ay

        length_sq = abx * abx + aby * aby

        if length_sq <= 1e-8:
            return np.sqrt((px - ax) ** 2 + (py - ay) ** 2)

        t = (apx * abx + apy * aby) / length_sq
        t = np.clip(t, 0.0, 1.0)

        closest_x = ax + abx * t
        closest_y = ay + aby * t

        return np.sqrt((px - closest_x) ** 2 + (py - closest_y) ** 2)


    @classmethod
    def apply_point_falloff(cls, normalized_distance, mode="radial", strength=1.0):
        d = np.clip(normalized_distance, 0.0, 1.0)
        strength = max(float(strength or 1.0), 0.001)

        if mode == "point":
            return np.clip(1.0 - d, 0.0, 1.0)

        if mode == "linear":
            return np.clip(1.0 - d, 0.0, 1.0)

        if mode == "cubic":
            return np.clip(1.0 - d ** 3, 0.0, 1.0)

        if mode == "quadratic":
            return np.clip(1.0 - d ** 2, 0.0, 1.0)

        if mode == "exponential":
            return np.clip(np.exp(-d * 4.0 * strength), 0.0, 1.0)

        # radial default = smoother ease-out
        return np.clip((1.0 - d) ** 2, 0.0, 1.0)


    @classmethod
    def build_point_influence_map(
        cls,
        image_size,
        points,
        point_radius=35,
        point_falloff="radial",
        point_strength=1.0,
        point_chain=True,
    ):
        width, height = image_size
        points = cls.parse_points(points)

        if not points:
            return np.ones((height, width), dtype=np.float32)

        radius_px = max(1.0, float(point_radius or 35) / 100.0 * max(width, height))
        yy, xx = np.mgrid[0:height, 0:width]

        influence = np.zeros((height, width), dtype=np.float32)

        pixel_points = [
            {
                "x": point["x"] * width,
                "y": point["y"] * height,
            }
            for point in points
        ]

        for point in pixel_points:
            distance = np.sqrt((xx - point["x"]) ** 2 + (yy - point["y"]) ** 2)
            normalized = distance / radius_px
            point_map = cls.apply_point_falloff(
                normalized,
                mode=point_falloff,
                strength=point_strength,
            )
            influence = np.maximum(influence, point_map)

        if point_chain and len(pixel_points) > 1:
            for index in range(len(pixel_points) - 1):
                a = pixel_points[index]
                b = pixel_points[index + 1]

                distance = cls.point_distance_to_segment(
                    xx,
                    yy,
                    a["x"],
                    a["y"],
                    b["x"],
                    b["y"],
                )

                normalized = distance / radius_px

                segment_map = cls.apply_point_falloff(
                    normalized,
                    mode=point_falloff,
                    strength=point_strength,
                )

                influence = np.maximum(influence, segment_map)

        return np.clip(influence, 0.0, 1.0).astype(np.float32)

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
    def apply_color_stack(
        cls,
        image,
        layer=None,

        brightness=100,
        contrast=50,
        color_shift=0,
        hue_variation=0,
        invert_colors=False,
        color_lookup=0,

        mask_type="none",
        select_mask_x=0,
        select_mask_y=0,
        select_mask_width=0,
        select_mask_height=0,
        select_mask_shape="rectangle",
    ):
        image = image.convert("RGBA")
        original = image.copy()
        alpha = image.getchannel("A")

        rgb_image = image.convert("RGB")
        img = np.array(rgb_image)

        img = apply_brightness_contrast(
            img,
            brightness=int(brightness or 100),
            contrast=int(contrast or 50),
        )

        img = apply_color_shift(
            img,
            color_shift=int(color_shift or 0),
        )

        img = apply_hue_rotation(
            img,
            hue_variation=int(hue_variation or 0),
        )

        img = apply_invert_colors(
            img,
            invert_colors=invert_colors,
        )

        img = apply_color_lookup(
            img,
            color_lookup_mode=int(color_lookup or 0),
        )

        if isinstance(img, Image.Image):
            modified = img.convert("RGBA")
        else:
            img = np.array(img)

            if img.ndim == 2:
                modified = Image.fromarray(img.astype(np.uint8)).convert("RGBA")
            elif len(img.shape) == 3 and img.shape[2] == 4:
                modified = Image.fromarray(img.astype(np.uint8)).convert("RGBA")
            else:
                modified = Image.fromarray(img.astype(np.uint8)).convert("RGBA")

        if modified.size == alpha.size:
            modified.putalpha(alpha)

        if str(mask_type) == "none":
            return modified

        if not layer:
            return modified

        mask = cls.resolve_mask(
            layer=layer,
            image_size=image.size,
            mask_type=mask_type,
            select_mask_x=select_mask_x,
            select_mask_y=select_mask_y,
            select_mask_width=select_mask_width,
            select_mask_height=select_mask_height,
            select_mask_shape=select_mask_shape,
        )

        if mask is None:
            return original

        result = Image.composite(
            modified,
            original,
            mask.convert("L")
        )

        return result.convert("RGBA")

    @classmethod
    def color(
        cls,
        id,
        brightness=100,
        contrast=50,
        color_shift=0,
        hue_variation=0,
        invert_colors=False,
        color_lookup=0,

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

            result = cls.apply_color_stack(
                image=image,
                layer=layer,

                brightness=brightness,
                contrast=contrast,
                color_shift=color_shift,
                hue_variation=hue_variation,
                invert_colors=invert_colors,
                color_lookup=color_lookup,

                mask_type=mask_type,
                select_mask_x=select_mask_x,
                select_mask_y=select_mask_y,
                select_mask_width=select_mask_width,
                select_mask_height=select_mask_height,
                select_mask_shape=select_mask_shape,
            )

            new_id = str(uuid.uuid4())
            new_filename = f"{new_id}.png"
            new_save_path = os.path.join(PUBLIC_LAYER_FOLDER, new_filename)

            result.save(new_save_path)

            os.remove(image_path)

            layer["url"] = f"/download/{new_filename}?ts={time('unix_ms')}"
            layer["id"] = new_id
            layer["source"] = id
            layer["width"] = result.size[0]
            layer["height"] = result.size[1]
            layer["thumbnail"] = generate_thumbnail_map(
                new_id,
                path=new_save_path,
                size=64,
                image=None
            )
            layer["time"] = time("unix_ms")

            return {
                "message": "Farbe erfolgreich bearbeitet.",
                "id": new_id,
                "url": layer["url"],
                "width": layer["width"],
                "height": layer["height"],
                "thumbnail": layer["thumbnail"],
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def apply_details_stack(
        cls,
        image,
        details_effect="sharpness",

        sharpness=1.5,

        blur=5,
        blur_mode=1,
        blur_radius=15,
        blur_falloff_mode=1,
        blur_type=1,

        edge_detection=True,
        edge_method="canny",
        edge_threshold1=50,
        edge_threshold2=150,
        edge_kernel_size=3,
        edge_alpha=0.5,

        edge_threshold_min=1,
        edge_threshold_max=250,
        mask_expand=1.5,
        sharpness_boost=1.2,

        blending_intensity=50,

        points="[]",
        point_radius=35,
        point_falloff="radial",
        point_strength=1.0,
        point_chain=True,
    ):
        image = image.convert("RGBA")
        original = image.copy()

        alpha = image.getchannel("A")
        rgb = image.convert("RGB")
        img = np.array(rgb)

        effect = str(details_effect or "sharpness")

        if effect == "sharpness":
            modified = apply_sharpness(
                img,
                sharpness=float(sharpness or 1.5),
            )

        elif effect == "blur":
            width, height = image.size
            parsed_points = cls.parse_points(points)

            if parsed_points:
                first = parsed_points[0]
                blur_center = (
                    int(first["x"] * width),
                    int(first["y"] * height),
                )
            else:
                blur_center = None

            modified = apply_blur(
                img,
                blur=float(blur or 5),
                blur_mode=int(blur_mode or 1),
                blur_radius=int(blur_radius or 15),
                blur_falloff_mode=int(blur_falloff_mode or 1),
                blur_type=int(blur_type or 1),
                blur_center=blur_center,
                blur_falloff_strength=float(point_strength or 1.0),
            )

        elif effect == "edge_detection":
            modified = apply_edge_detection(
                img,
                edge_detection=edge_detection,
                method=str(edge_method or "canny"),
                threshold1=int(edge_threshold1 or 50),
                threshold2=int(edge_threshold2 or 150),
                kernel_size=int(edge_kernel_size or 3),
                alpha=float(edge_alpha or 0.5),
            )

        elif effect == "edge_smooth":
            modified = apply_edge_smooth(
                image,
                edge_threshold=(
                    int(edge_threshold_min or 1),
                    int(edge_threshold_max or 250),
                ),
                mask_expand=float(mask_expand or 1.5),
                sharpness_boost=float(sharpness_boost or 1.2),
            )

        elif effect == "blend_edges":
            width, height = image.size

            modified = apply_blend_edges(
                img,
                width=width,
                height=height,
                blending_intensity=float(blending_intensity or 0),
            )

        else:
            modified = img

        if isinstance(modified, Image.Image):
            modified_image = modified.convert("RGBA")
        else:
            modified = np.array(modified)

            if modified.ndim == 2:
                modified_image = Image.fromarray(modified.astype(np.uint8)).convert("RGBA")
            elif len(modified.shape) == 3 and modified.shape[2] == 4:
                modified_image = Image.fromarray(modified.astype(np.uint8)).convert("RGBA")
            else:
                modified_image = Image.fromarray(modified.astype(np.uint8)).convert("RGBA")

        if modified_image.size == alpha.size:
            modified_image.putalpha(alpha)

        influence = cls.build_point_influence_map(
            image_size=image.size,
            points=points,
            point_radius=point_radius,
            point_falloff=point_falloff,
            point_strength=point_strength,
            point_chain=point_chain,
        )

        blend = max(0.0, min(float(point_strength or 1.0), 1.0))
        influence = np.clip(influence * blend, 0.0, 1.0)

        original_np = np.array(original).astype(np.float32)
        modified_np = np.array(modified_image).astype(np.float32)

        influence_np = influence[..., np.newaxis]

        result_np = original_np * (1.0 - influence_np) + modified_np * influence_np
        result_np = np.clip(result_np, 0, 255).astype(np.uint8)

        return Image.fromarray(result_np).convert("RGBA")

    @classmethod
    def details(
        cls,
        id,

        details_effect="sharpness",

        sharpness=1.5,

        blur=5,
        blur_mode=1,
        blur_radius=15,
        blur_falloff_mode=1,
        blur_type=1,

        edge_detection=True,
        edge_method="canny",
        edge_threshold1=50,
        edge_threshold2=150,
        edge_kernel_size=3,
        edge_alpha=0.5,

        edge_threshold_min=1,
        edge_threshold_max=250,
        mask_expand=1.5,
        sharpness_boost=1.2,

        blending_intensity=50,

        points="[]",
        point_radius=35,
        point_falloff="radial",
        point_strength=1.0,
        point_chain=True,
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

            result = cls.apply_details_stack(
                image=image,
                details_effect=details_effect,

                sharpness=sharpness,

                blur=blur,
                blur_mode=blur_mode,
                blur_radius=blur_radius,
                blur_falloff_mode=blur_falloff_mode,
                blur_type=blur_type,

                edge_detection=edge_detection,
                edge_method=edge_method,
                edge_threshold1=edge_threshold1,
                edge_threshold2=edge_threshold2,
                edge_kernel_size=edge_kernel_size,
                edge_alpha=edge_alpha,

                edge_threshold_min=edge_threshold_min,
                edge_threshold_max=edge_threshold_max,
                mask_expand=mask_expand,
                sharpness_boost=sharpness_boost,

                blending_intensity=blending_intensity,

                points=points,
                point_radius=point_radius,
                point_falloff=point_falloff,
                point_strength=point_strength,
                point_chain=point_chain,
            )

            new_id = str(uuid.uuid4())
            new_filename = f"{new_id}.png"
            new_save_path = os.path.join(PUBLIC_LAYER_FOLDER, new_filename)

            result.save(new_save_path)

            os.remove(image_path)

            layer["url"] = f"/download/{new_filename}?ts={time('unix_ms')}"
            layer["id"] = new_id
            layer["source"] = id
            layer["width"] = result.size[0]
            layer["height"] = result.size[1]
            layer["thumbnail"] = generate_thumbnail_map(
                new_id,
                path=new_save_path,
                size=64,
                image=None,
            )
            layer["time"] = time("unix_ms")

            return {
                "message": "Details erfolgreich bearbeitet.",
                "id": new_id,
                "url": layer["url"],
                "width": layer["width"],
                "height": layer["height"],
                "thumbnail": layer["thumbnail"],
            }, 200

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