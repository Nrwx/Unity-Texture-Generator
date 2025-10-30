import os
import uuid
import shutil
import base64
from config.data.constant import LAYERS, VIEWPORT_CONFIG, CHANNELS
from model.base.main import BaseModel
from model.layer_model import LayerModel
from model.fonts_model import FontsModel
from components import generate_channels, generate_text_path_map, render_svg, generate_thumbnail_map
from generated.paths import PUBLIC_TEMP_RENDER_FOLDER, PUBLIC_LAYER_FOLDER, PUBLIC_TEMP_UPLOAD_FOLDER, PUBLIC_TEMP_CHANNEL_FOLDER
from PIL import Image
from utils import (layer_transform, time)

class RenderModel(BaseModel):

    @classmethod
    def channel(cls):
        try:
            # cleanup temp folder
            if os.path.exists(PUBLIC_TEMP_CHANNEL_FOLDER):
                shutil.rmtree(PUBLIC_TEMP_CHANNEL_FOLDER)

            # get full preview image from asset
            result = cls.preview(return_image=True)
            if isinstance(result, tuple) and "error" in result[0]:
                return result

            composite_image = result  # RGBA base image
            temp_channels = generate_channels(composite_image)  # R/G/B/A

            channel_titles = {
                "R": "Red",
                "G": "Green",
                "B": "Blue",
                "A": "Alpha",
                "COMBINED": "Combined"
            }

            # clear old global list
            CHANNELS.clear()

            # recreate output folder
            os.makedirs(PUBLIC_TEMP_CHANNEL_FOLDER, exist_ok=True)

            # ---- Save individual R,G,B,A channels ----
            for key, img in temp_channels.items():
                map_id = str(uuid.uuid4())
                filename = f"{map_id}.png"
                path = os.path.join(PUBLIC_TEMP_CHANNEL_FOLDER, filename)

                img.save(path, format="PNG", quality=100)
                thumbnail_url = cls._thumbnail(map_id, path, size=64)

                CHANNELS.append({
                    "time": time('unix_ms'),
                    "id": map_id,
                    "name": channel_titles.get(key, key),
                    "url": f"/download/{filename}",
                    "thumbnail": thumbnail_url,
                    "width": img.width,
                    "height": img.height
                })

            # ---- NEW: Create + append Combined channel ----
            combined_id = str(uuid.uuid4())
            combined_filename = f"{combined_id}.png"
            combined_path = os.path.join(PUBLIC_TEMP_CHANNEL_FOLDER, combined_filename)

            combined_image = composite_image.copy()
            combined_image.save(combined_path, format="PNG", quality=100)

            combined_thumb = cls._thumbnail(combined_id, combined_path, size=64)

            CHANNELS.append({
                "time": time('unix_ms'),
                "id": combined_id,
                "combined": True,
                "name": channel_titles["COMBINED"],
                "url": f"/download/{combined_filename}",
                "thumbnail": combined_thumb,
                "width": combined_image.width,
                "height": combined_image.height
            })

            return CHANNELS, 200

        except Exception as e:
            return cls.handle_error(e)


    @classmethod
    def preview(cls, return_image=False, layer_id=None):
        try:
            if not LAYERS:
                return {"error": "No layers to preview"}, 404

            viewport_width = VIEWPORT_CONFIG[0]["width"]
            viewport_height = VIEWPORT_CONFIG[0]["height"]
            composite_image = Image.new('RGBA', (viewport_width, viewport_height), (0, 0, 0, 0))

            render_layers = []
            if layer_id:
                single_layer = next((l for l in LAYERS if l["id"] == layer_id), None)
                if single_layer is None:
                    return {"error": f"Layer with id '{layer_id}' not found."}, 404
                render_layers.append(single_layer)
            else:
                render_layers = [l for l in LAYERS if l.get("hidden", 0) != 1]

            for layer in render_layers:
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

    @staticmethod
    def _thumbnail(id, path, size=128):
        """
        Erzeugt ein Thumbnail über externe Utility und gibt die URL zurück.
        """
        return generate_thumbnail_map(id, path, size)