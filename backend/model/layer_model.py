import os
import uuid
from PIL import Image
import shutil
from generated.paths import ( PUBLIC_BACKUP_FOLDER, PUBLIC_LAYER_FOLDER, PUBLIC_TEMP_UPLOAD_FOLDER, PUBLIC_TEMP_CHANNEL_FOLDER )
from config.data.constant import ( VIEWPORT_CONFIG, LAYERS, CHANNELS )
from components import ( generate_channels, apply_color, apply_edge_smooth, apply_blend_layer)

class LayerModel:
    @staticmethod
    def add(name="", path="", id=None, type=0, width=1024, height=1024):
        source_id = str(uuid.uuid4())
        source_path = os.path.join(PUBLIC_BACKUP_FOLDER, f"{source_id}.png")
        viewport_width = VIEWPORT_CONFIG[0]["width"]
        viewport_height = VIEWPORT_CONFIG[0]["height"]

        if not id:
            id = str(uuid.uuid4())
            path = os.path.join(PUBLIC_LAYER_FOLDER , f"{id}.png")
            img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
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
            "color": "#ffffff"
        }
        LAYERS.append(layer)
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
    def update(type, name, width, height, id, a, b, c, d, x, y, rotate, order, hidden, opacity, blend_mode, color):
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
            layer_path = os.path.join(PUBLIC_LAYER_FOLDER , f"{layer['id']}.png")
            if not os.path.exists(layer_path):
                continue

            layer_img = Image.open(layer_path).convert('RGBA')
            matrix = layer.get("matrix", {
                "a": 1, "b": 0, "c": 0, "d": 1,
                "x": 0, "y": 0, "rotate": 0
            })

            original_width, original_height = layer_img.size
            scale_x = matrix.get("a", 1)
            scale_y = matrix.get("d", 1)

            if layer.get("opacity", 1.0) < 1.0:
                r, g, b, a = layer_img.split()
                a = a.point(lambda p: int(p * layer["opacity"]))
                layer_img = Image.merge("RGBA", (r, g, b, a))

            pos_x = int(round(matrix.get("x", 0)))
            pos_y = int(round(matrix.get("y", 0)))
            rotate_angle = float(matrix.get("rotate", 0))

            center_x = original_width / 2
            center_y = original_height / 2

            if rotate_angle != 0:
                rotated_img = layer_img.rotate(-rotate_angle, resample=Image.BICUBIC, expand=True, center=(center_x, center_y))
                rotated_img = apply_edge_smooth(rotated_img)
                rotated_width, rotated_height = rotated_img.size
            else:
                rotated_img = layer_img
                rotated_width, rotated_height = original_width, original_height

            new_width = int(round(rotated_width * scale_x))
            new_height = int(round(rotated_height * scale_y))
            transformed_img = rotated_img.resize((new_width, new_height), resample=Image.BICUBIC)

            center_scaled_x = new_width / 2
            center_scaled_y = new_height / 2
            offset_x = center_scaled_x - center_x
            offset_y = center_scaled_y - center_y

            paste_x = int(round(pos_x - offset_x))
            paste_y = int(round(pos_y - offset_y))

            composite_image.paste(transformed_img, (paste_x, paste_y), transformed_img)

        map_id = str(uuid.uuid4())
        map_filename = f"{map_id}.png"
        map_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER , map_filename)
        composite_image.save(map_path, format="PNG", quality=100)

        if return_image:
            return composite_image

        return {
            "id": map_id,
            "title": "preview",
            "src": f"/download/{map_filename}"
        }, 200

    @staticmethod
    def addText(type: int,order: int, name: str,hidden: int,opacity: float,color: str,fontFamily: str,fontSize: int,fontWeight: str,initFontSize: int,initHeight: int,initWidth: int,letterSpacing: float,lineHeight: float,text: str,textAlign: str,textDecoration: str,textTransform: str,width: int,height: int,x: int,y: int):
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
        return {"success": True, "message": f"Layer {id} moved to position {order}."}, 200

    @staticmethod
    def paste(id, order):
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

        img1_path = os.path.join(PUBLIC_LAYER_FOLDER , f"{id}.png")
        img1 = Image.open(img1_path).convert("RGBA")
        img_array1 = np.array(img1)
        alpha1 = img_array1[..., 3]

        layer["blend_mode"] = blend_mode
        layer["color"] = color

        layer_order = layer.get("order", 0)

        if layer_order == 0:
            colored_array = apply_color(img_array1[..., :3], color, blend_mode)
            blended_rgba = np.dstack((colored_array, alpha1))
            blended_img = Image.fromarray(blended_rgba.astype(np.uint8))
        else:
            base_index = layer_order - 1
            if base_index < 0 or base_index >= len(LAYERS):
                return {"error": "Invalid layer order"}, 404

            base_layer = LAYERS[base_index]
            base_id = base_layer["id"]

            img2_path = os.path.join(PUBLIC_LAYER_FOLDER , f"{base_id}.png")
            img2 = Image.open(img2_path).convert("RGBA")
            img_array2 = np.array(img2)
            alpha2 = img_array2[..., 3]

            x1, y1 = layer["matrix"]["x"], layer["matrix"]["y"]
            w1, h1 = layer["width"], layer["height"]

            x2, y2 = base_layer["matrix"]["x"], base_layer["matrix"]["y"]
            w2, h2 = base_layer["width"], base_layer["height"]

            rel_x = int(x1 - x2)
            rel_y = int(y1 - y2)

            rel_x = np.clip(rel_x, 0, w2)
            rel_y = np.clip(rel_y, 0, h2)
            rel_x_end = np.clip(rel_x + w1, 0, w2)
            rel_y_end = np.clip(rel_y + h1, 0, h2)

            cropped_base_rgb = img_array2[rel_y:rel_y_end, rel_x:rel_x_end, :3]
            cropped_base_alpha = alpha2[rel_y:rel_y_end, rel_x:rel_x_end]

            blended_rgb = apply_blend_layer(img_array1[..., :3], cropped_base_rgb, alpha1, blend_mode)

            blended_rgba = np.dstack((blended_rgb, alpha1))
            blended_img = Image.fromarray(blended_rgba.astype(np.uint8))

        if blend_mode != 0:
            output_id = str(uuid.uuid4())
            map_filename = f"{output_id}.png"
            map_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER , map_filename)
            url_path = f"/download/{output_id}.png"
        else:
            map_filename = f"{id}.png"
            map_path = os.path.join(PUBLIC_LAYER_FOLDER , map_filename)
            url_path = f"/download/{id}.png"

        blended_img.save(map_path)

        layer["url"] = url_path

        return {
            "success": True,
            "message": f"Blend mode '{blend_mode}' applied with color {color}.",
            "url": url_path
        }, 200

    @staticmethod
    def hide(id, hidden):
        hidden = int(hidden)
        if hidden not in (0, 1):
            return {"error": "'hidden' must be 0 or 1."}, 404

        layer = next((l for l in LAYERS if l["id"] == id), None)
        if layer is None:
            return {"error": f"Layer with id {id} not found."}, 404

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
                "id": f"{map_id}",
                "name": channel_titles.get(key, key),
                "url": f"/download/{filename}",
                "width": img.width,
                "height": img.height
            })

        return CHANNELS, 200

    # ADD METHODS END
