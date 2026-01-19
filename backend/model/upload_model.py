import os
import uuid
from PIL import Image
from model.base.main import BaseModel
from model.layer_model import LayerModel
from components import (
    generate_diffuse_map, generate_normal_map, generate_specular_map,
    generate_bump_map, generate_light_map, generate_alpha_map, apply_crop_image, apply_resize, apply_rgb_mode, apply_rgba_mode
)
from generated.paths import PUBLIC_LAYER_FOLDER, PUBLIC_TEMP_UPLOAD_FOLDER
from utils import apply_rgb_rgba


class UploadModel(BaseModel):
    """
    Upload-spezifische Logik — erbt von BaseModel.
    """

    @staticmethod
    def _safe_float_or_zero(value):
        try:
            return float(value)
        except Exception:
            return 0.0

    @classmethod
    def _apply_upload_adjustments(cls, img, resize_index=0, resize_mode=0, upscale_method=0, rgb_mode=0, rgba_mode=0):
        """
        Optionale Bildanpassungen wie Resize oder RGB/RGBA-Modi.
        """
        try:
            if resize_index != 0:
                img = apply_resize(img, resize_index, resize_mode, upscale_method)
            if rgb_mode != 0 :
                img = apply_rgb_mode(img, rgb_mode)
            if rgba_mode != 0:
                img = apply_rgba_mode(img, rgba_mode)
        except Exception:
            pass  # Fehler ignorieren und Originalbild zurückgeben
        return img

    @classmethod
    def upload(cls, files, **params):
        """
        Upload-Verarbeitung:
        - Lesen von Datei oder editFile
        - Optional Crop, Resize, RGB/RGBA
        - Generierung zusätzlicher Maps
        """
        try:
            output_format = params.get("output_format", "PNG")
            quality = int(params.get("quality", 90))
            selected_maps = params.get("selectedMaps", []) or []
            edit_file = params.get("editFile", "").strip()

            image = None
            alpha = None

            # Datei laden
            if "file" in files:
                image = Image.open(files["file"].stream)
            elif edit_file:
                path = os.path.join(PUBLIC_LAYER_FOLDER, os.path.basename(edit_file))
                if not os.path.exists(path):
                    raise FileNotFoundError(f"File not found: {path}")
                image = Image.open(path)
                image, alpha = apply_rgb_rgba(image)

            if image is None:
                raise ValueError("Keine gültige Datei in 'file' oder 'editFile' bereitgestellt.")

            # Crop-Werte
            left = cls._safe_float_or_zero(params.get("cropLeft", 0))
            top = cls._safe_float_or_zero(params.get("cropTop", 0))
            right = cls._safe_float_or_zero(params.get("cropRight", 0))
            bottom = cls._safe_float_or_zero(params.get("cropBottom", 0))
            cropped_image = apply_crop_image(image, left, top, right, bottom)

            # Resize & RGB/RGBA
            method_params = {k: params.get(k, 0) for k in ("resize_index", "resize_mode", "upscale_method", "rgb_mode", "rgba_mode")}
            processed_image = cls._apply_upload_adjustments(cropped_image, **method_params)

            # Animation Frames
            if isinstance(processed_image, list):
                animation_frames = []
                for idx, frame in enumerate(processed_image):
                    if not isinstance(frame, Image.Image):
                        continue
                    map_id = str(uuid.uuid4())
                    map_filename = f"{map_id}.png"
                    map_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, map_filename)
                    frame.save(map_path, format=output_format, quality=quality)
                    animation_frames.append({
                        "id": map_id,
                        "type": f"Frame {idx}",
                        "url": f"/download/{map_filename}",
                        "width": frame.width,
                        "height": frame.height
                    })
                    LayerModel.add(f"frame_{idx}", map_path, map_id, 0)
                return {"animationFrames": animation_frames}, 200

            # Zusätzliche Maps
            map_functions = {
                "Diffuse Map": generate_diffuse_map,
                "Normal Map": generate_normal_map,
                "Specular Map": generate_specular_map,
                "Bump Map": generate_bump_map,
                "Light Map": generate_light_map,
                "Alpha Map": generate_alpha_map,
            }

            if isinstance(selected_maps, str):
                selected_maps_iter = [s.strip() for s in selected_maps.split(",") if s.strip()]
            else:
                selected_maps_iter = selected_maps

            additional_maps = []
            for map_type in selected_maps_iter:
                if not map_type or map_type not in map_functions:
                    continue
                map_image = map_functions[map_type](processed_image)
                map_id = str(uuid.uuid4())
                map_filename = f"{map_id}.png"
                map_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, map_filename)
                map_image.save(map_path, format=output_format, quality=quality)
                additional_maps.append({
                    "id": map_id,
                    "type": map_type,
                    "url": f"/download/{map_filename}",
                    "width": map_image.width,
                    "height": map_image.height
                })
                LayerModel.add(map_type, map_path, map_id, 0)

            return {"additionalMaps": additional_maps}, 200

        except Exception as e:
            return cls.handle_error(e)
