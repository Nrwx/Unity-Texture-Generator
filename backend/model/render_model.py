import os
import uuid
import shutil
import base64

from config.data.constant import LAYERS, VIEWPORT_CONFIG
from model.base.main import BaseModel
from model.layer_model import LayerModel
from model.fonts_model import FontsModel
from model.material_model import MaterialModel

from model.modifier_model import ModifierModel
from components import (
    apply_channel,
    generate_text_path_map,
    render_svg,
    generate_thumbnail_map,
)
from generated.paths import (
    PUBLIC_TEMP_RENDER_FOLDER,
    PUBLIC_LAYER_FOLDER,
    PUBLIC_TEMP_UPLOAD_FOLDER,
)
from PIL import Image
from utils import layer_transform, time


class RenderModel(BaseModel):
    @classmethod
    def preview(cls, return_image=False, layer_id=None):
        try:
            if not LAYERS:
                return {"error": "No layers to preview"}, 404

            viewport_width = VIEWPORT_CONFIG[0]["width"]
            viewport_height = VIEWPORT_CONFIG[0]["height"]

            composite_image = Image.new(
                "RGBA",
                (viewport_width, viewport_height),
                (0, 0, 0, 0),
            )

            layer_ids = layer_id if isinstance(layer_id, list) else [layer_id] if layer_id else None

            if layer_ids:
                render_layers = [layer for layer in LAYERS if layer.get("id") in layer_ids]

                if not render_layers:
                    return {"error": "None of the specified layer_ids found."}, 404
            else:
                render_layers = [layer for layer in LAYERS if layer.get("hidden", 0) != 1]

            for layer in render_layers:
                layer_img = cls.load_layer_image(layer)

                if not layer_img:
                    continue

                layer_img = cls.prepare_layer_image(layer, layer_img)

                transformed_img, paste_x, paste_y = layer_transform(
                    layer,
                    layer_img,
                    apply_opacity=True,
                )

                composite_image.paste(
                    transformed_img,
                    (paste_x, paste_y),
                    transformed_img,
                )

            map_id = str(uuid.uuid4())
            map_filename = f"{map_id}.png"
            map_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, map_filename)

            composite_image.save(map_path, format="PNG", quality=100)

            if return_image:
                return composite_image

            return {
                "id": map_id,
                "title": "preview",
                "src": f"/download/{map_filename}?ts={time('unix_ms')}",
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def load_layer_image(cls, layer):
        """
        Lädt genau ein Layer-Bild.
        Unterstützt:
        - type 2: SVG / Path Layer
        - type 1: Text Layer
        - default: PNG Layer aus PUBLIC_LAYER_FOLDER
        """
        if not layer:
            return None

        if layer.get("type") == 2:
            layer_img = render_svg(layer["id"])

            if not layer_img:
                return None

            return layer_img.convert("RGBA")

        if layer.get("type") == 1:
            layer_img = FontsModel.render(layer)

            if not layer_img:
                return None

            return layer_img.convert("RGBA")

        layer_path = os.path.join(
            PUBLIC_LAYER_FOLDER,
            f"{layer['id']}.png",
        )

        if not os.path.exists(layer_path):
            return None

        return Image.open(layer_path).convert("RGBA")

    @classmethod
    def prepare_layer_image(cls, layer, layer_img):
        """
        Wendet Channel-Konfiguration auf ein einzelnes Layer-Bild an.
        """
        channel_config = layer.get("channel", {})
        return apply_channel(layer_img, channel_config)

    @classmethod
    def render_single_layer_preview(cls, layer, layer_img, title):
        """
        Rendert ausschließlich den angegebenen Layer in eine transparente Viewport-Fläche.
        Andere sichtbare Layer werden bewusst ignoriert.

        Das ist wichtig für Modifier-Previews:
        - Color Preview zeigt nur den aktiven Layer.
        - Details Preview zeigt nur den aktiven Layer.
        """
        viewport_width = VIEWPORT_CONFIG[0]["width"]
        viewport_height = VIEWPORT_CONFIG[0]["height"]

        composite_image = Image.new(
            "RGBA",
            (viewport_width, viewport_height),
            (0, 0, 0, 0),
        )

        layer_img = cls.prepare_layer_image(layer, layer_img)

        transformed_img, paste_x, paste_y = layer_transform(
            layer,
            layer_img,
            apply_opacity=True,
        )

        composite_image.paste(
            transformed_img,
            (paste_x, paste_y),
            transformed_img,
        )

        map_id = str(uuid.uuid4())
        map_filename = f"{map_id}.png"
        map_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, map_filename)

        composite_image.save(map_path, format="PNG", quality=100)

        return {
            "id": map_id,
            "title": title,
            "src": f"/download/{map_filename}?ts={time('unix_ms')}",
        }, 200

    @classmethod
    def color_preview(
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
            if not LAYERS:
                return {"error": "No layers to preview"}, 404

            target_layer = next(
                (layer for layer in LAYERS if layer.get("id") == id),
                None,
            )

            if not target_layer:
                return {"error": f"Layer with id '{id}' not found."}, 404

            layer_img = cls.load_layer_image(target_layer)

            if not layer_img:
                return {"error": f"Layer image for id '{id}' not found."}, 404

            layer_img = ModifierModel.apply_color_stack(
                image=layer_img,
                layer=target_layer,

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

            return cls.render_single_layer_preview(
                layer=target_layer,
                layer_img=layer_img,
                title="modifier-color-preview",
            )

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def details_preview(
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
            if not LAYERS:
                return {"error": "No layers to preview"}, 404

            target_layer = next(
                (layer for layer in LAYERS if layer.get("id") == id),
                None,
            )

            if not target_layer:
                return {"error": f"Layer with id '{id}' not found."}, 404

            layer_img = cls.load_layer_image(target_layer)

            if not layer_img:
                return {"error": f"Layer image for id '{id}' not found."}, 404

            layer_img = ModifierModel.apply_details_stack(
                image=layer_img,
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

            return cls.render_single_layer_preview(
                layer=target_layer,
                layer_img=layer_img,
                title="details-preview",
            )

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def effects_preview(
        cls,
        id,

        effects_effect="noise",

        noise_level=10,

        pixel_size=10,

        glass_effect_type=1,
        glass_frost_strength=5,
        glass_frost_mode=1,
        glass_blur_radius=5,
        glass_crack_intensity=10,
        glass_reflection_strength=0.5,

        deepness_factor=1.0,
        highness_factor=1.0,

        falloff_custom_enabled=False,
        falloff_custom_points="[]",
        falloff_preset="smooth",
        falloff_radius=100,
        falloff_strength=1.0,
        falloff_center_x=0.5,
        falloff_center_y=0.5,
        falloff_inverted=False,
        falloff_random_seed=1,
    ):
        try:
            if not LAYERS:
                return {"error": "No layers to preview"}, 404

            target_layer = next(
                (layer for layer in LAYERS if layer.get("id") == id),
                None,
            )

            if not target_layer:
                return {"error": f"Layer with id '{id}' not found."}, 404

            layer_img = cls.load_layer_image(target_layer)

            if not layer_img:
                return {"error": f"Layer image for id '{id}' not found."}, 404

            layer_img = ModifierModel.apply_effects_stack(
                image=layer_img,

                effects_effect=effects_effect,

                noise_level=noise_level,

                pixel_size=pixel_size,

                glass_effect_type=glass_effect_type,
                glass_frost_strength=glass_frost_strength,
                glass_frost_mode=glass_frost_mode,
                glass_blur_radius=glass_blur_radius,
                glass_crack_intensity=glass_crack_intensity,
                glass_reflection_strength=glass_reflection_strength,

                deepness_factor=deepness_factor,
                highness_factor=highness_factor,

                falloff_custom_enabled=falloff_custom_enabled,
                falloff_custom_points=falloff_custom_points,
                falloff_preset=falloff_preset,
                falloff_radius=falloff_radius,
                falloff_strength=falloff_strength,
                falloff_center_x=falloff_center_x,
                falloff_center_y=falloff_center_y,
                falloff_inverted=falloff_inverted,
                falloff_random_seed=falloff_random_seed,
            )

            return cls.render_single_layer_preview(
                layer=target_layer,
                layer_img=layer_img,
                title="effects-preview",
            )

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def distort_preview(
        cls,
        id,

        distort_effect="distort",

        distortion_factor=0.2,

        wave_strength=5,
        wave_frequency=5,
        wave_axis="vertical",

        max_shift_ratio=0.1,

        falloff_preset="smooth",
        falloff_radius=100,
        falloff_strength=1.0,
        falloff_center_x=0.5,
        falloff_center_y=0.5,
        falloff_inverted=False,
        falloff_random_seed=1,

        falloff_custom_enabled=False,
        falloff_custom_points="[]",
    ):
        try:
            if not LAYERS:
                return {"error": "No layers to preview"}, 404

            target_layer = next(
                (layer for layer in LAYERS if layer.get("id") == id),
                None,
            )

            if not target_layer:
                return {"error": f"Layer with id '{id}' not found."}, 404

            layer_img = cls.load_layer_image(target_layer)

            if not layer_img:
                return {"error": f"Layer image for id '{id}' not found."}, 404

            layer_img = ModifierModel.apply_distort_stack(
                image=layer_img,

                distort_effect=distort_effect,

                distortion_factor=distortion_factor,

                wave_strength=wave_strength,
                wave_frequency=wave_frequency,
                wave_axis=wave_axis,

                max_shift_ratio=max_shift_ratio,

                falloff_preset=falloff_preset,
                falloff_radius=falloff_radius,
                falloff_strength=falloff_strength,
                falloff_center_x=falloff_center_x,
                falloff_center_y=falloff_center_y,
                falloff_inverted=falloff_inverted,
                falloff_random_seed=falloff_random_seed,

                falloff_custom_enabled=falloff_custom_enabled,
                falloff_custom_points=falloff_custom_points,
            )

            return cls.render_single_layer_preview(
                layer=target_layer,
                layer_img=layer_img,
                title="distort-preview",
            )

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def material_preview(
        cls,
        source_layer_id="",
        name="Cube Material",
        surface="{}",
        geometry="{}",
        bitmap_maps="{}",
        uv="{}",
        shader_graph="{}",
        cube_size=256.0,
        rotate_preview=True,
        blend_mode="BLEND",
        shadow_method="HASHED",
        use_nodes=True,
        values="{}",
        texture_size="Original",
        **extra
    ):
        try:
            source_layer = next(
                (layer for layer in LAYERS if layer.get("id") == source_layer_id),
                None,
            )

            if not source_layer:
                return {"error": f"Source layer '{source_layer_id}' not found."}, 404

            material_id = f"preview-{uuid.uuid4()}"

            package = MaterialModel.build_material_package(
                material_id=material_id,
                layer_id=material_id,
                source_layer_id=source_layer_id,
                name=name,
                surface=surface,
                geometry=geometry,
                bitmap_maps=bitmap_maps,
                uv=uv,
                shader_graph=shader_graph,
                cube_size=cube_size,
                rotate_preview=rotate_preview,
                blend_mode=blend_mode,
                shadow_method=shadow_method,
                use_nodes=use_nodes,
                values=values,
                texture_size=texture_size,
                **extra
            )

            preview_layer = {
                "id": f"preview-{package['id']}",
                "source": source_layer_id,
                "name": name,
                "type": 5,
                "renderer": "canvas-cube",
                "engine": "material",

                "width": int(source_layer.get("width") or cube_size or 256),
                "height": int(source_layer.get("height") or cube_size or 256),

                "url": package["texture"].get("url"),
                "thumbnail": package["texture"].get("url"),

                "surface": package["surface"],
                "geometry": package["geometry"],
                "bitmap_maps": package["bitmap_maps"],
                "uv": package["uv"],
                "shader_graph": package["shader_graph"],
                "particle_system": package.get("particle_system", {}),

                "material": package["material"],
                "mesh": package["mesh"],
                "shader": package["shader"],
                "texture": package["texture"],
                "package": package["package"],
                "preview": package["preview"],
                "settings": package["settings"],

                "texture_size": package["settings"].get("texture_size", texture_size),
                "texture_lod_key": package["settings"].get("texture_lod_key", ""),

                "hidden": 0,
                "opacity": 1,
                "blend_mode": 0,
                "color": "#ffffff",
                "mask": "",

                "time": time("unix_ms"),
            }

            return {
                "id": material_id,
                "title": "material-preview",
                "src": preview_layer.get("url"),
                "layer": preview_layer,
                "package": package,
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def text_to_path(cls, id):
        try:
            layer = next((layer for layer in LAYERS if layer.get("id") == id), None)

            if not layer:
                raise ValueError(f"Layer mit ID '{id}' nicht gefunden")

            path_map = generate_text_path_map(layer)

            add_form = {
                "name": "TextForm",
                "points": path_map["points"],
                "connections": path_map["connections"],
                "stroke": "#000000",
                "strokeWidth": 0,
                "strokeDashArray": [],
                "strokeDash": 0,
                "strokeDashType": "",
                "fill": path_map["fill"],
                "fillOpacity": 1,
                "gradient": {
                    "type": "linear",
                    "angle": 90,
                    "stops": [],
                },
                "closed": True,
            }

            new_layer, status_code = LayerModel.addPath(**add_form)

            if status_code != 200:
                return {"error": "Neuer Pfad-Layer konnte nicht hinzugefügt werden"}, 500

            delete_result, delete_status = LayerModel.delete(layer["id"])

            if delete_status != 200:
                return {"error": "Alter Layer konnte nicht gelöscht werden"}, 500

            if layer in LAYERS:
                LAYERS.remove(layer)

            return {
                "message": f"Umwandlung erfolgreich auf ID {new_layer['id']}",
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def upload_base64(cls, image_base64, id=None):
        try:
            if image_base64.startswith("data:image"):
                image_base64 = image_base64.split(",", 1)[1]

            image_data = base64.b64decode(image_base64)

            layer_id = id or str(uuid.uuid4())
            filename = f"{layer_id}.png"
            file_path = os.path.join(PUBLIC_LAYER_FOLDER, filename)

            with open(file_path, "wb") as file:
                file.write(image_data)

            return {
                "id": layer_id,
                "url": f"/download/{filename}",
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def overwrite_image(cls, id, files):
        try:
            layer = next((layer for layer in LAYERS if layer.get("id") == id), None)

            if not layer:
                return {"error": "Layer not found"}, 404

            file_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{id}.png")

            if "file" not in files:
                return {"error": "No file provided"}, 400

            img = Image.open(files["file"].stream)
            width, height = img.size
            img.save(file_path, "PNG", optimize=True)

            layer["width"] = width
            layer["height"] = height
            layer["time"] = time("unix_ms")
            layer["url"] = f"/download/{id}.png?t={layer['time']}"
            layer["thumbnail"] = generate_thumbnail_map(
                id,
                path=file_path,
                size=64,
            )

            return {
                "success": True,
                "id": id,
                "url": layer["url"],
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @staticmethod
    def _thumbnail(id, path, size=128):
        return generate_thumbnail_map(id, path, size)
