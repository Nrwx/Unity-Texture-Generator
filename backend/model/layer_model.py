import os
import uuid
import numpy as np
from PIL import Image, ImageChops, ImageFont, ImageDraw
from datetime import datetime
import shutil
import copy
import math
from generated.paths import ( PUBLIC_BACKUP_FOLDER, PUBLIC_LAYER_FOLDER, PUBLIC_TEMP_UPLOAD_FOLDER, PUBLIC_TEMP_CHANNEL_FOLDER, PUBLIC_TEMP_MASK_FOLDER, PUBLIC_FONT_FOLDER )
from config.data.constant import ( VIEWPORT_CONFIG, LAYERS, CHANNELS, FONTS )
from model.fonts_model import FontsModel
from model.backup_model import BackupModel
from components import ( generate_channels, apply_color, apply_mask, apply_blend_layer)
from utils import get_path, apply_rgb_rgba, apply_alpha, time, layer_transform

class LayerModel:
    @staticmethod
    def add(name="", path="", id="", type=0, width=1024, height=1024):
        source_id = str(uuid.uuid4())
        source_path = os.path.join(PUBLIC_BACKUP_FOLDER, f"{source_id}.png")
        viewport_width = VIEWPORT_CONFIG[0]["width"]
        viewport_height = VIEWPORT_CONFIG[0]["height"]

        if not id:
            id = str(uuid.uuid4())
            path = os.path.join(PUBLIC_LAYER_FOLDER , f"{id}.png")
            img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        elif not path and id:
            path = get_path(id)
            img = Image.open(path)
            width, height = img.size
            id = str(uuid.uuid4())
        else:
            img = Image.open(path)
            width, height = img.size

        img.save(source_path)

        scale_factor = min(viewport_width / width, viewport_height / height)
        image_path = os.path.join(PUBLIC_LAYER_FOLDER , f"{id}.png")

        if scale_factor < 1:
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)

            img = img.resize((new_width, new_height), Image.LANCZOS)
            img.save(image_path)

            translate_x = int((viewport_width - new_width) / 2)
            translate_y = int((viewport_height - new_height) / 2)
        else:
            img.save(image_path)
            translate_x = int((viewport_width - width) / 2)
            translate_y = int((viewport_height - height) / 2)

        matrix = {
            "a": 1,
            "b": 0,
            "c": 0,
            "d": 1,
            "x": translate_x,
            "y": translate_y,
            "rotate": 0,
        }

        layer = {
            "time": time('unix_ms'),
            "type": type,
            "id": id,
            "name": name,
            "width": new_width if scale_factor < 1 else width,
            "height": new_height if scale_factor < 1 else height,
            "url": f"/download/{id}.png",
            "matrix": matrix,
            "source": source_id,
            "order": len(LAYERS),
            "hidden": 0,
            "opacity": 1,
            "blend_mode": 0,
            "color": "#ffffff",
            "mask": ""
        }
        LAYERS.append(layer)
        BackupModel.create(layer, id, name)

        print(LAYERS)
        return layer, 200

    @staticmethod
    def delete(id):
        layer = next((l for l in LAYERS if l["id"] == id), None)
        if not layer:
            return {"error": "Layer not found"}, 404

        image_path = os.path.join(PUBLIC_LAYER_FOLDER , f"{id}.png")
        LAYERS.remove(layer)

        print(f"Deleting layer: {image_path}")
        if os.path.exists(image_path):
            os.remove(image_path)

        return {"message": "Layer deleted"}, 200

    @staticmethod
    def fetch():
        return LAYERS, 200

    @staticmethod
    def update(type, name, width, height, id, a, b, c, d, x, y, rotate, order, hidden, opacity, blend_mode, color, mask):
        layer = next((l for l in LAYERS if l["id"] == id), None)
        if not layer:
            return {"error": "Layer not found"}, 404

        matrix = {
            "a": a,  # Skalierung X
            "b": b,  # Rotation / Verzerrung
            "c": c,  # Rotation / Verzerrung
            "d": d,  # Skalierung Y
            "x": x,  # Position X
            "y": y,  # Position Y
            "rotate": rotate  # Rotation in Grad
        }

        if type:
            layer["type"] = type
        if name:
            layer["name"] = name
        if width:
            layer["width"] = width
        if height:
            layer["height"] = height
        if id:
            layer["id"] = id
        if matrix:
            layer["matrix"] = matrix
        if order:
            layer["order"] = order
        if hidden:
            layer["hidden"] = hidden
        if opacity:
            layer["opacity"] = opacity
        if blend_mode:
            layer["blend_mode"] = blend_mode
        if color:
            layer["color"] = color
        if mask:
            layer["mask"] = mask

        layer["time"] = time('unix_ms')

        print(LAYERS)
        return layer, 200

    @staticmethod
    def preview(return_image=False, layer_id=None):
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
            if layer.get("type") == 1:  # Text Layer
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

    @staticmethod
    def addText(type: int,order: int, name: str,hidden: int,opacity: float,color: str, font: str, fontFamily: str,fontSize: int,fontWeight: str,initFontSize: int,initHeight: int,initWidth: int,letterSpacing: float,lineHeight: float,text: str,textAlign: str,textDecoration: str,textTransform: str,width: int,height: int,x: int,y: int, mask: str):
        viewport_width = VIEWPORT_CONFIG[0]["width"]
        viewport_height = VIEWPORT_CONFIG[0]["height"]

        matrix = {
            "a": 1,
            "b": 0,
            "c": 0,
            "d": 1,
            "x": x if x is not None else int((viewport_width - width) / 2),
            "y": y if y is not None else int((viewport_height - height) / 2),
            "rotate": 0,
        }

        id = str(uuid.uuid4())

        layer = {
            "time": time('unix_ms'),
            "type": type,
            "id": id,
            "name": name,
            "width": width,
            "height": height,
            "matrix": matrix,
            "order": order if order is not None else len(LAYERS),
            "hidden": hidden,
            "opacity": opacity,
            "color": color,

            "font": font,
            "fontFamily": fontFamily,
            "fontSize": fontSize,
            "fontWeight": fontWeight,
            "initFontSize": initFontSize,
            "initHeight": initHeight,
            "initWidth": initWidth,
            "letterSpacing": letterSpacing,
            "lineHeight": lineHeight,
            "text": text,
            "textAlign": textAlign,
            "textDecoration": textDecoration,
            "textTransform": textTransform,
            "mask" : mask
        }

        LAYERS.append(layer)
        print(LAYERS)
        return layer, 200

    @staticmethod
    def order(id, order):
        order = int(order)
        index = next((i for i, l in enumerate(LAYERS) if l["id"] == id), None)
        if index is None:
            return {"error": f"Layer with id {id} not found."}, 404
        moved_layer = LAYERS.pop(index)
        LAYERS.insert(order, moved_layer)
        for i, layer in enumerate(LAYERS):
            layer["order"] = i
            layer["time"] = time('unix_ms')
        return {"success": True, "message": f"Layer {id} moved to position {order}."}, 200

    @staticmethod
    def paste(id):
        layer = next((l for l in LAYERS if l["id"] == id), None)

        if layer is None:
            return {"error": f"Layer with id '{id}' not found."}, 404

        if layer["type"] == 0:
            img_path = os.path.join(PUBLIC_LAYER_FOLDER , f"{id}.png")
            if not os.path.exists(img_path):
                return {"error": "Original image file not found"}, 404
            img = Image.open(img_path).convert("RGBA")

        new_layer = copy.deepcopy(layer)
        new_id = str(uuid.uuid4())
        new_layer["id"] = new_id
        new_layer["time"] = time('unix_ms')
        new_layer["order"] = layer["order"]

        if layer["type"] == 0:
            new_img_path = os.path.join(PUBLIC_LAYER_FOLDER , f"{new_id}.png")
            img.save(new_img_path)

        index = LAYERS.index(layer)
        LAYERS.insert(index, new_layer)

        print(f"Pasted layer with new ID {new_id}")
        return new_layer, 200

    @staticmethod
    def blend(id, blend_mode, color):
        layer = next((l for l in LAYERS if l["id"] == id), None)
        if layer is None:
            return {"error": f"Layer with id '{id}' not found."}, 404

        # Viewport-Größe laden
        viewport_width = VIEWPORT_CONFIG[0]["width"]
        viewport_height = VIEWPORT_CONFIG[0]["height"]

        # Fixiertes Layer-Image (Transformationen übernommen & Matrix zurückgesetzt)
        img1 = LayerModel.render(layer)  # apply_matrix = True
        x1 = int(layer["matrix"]["x"])
        y1 = int(layer["matrix"]["y"])
        w1, h1 = img1.size
        img_array1 = np.array(img1)
        alpha1 = img_array1[..., 3]

        # Blend-Daten setzen
        layer["blend_mode"] = blend_mode
        layer["color"] = color
        layer_order = layer.get("order", 0)

        if layer_order == 0:
            # Farb-Overlay direkt anwenden
            colored_array = apply_color(img_array1[..., :3], color, blend_mode)
            blended_rgba = np.dstack((colored_array, alpha1))
            blended_img = Image.fromarray(blended_rgba.astype(np.uint8))

        else:
            base_index = layer_order - 1
            if base_index < 0 or base_index >= len(LAYERS):
                return {"error": "Invalid layer order"}, 404

            base_layer = LAYERS[base_index]
            img2 = LayerModel.render(base_layer, apply_matrix=False)
            x2 = int(base_layer["matrix"]["x"])
            y2 = int(base_layer["matrix"]["y"])
            w2, h2 = img2.size
            img_array2 = np.array(img2)
            alpha2 = img_array2[..., 3]

            # Positionsberechnung im globalen Canvas
            canvas_x1 = x1 + viewport_width // 2
            canvas_y1 = y1 + viewport_height // 2
            canvas_x2 = x2 + viewport_width // 2
            canvas_y2 = y2 + viewport_height // 2

            # Überlappungsbereich berechnen
            overlap_x1 = max(canvas_x1, canvas_x2)
            overlap_y1 = max(canvas_y1, canvas_y2)
            overlap_x2 = min(canvas_x1 + w1, canvas_x2 + w2)
            overlap_y2 = min(canvas_y1 + h1, canvas_y2 + h2)

            if overlap_x1 >= overlap_x2 or overlap_y1 >= overlap_y2:
                return {"error": "No overlapping region between layers."}, 400

            region_w = overlap_x2 - overlap_x1
            region_h = overlap_y2 - overlap_y1

            # Lokale Offsets
            layer_off_x = overlap_x1 - canvas_x1
            layer_off_y = overlap_y1 - canvas_y1
            base_off_x = overlap_x1 - canvas_x2
            base_off_y = overlap_y1 - canvas_y2

            # Bildausschnitte für beide Layer extrahieren
            cropped_layer_rgb = img_array1[layer_off_y:layer_off_y + region_h, layer_off_x:layer_off_x + region_w, :3]
            cropped_layer_alpha = alpha1[layer_off_y:layer_off_y + region_h, layer_off_x:layer_off_x + region_w]
            cropped_base_rgb = img_array2[base_off_y:base_off_y + region_h, base_off_x:base_off_x + region_w, :3]

            # Blend anwenden
            blended_rgb = apply_blend_layer(cropped_layer_rgb, cropped_base_rgb, cropped_layer_alpha, blend_mode)
            blended_rgba = np.dstack((blended_rgb, cropped_layer_alpha))

            # Endbild zusammensetzen
            full_layer = img_array1.copy()
            full_layer[layer_off_y:layer_off_y + region_h, layer_off_x:layer_off_x + region_w, :4] = blended_rgba
            blended_img = Image.fromarray(full_layer.astype(np.uint8))

        # Speicherpfad
        output_id = str(uuid.uuid4()) if blend_mode != 0 else id
        map_filename = f"{output_id}.png"
        map_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER if blend_mode != 0 else PUBLIC_LAYER_FOLDER, map_filename)
        url_path = f"/download/{map_filename}"

        # Bild speichern
        blended_img.save(map_path)
        layer["time"] = time("unix_ms")
        layer["url"] = url_path

        return {
            "success": True,
            "message": f"Blend mode '{blend_mode}' applied with color {color}.",
            "url": url_path
        }, 200



    @staticmethod
    def render(layer, apply_matrix=True):
        img_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{layer['id']}.png")
        img = Image.open(img_path).convert("RGBA")

        # Transformation anwenden
        transformed_img, paste_x, paste_y = layer_transform(layer, img)

        if apply_matrix:
            # Neue Größe ermitteln
            w, h = transformed_img.size

            # Speichern
            filename = f"{layer['id']}.png"
            path = os.path.join(PUBLIC_LAYER_FOLDER, filename)
            transformed_img.save(path, format="PNG")

            # Layer im globalen LAYERS-Array aktualisieren
            for i, l in enumerate(LAYERS):
                if l["id"] == layer["id"]:
                    LAYERS[i]["matrix"] = {
                      "a": 1, "b": 0,
                      "c": 0, "d": 1,
                      "x": paste_x,
                      "y": paste_y,
                      "rotate": 0
                    }
                    LAYERS[i]["width"] = w
                    LAYERS[i]["height"] = h
                    LAYERS[i]["url"] = f"/download/{filename}"
                    break

        return transformed_img

    @staticmethod
    def hide(id, hidden):
        hidden = int(hidden)
        if hidden not in (0, 1):
            return {"error": "'hidden' must be 0 or 1."}, 404

        layer = next((l for l in LAYERS if l["id"] == id), None)
        if layer is None:
            return {"error": f"Layer with id {id} not found."}, 404

        layer["time"] = time('unix_ms')
        layer["hidden"] = hidden

        return {
            "success": True,
            "message": f"Layer {id} visibility set to {hidden}."
        }, 200

    @staticmethod
    def channel():
        if os.path.exists(PUBLIC_TEMP_CHANNEL_FOLDER ):
            shutil.rmtree(PUBLIC_TEMP_CHANNEL_FOLDER )

        result = LayerModel.preview(return_image=True)
        if isinstance(result, tuple) and "error" in result[0]:
            return result

        composite_image = result

        temp_channels = generate_channels(composite_image)

        channel_titles = {
            "R": "Red",
            "G": "Green",
            "B": "Blue",
            "A": "Alpha"
        }

        CHANNELS.clear()

        if not os.path.exists(PUBLIC_TEMP_CHANNEL_FOLDER ):
            os.makedirs(PUBLIC_TEMP_CHANNEL_FOLDER , exist_ok=True)

        for key, img in temp_channels.items():
            map_id = str(uuid.uuid4())
            filename = f"{map_id}.png"
            path = os.path.join(PUBLIC_TEMP_CHANNEL_FOLDER , filename)
            img.save(path, format="PNG", quality=100)

            CHANNELS.append({
                "time": time('unix_ms'),
                "id": f"{map_id}",
                "name": channel_titles.get(key, key),
                "url": f"/download/{filename}",
                "width": img.width,
                "height": img.height
            })

        return CHANNELS, 200

    @staticmethod
    def mask(id, id2):
        path1 = os.path.join(PUBLIC_LAYER_FOLDER, f"{id}.png")
        path2 = os.path.join(PUBLIC_LAYER_FOLDER, f"{id2}.png")

        if not os.path.exists(path1) or not os.path.exists(path2):
            return {"error": "One or both image files not found"}, 404

        # Layer finden
        layer1 = next((l for l in LAYERS if l["id"] == id), None)
        layer2 = next((l for l in LAYERS if l["id"] == id2), None)
        if not layer1 or not layer2:
            return {"error": "One or both layers not found"}, 404

        # Wer ist Base, wer Maske
        if layer1["order"] < layer2["order"]:
            base_layer, mask_layer = layer1, layer2
        else:
            base_layer, mask_layer = layer2, layer1

        # Base-Daten
        base_image = Image.open(os.path.join(PUBLIC_LAYER_FOLDER, f"{base_layer['id']}.png")).convert("RGBA")
        base_x = base_layer.get("matrix", {}).get("x", 0)
        base_y = base_layer.get("matrix", {}).get("y", 0)
        bw, bh = base_image.size

        # Maske vorbereiten (Transform + Position berechnen)
        mask_img = Image.open(os.path.join(PUBLIC_LAYER_FOLDER, f"{mask_layer['id']}.png")).convert("RGBA")
        transformed, paste_x, paste_y = layer_transform(
            mask_layer, mask_img,
            apply_opacity=False
        )

        # Alphakanal extrahieren + Opacity anwenden
        alpha = transformed.split()[-1]
        opacity = mask_layer.get("opacity", 1.0)
        if opacity < 1.0:
            alpha = alpha.point(lambda p: int(p * opacity))

        # Überlappung berechnen
        new_w, new_h = transformed.size
        mx1 = paste_x
        my1 = paste_y
        mx2 = mx1 + new_w
        my2 = my1 + new_h

        bx1 = base_x
        by1 = base_y
        bx2 = bx1 + bw
        by2 = by1 + bh

        x1 = max(mx1, bx1)
        y1 = max(my1, by1)
        x2 = min(mx2, bx2)
        y2 = min(my2, by2)

        if x2 <= x1 or y2 <= y1:
            return {"error": "Layers do not overlap"}, 400

        # Zuschneiden + Maske erzeugen
        crop_box_mask = (x1 - mx1, y1 - my1, x2 - mx1, y2 - my1)
        crop_box_base = (x1 - bx1, y1 - by1)
        cropped_alpha = alpha.crop(crop_box_mask)

        result = Image.new("L", (bw, bh), 0)
        result.paste(cropped_alpha, crop_box_base)

        # Speichern
        new_id = str(uuid.uuid4())
        mask_filename = f"{new_id}.png"
        result_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, mask_filename)
        result.save(result_path)

        # Masken-Link setzen
        base_layer["time"] = time('unix_ms')
        base_layer["mask"] = f"/download/{mask_filename}"

        return {
            "success": True,
            "message": f"Alpha mask generated from {mask_layer['id']} to {base_layer['id']}.",
            "id": base_layer['id'],
            "id2": new_id
        }, 200

    @staticmethod
    def masked(id, id2):
        layer = next((l for l in LAYERS if l["id"] == id), None)
        if not layer:
            return {"error": f"Layer with id '{id}' not found."}, 404

        if "url" not in layer:
            return {"error": "Layer has no 'url' for base image."}, 400

        base_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{layer['id']}.png")
        if not os.path.exists(base_path):
            return {"error": f"Base image file not found: {layer['url']}"}, 404
        base_img = Image.open(base_path).convert("RGBA")

        if "mask" not in layer or not layer["mask"]:
            return {"error": "Layer has no mask to apply."}, 400

        mask_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, f"{id2}.png")
        if not os.path.exists(mask_path):
            return {"error": f"Mask file not found: {layer['mask']}"}, 404
        mask_img = Image.open(mask_path).convert("L")

        # Anwendung der Maske
        masked_img = apply_mask(base_img, mask_img)

        # Speichern
        new_id = str(uuid.uuid4())
        masked_filename = f"{new_id}.png"
        masked_path = os.path.join(PUBLIC_TEMP_MASK_FOLDER, masked_filename)
        masked_img.save(masked_path, format="PNG")

        # Layer aktualisieren
        layer["time"] = time('unix_ms')
        layer["masked"] = f"/download/{masked_filename}"

        print(LAYERS)

        return {
            "success": True,
            "message": f"Masked image generated for layer {id}."
        }, 200


    # ADD METHODS END
