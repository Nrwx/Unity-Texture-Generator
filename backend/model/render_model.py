import os
import uuid
import shutil
import base64
from config.data.constant import LAYERS, VIEWPORT_CONFIG
from model.base.main import BaseModel
from model.layer_model import LayerModel
from model.fonts_model import FontsModel
from model.modifier_model import ModifierModel
from components import (apply_channel, generate_text_path_map, render_svg, generate_thumbnail_map)
from generated.paths import PUBLIC_TEMP_RENDER_FOLDER, PUBLIC_LAYER_FOLDER, PUBLIC_TEMP_UPLOAD_FOLDER
from PIL import Image
from utils import (layer_transform, time)

class RenderModel(BaseModel):
    @classmethod
    def preview(cls, return_image=False, layer_id=None):
        try:
            if not LAYERS:
                return {"error": "No layers to preview"}, 404

            viewport_width = VIEWPORT_CONFIG[0]["width"]
            viewport_height = VIEWPORT_CONFIG[0]["height"]
            composite_image = Image.new('RGBA', (viewport_width, viewport_height), (0, 0, 0, 0))

            # --- layer_id immer als Liste behandeln ---
            layer_ids = layer_id if isinstance(layer_id, list) else [layer_id] if layer_id else None

            if layer_ids:
                render_layers = [l for l in LAYERS if l["id"] in layer_ids]
                if not render_layers:
                    return {"error": "None of the specified layer_ids found."}, 404
            else:
                render_layers = [l for l in LAYERS if l.get("hidden", 0) != 1]

            for layer in render_layers:
                # Bild laden
                if layer.get("type") == 2:  # Path Layer
                    layer_img = render_svg(layer['id'])
                    if not layer_img:
                        continue
                elif layer.get("type") == 1:  # Text Layer
                    layer_img = FontsModel.render(layer)
                    if not layer_img:
                        continue
                else:
                    layer_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{layer['id']}.png")
                    if not os.path.exists(layer_path):
                        continue
                    layer_img = Image.open(layer_path).convert('RGBA')

                channel_config = layer.get("channel", {})
                layer_img = apply_channel(layer_img, channel_config)

                # Transformation anwenden
                transformed_img, paste_x, paste_y = layer_transform(
                    layer,
                    layer_img,
                    apply_opacity=True
                )

                # In Gesamtdarstellung einfügen
                composite_image.paste(transformed_img, (paste_x, paste_y), transformed_img)

            # Speichern & Rückgabe
            map_id = str(uuid.uuid4())
            map_filename = f"{map_id}.png"
            map_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, map_filename)
            composite_image.save(map_path, format="PNG", quality=100)

            if return_image:
                return composite_image

            return {
                "id": map_id,
                "title": "preview",
                "src": f"/download/{map_filename}"
            }, 200

        except Exception as e:
            return cls.handle_error(e)

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
        select_mask_shape="rectangle"
    ):
        try:
            if not LAYERS:
                return {"error": "No layers to preview"}, 404

            viewport_width = VIEWPORT_CONFIG[0]["width"]
            viewport_height = VIEWPORT_CONFIG[0]["height"]

            composite_image = Image.new(
                "RGBA",
                (viewport_width, viewport_height),
                (0, 0, 0, 0)
            )

            target_layer = next((l for l in LAYERS if l.get("id") == id), None)

            if not target_layer:
                return {"error": f"Layer with id '{id}' not found."}, 404

            render_layers = [l for l in LAYERS if l.get("hidden", 0) != 1]

            for layer in render_layers:
                if layer.get("type") == 2:
                    layer_img = render_svg(layer["id"])

                    if not layer_img:
                        continue

                elif layer.get("type") == 1:
                    layer_img = FontsModel.render(layer)

                    if not layer_img:
                        continue

                else:
                    layer_path = os.path.join(
                        PUBLIC_LAYER_FOLDER,
                        f"{layer['id']}.png"
                    )

                    if not os.path.exists(layer_path):
                        continue

                    layer_img = Image.open(layer_path).convert("RGBA")

                if layer.get("id") == id:
                    layer_img = ModifierModel.apply_color_stack(
                        image=layer_img,
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

                channel_config = layer.get("channel", {})
                layer_img = apply_channel(layer_img, channel_config)

                transformed_img, paste_x, paste_y = layer_transform(
                    layer,
                    layer_img,
                    apply_opacity=True
                )

                composite_image.paste(
                    transformed_img,
                    (paste_x, paste_y),
                    transformed_img
                )

            map_id = str(uuid.uuid4())
            map_filename = f"{map_id}.png"
            map_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, map_filename)

            composite_image.save(map_path, format="PNG", quality=100)

            return {
                "id": map_id,
                "title": "modifier-color-preview",
                "src": f"/download/{map_filename}?ts={time('unix_ms')}"
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def text_to_path(cls, id):
        try:
            layer = next((l for l in LAYERS if l.get("id") == id), None)
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
                "gradient": {"type": "linear", "angle": 90, "stops": []},
                "closed": True
            }
            new_layer, status_code = LayerModel.addPath(**add_form)
            if status_code != 200:
                return {"error": "Neuer Pfad-Layer konnte nicht hinzugefügt werden"}, 500

            delete_result, delete_status = LayerModel.delete(layer["id"])
            if delete_status != 200:
                return {"error": "Alter Layer konnte nicht gelöscht werden"}, 500

            if layer in LAYERS:
                LAYERS.remove(layer)

            return {"message": f"Umwandlung erfolgreich auf ID {new_layer['id']}"}, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def upload_base64(cls, image_base64, id=None):
        """
        Nimmt einen Base64-String (PNG) und speichert ihn im Upload-Folder.
        Optional kann eine Layer-ID mitgegeben werden, ansonsten wird eine UUID erzeugt.
        Gibt URL, ID und Pfad zurück.
        """
        try:
            # Falls "data:image/png;base64," enthalten ist, entfernen
            if image_base64.startswith("data:image"):
                image_base64 = image_base64.split(",", 1)[1]

            # Base64 dekodieren
            image_data = base64.b64decode(image_base64)

            # Falls keine ID angegeben wurde, generieren wir eine neue
            layer_id = id or str(uuid.uuid4())
            filename = f"{layer_id}.png"
            file_path = os.path.join(PUBLIC_LAYER_FOLDER, filename)

            # Datei schreiben
            with open(file_path, "wb") as f:
                f.write(image_data)

            # Rückgabe-URL
            return {
                "id": layer_id,
                "url": f"/download/{filename}",
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def overwrite_image(cls, id, files):
        """
        Überschreibt das Bild eines bestehenden Layers mit einem PNG-Blob/File
        """
        try:
            # Layer prüfen
            layer = next((l for l in LAYERS if l.get("id") == id), None)
            if not layer:
                return {"error": "Layer not found"}, 404

            # Zielpfad
            file_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{id}.png")
            if "file" in files:
                img = Image.open(files["file"].stream)
                width, height = img.size
                img.save(file_path, "PNG", optimize=True)

            # Layer-Metadaten aktualisieren
            layer["width"] = width
            layer["height"] = height
            layer["time"] = time("unix_ms")

            # Cache-Busting URL
            layer["url"] = f"/download/{id}.png?t={layer['time']}"

            # Thumbnail neu erzeugen
            layer["thumbnail"] = generate_thumbnail_map(
                id,
                path=file_path,
                size=64
            )

            return {
                "success": True,
                "id": id,
                "url": layer["url"]
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @staticmethod
    def _thumbnail(id, path, size=128):
        """
        Erzeugt ein Thumbnail über externe Utility und gibt die URL zurück.
        """
        return generate_thumbnail_map(id, path, size)