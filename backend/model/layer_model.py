import os
import uuid
import numpy as np
from PIL import Image, ImageChops, ImageFont, ImageDraw
from datetime import datetime
import shutil
import copy
import math
from generated.paths import ( PUBLIC_BACKUP_FOLDER, PUBLIC_LAYER_FOLDER, PUBLIC_TEMP_UPLOAD_FOLDER, PUBLIC_TEMP_CHANNEL_FOLDER, PUBLIC_TEMP_MASK_FOLDER )
from model.base.main import BaseModel
from config.data.constant import ( VIEWPORT_CONFIG, LAYERS, CHANNELS, PATHS, GROUPS )
from model.backup_model import BackupModel
from components import ( apply_channel, generate_channels, apply_color, apply_mask, apply_blend_layer, get_svg_box, generate_svg_map, generate_thumbnail_map, render_svg)
from utils import get_path, apply_rgb_rgba, apply_alpha, time, layer_transform

class LayerModel(BaseModel):

    @staticmethod
    def _bust_url(id, ext="png"):
        base, current_ext = os.path.splitext(id)
        if not base:
            base = id

        return f"/download/{base}.{ext}?ts={int(time('unix_ms'))}"

    @classmethod
    def add(cls, name="", path="", id="", type=0, width=1024, height=1024):
        try:
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
            image_path = os.path.join(PUBLIC_LAYER_FOLDER , f"{id}.png")

            img.save(image_path)

            if width > viewport_width or height > viewport_height:
                if width / viewport_width > height / viewport_height:
                    scale_x = min(viewport_width / width, 1)
                    scale_y = scale_x
                else:
                    scale_y = min(viewport_height / height, 1)
                    scale_x = scale_y

            else:
                scale_x = 1.0
                scale_y = 1.0

            translate_x = int((viewport_width - width) / 2)
            translate_y = int((viewport_height - height) / 2)

            matrix = {
                "a": scale_x,
                "b": 0,
                "c": 0,
                "d": scale_y,
                "x": translate_x,
                "y": translate_y,
                "rotate": 0,
            }

            channel = {
                "red": True,
                "green": True,
                "blue": True,
                "alpha": True,
                "cyan": False,
                "grey": False,
                "combined": False
            }

            layer = {
                "time": time('unix_ms'),
                "type": type,
                "id": id,
                "name": name,
                "width": width,
                "height": height,
                "url": cls._bust_url(id),
                "matrix": matrix,
                "source": source_id,
                "order": len(LAYERS),
                "thumbnail": generate_thumbnail_map(id, image_path, 64),
                "hidden": 0,
                "group": None,
                "opacity": 1,
                "channel": channel,
                "blend_mode": 0,
                "color": "#ffffff",
                "mask": ""
            }
            LAYERS.append(layer)
            BackupModel.create(layer, id, name)

            print(LAYERS)
            return layer, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def delete(cls, id):
        try:
            layer = next((l for l in LAYERS if l["id"] == id), None)
            if not layer:
                return {"error": "Layer not found"}, 404

            image_path = os.path.join(PUBLIC_LAYER_FOLDER , f"{id}.png")
            LAYERS.remove(layer)

            print(f"Deleting layer: {image_path}")
            if os.path.exists(image_path):
                os.remove(image_path)

            return {"message": "Layer deleted"}, 200
        except Exception as e:
            return cls.handle_error(e)


    @classmethod
    def fetch(cls):
        try:
            if GROUPS:
                cls.cleanup_groups()
            return LAYERS, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def update(cls, type, name, width, height, url, id, a, b, c, d, x, y, rotate, order, hidden, channel, opacity, blend_mode, color, mask):
        try:

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
            if url:
                layer["url"] = cls._bust_url(id)
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
            if channel:
                layer["channel"] = channel
                image_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{id}.png")
                if os.path.exists(image_path):
                    layer_img = Image.open(image_path).convert("RGBA")
                    layer_img = apply_channel(layer_img, channel)
                    layer_img.save(image_path, "PNG", quality=100)
                    layer["url"] = cls._bust_url(id)
            if type != 4:
                image_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{id}.png")
                if os.path.exists(image_path):
                    img = Image.open(image_path)
                    transformed_img, paste_x, paste_y = layer_transform(layer, img)
                    layer["thumbnail"] = generate_thumbnail_map(id, path=None, size=64, image=transformed_img)
                else:
                    print(f"[WARN] Thumbnail skipped – file not found for layer ID: {id}")
            layer["time"] = time('unix_ms')

            print(LAYERS)
            return layer, 200
        except Exception as e:
            return cls.handle_error(e)

    @staticmethod
    def validate_grouping(ids):
        groups = {
            l.get("group") for l in LAYERS
            if l["id"] in ids
        }

        groups.discard(None)

        # Mischung verboten
        if len(groups) > 1:
            return False, "Layers from different groups cannot be grouped"

        return True, groups.pop() if groups else None

    @staticmethod
    def cleanup_groups():
        # Entferne Gruppen ohne Mitglieder
        valid_group_ids = {
            l["group"] for l in LAYERS if l.get("type") != 4 and l.get("group")
        }

        # Entferne verwaiste Gruppen-Layer
        LAYERS[:] = [
            l for l in LAYERS
            if not (l["type"] == 4 and l["id"] not in valid_group_ids)
        ]

        # Entferne verwaiste GROUPS-Einträge
        GROUPS[:] = [g for g in GROUPS if g["id"] in valid_group_ids]

    @classmethod
    def reorder(cls):
        """
        Stellt sicher:
        - Gruppen liegen über ihren Mitgliedern
        - Mitglieder liegen direkt unter ihrer Gruppe
        - Andere Gruppen/Layers bleiben unberührt
        - Orders sind lückenlos 0..n
        """

        # 1. Aktuelle Reihenfolge nach order
        layers = sorted(LAYERS, key=lambda l: l["order"])

        # 2. Gruppenzuordnung (group_id -> Mitglieder)
        group_members = {}
        for l in layers:
            gid = l.get("group")
            if gid and l["type"] != 4:
                group_members.setdefault(gid, []).append(l)

        # 3. Mitglieder sortieren
        for gid in group_members:
            group_members[gid].sort(key=lambda l: l["order"])

        # 4. Neues Layer-Array bauen
        new_layers = []
        visited = set()

        def add_layer(layer):
            if layer["id"] in visited:
                return

            # Wenn es eine Gruppe ist:
            if layer["type"] == 4:
                gid = layer["id"]
                members = group_members.get(gid, [])

                # Mitglieder zuerst
                for m in members:
                    if m["id"] not in visited:
                        visited.add(m["id"])
                        new_layers.append(m)

                # dann die Gruppe (höchster Index!)
                visited.add(layer["id"])
                new_layers.append(layer)

            # Wenn es ein Mitglied ist, wird es durch die Gruppe behandelt
            elif layer.get("group") in group_members:
                return

            # normale Layer
            else:
                visited.add(layer["id"])
                new_layers.append(layer)

        # 5. Reihenfolge bauen
        for l in layers:
            add_layer(l)

        # 6. Order neu vergeben
        for i, l in enumerate(new_layers):
            l["order"] = i

        # 7. LAYERS ersetzen
        LAYERS[:] = new_layers



    @classmethod
    def group(cls, ids, group=None, reset=False):
        try:
            if isinstance(ids, str):
                ids = [ids]
            if not isinstance(ids, list):
                return {"error": "Invalid ID input"}, 400

            valid, parent_group = cls.validate_grouping(ids)
            if not valid:
                return {"error": "Invalid cross-group grouping"}, 400

            group_id = None if reset else group or str(uuid.uuid4())

            members = [
                l for l in LAYERS
                if l["id"] in ids
            ]

            if not members:
                return {"error": "No valid layers"}, 404

            # Setze group
            for m in members:
                m["group"] = group_id

            if reset:
                cls.cleanup_groups()
                cls.reorder()
                return {"message": "Group reset"}, 200

            # --- Mitglieder sortieren ---
            members.sort(key=lambda l: l["order"])

            # --- Ziel-Order ---
            max_order = max(l["order"] for l in members)

            # --- Bestehende Gruppe entfernen ---
            LAYERS[:] = [
                l for l in LAYERS
                if l["id"] != group_id
            ]

            # --- Block entfernen ---
            block = members[:]
            LAYERS[:] = [l for l in LAYERS if l not in block]

            # --- Insert Index bestimmen ---
            insert_index = next(
                (i for i, l in enumerate(LAYERS) if l["order"] > max_order),
                len(LAYERS)
            )

            # --- Gruppe erstellen ---
            group_layer = {
                "id": group_id,
                "type": 4,
                "name": group_id,
                "width": 0,
                "height": 0,
                "matrix": {
                    "a": 1, "b": 0, "c": 0, "d": 1, "x": 0, "y": 0, "rotate": 0,
                },
                "order": 0,
                "hidden": 1,
                "group": group_id,
                "groupName": group_id,
                "opacity": 1,
                "blend_mode": 0,
                "color": "#ffffff"
            }

            # --- Block einfügen ---
            for m in block:
                LAYERS.insert(insert_index, m)
                insert_index += 1

            LAYERS.insert(insert_index, group_layer)

            # --- Orders neu ---
            cls.reorder()

            # --- GROUPS aktualisieren ---
            GROUPS[:] = [g for g in GROUPS if g["id"] != group_id]
            GROUPS.append({"id": group_id, "order": group_layer["order"]})

            cls.cleanup_groups()

            return {"message": "Grouped successfully", "group": group_id}, 200

        except Exception as e:
            return cls.handle_error(e)


    @classmethod
    def addText(cls, type: int,order: int, name: str,hidden: int,opacity: float,color: str, font: str, fontFamily: str,fontSize: int,fontWeight: str,initFontSize: int,initHeight: int,initWidth: int,letterSpacing: float,lineHeight: float,text: str,textAlign: str,textDecoration: str,textTransform: str,width: int,height: int,x: int,y: int, mask: str):
        try:
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
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def addPath(cls, points, connections, stroke, strokeWidth, strokeDashArray, strokeDash,
                strokeDashType, fill, fillOpacity, gradient, closed, name):

        try:
            viewport_width = VIEWPORT_CONFIG[0]["width"],
            viewport_height = VIEWPORT_CONFIG[0]["height"]

            id = str(uuid.uuid4())

            # Berechne Bounding Box (x_min, y_min, width, height)
            min_x, min_y, width, height = get_svg_box(points)

            # Position setzen: Entweder zentriert oder exakt an min_x, min_y im Viewport
            matrix = {
                "a": 1,
                "b": 0,
                "c": 0,
                "d": 1,
                "x": int(min_x),
                "y": int(min_y),
                "rotate": 0,
            }

            layer = {
                "time": time('unix_ms'),
                "type": 2,
                "id": id,
                "name": name,
                "width": width,
                "height": height,
                "matrix": matrix,
                "order": len(LAYERS),
                "color": fill,
                "hidden": 0,
                "opacity": 1,
                "mask": '',
            }

            pId = str(uuid.uuid4())
            path = {
               "id": pId,
               "points": points,
               "connections": connections,
               "closed": closed,
               "gradient": gradient,
               "fill": fill,
               "fillOpacity": fillOpacity,
               "stroke": stroke,
               "strokeWidth": strokeWidth,
               "strokeDashType": strokeDashType,
               "strokeDash": strokeDash,
               "strokeDashArray": strokeDashArray
           }

            svg_string = generate_svg_map(path)

            # Datei speichern
            filename = f"{id}.svg"
            imgName = f"{id}.png"
            file_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, filename)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(svg_string)

            layer_img = render_svg(layer['id'])
            img_path = os.path.join(PUBLIC_LAYER_FOLDER, imgName)
            layer_img.save(img_path)

            # URL im Layer speichern
            layer["svg"] = cls._bust_url(filename, "svg")
            layer["url"] = cls._bust_url(imgName)
            layer["thumbnail"] = generate_thumbnail_map(id, path=img_path, size=64, image=None)


            LAYERS.append(layer)
            return layer, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def order(cls, id, order):
        try:
            order = int(order)

            # Index des gezogenen Layers finden
            index = next((i for i, l in enumerate(LAYERS) if l["id"] == id), None)
            if index is None:
                return {"error": f"Layer with id {id} not found."}, 404

            dragged_layer = LAYERS[index]

            # Wenn es ein Gruppenlayer ist, alle zugehörigen Layer finden
            if dragged_layer["type"] == 4:
                group_id = dragged_layer["id"]
                group_layers = [l for l in LAYERS if l.get("group") == group_id or l["id"] == group_id]

                # Alte Positionen entfernen
                LAYERS[:] = [l for l in LAYERS if l not in group_layers]

                # Neue Position einfügen
                for i, layer in enumerate(group_layers):
                    LAYERS.insert(order + i, layer)

                message = f"Group {group_id} with {len(group_layers)} layers moved to position {order}."
            else:
                # Einzelnes Layer bewegen
                moved_layer = LAYERS.pop(index)
                LAYERS.insert(order, moved_layer)
                message = f"Layer {id} moved to position {order}."

            # Neu ordnen
            for i, layer in enumerate(LAYERS):
                layer["order"] = i
                layer["time"] = time('unix_ms')

            return {"success": True, "message": message}, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def paste(cls, id):
        try:
            layer = next((l for l in LAYERS if l["id"] == id), None)
            if layer is None:
                return {"error": f"Layer with id '{id}' not found."}, 404

            # Originaldatei laden
            if layer["type"] == 0:
                img_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{id}.png")
                if not os.path.exists(img_path):
                    return {"error": "Original image file not found"}, 404
                img = Image.open(img_path).convert("RGBA")

            elif layer["type"] == 2:
                svg_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, f"{id}.svg")
                if not os.path.exists(svg_path):
                    return {"error": "Original SVG file not found"}, 404
                with open(svg_path, "r", encoding="utf-8") as f:
                    svg_string = f.read()

            # Layer kopieren (tiefe Kopie!)
            new_layer = copy.deepcopy(layer)
            new_id = str(uuid.uuid4())
            new_layer["id"] = new_id
            new_layer["time"] = time('unix_ms')

            # Datei speichern
            if layer["type"] == 0:
                new_img_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{new_id}.png")
                img.save(new_img_path)

            elif layer["type"] == 2:
                new_svg_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, f"{new_id}.svg")
                with open(new_svg_path, "w", encoding="utf-8") as f:
                    f.write(svg_string)

            # Am Ende einfügen
            LAYERS.append(new_layer)

            print(f"Pasted layer with new ID {new_id}")
            return new_layer, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def blend(cls, id, blend_mode, color):
        try:
            layer = next((l for l in LAYERS if l["id"] == id), None)
            if layer is None:
                return {"error": f"Layer with id '{id}' not found."}, 404

            # Viewport-Größe laden
            viewport_width = VIEWPORT_CONFIG[0]["width"]
            viewport_height = VIEWPORT_CONFIG[0]["height"]

            # Fixiertes Layer-Image (Transformationen übernommen & Matrix zurückgesetzt)
            img1 = cls.render(layer)  # apply_matrix = True
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
                img2 = cls.render(base_layer, apply_matrix=False)
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
            url_path = cls._bust_url(output_id)

            # Bild speichern
            blended_img.save(map_path)
            layer["time"] = time("unix_ms")
            layer["url"] = url_path

            return {
                "success": True,
                "message": f"Blend mode '{blend_mode}' applied with color {color}.",
                "url": url_path
            }, 200
        except Exception as e:
            return cls.handle_error(e)


    @classmethod
    def render(cls, layer, apply_matrix=True):
        try:
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
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def hide(cls, id, hidden):
        try:
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
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def mask(cls, id, id2):
        try:
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
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def masked(cls, id, id2):
        try:
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
        except Exception as e:
            return cls.handle_error(e)

    # ADD METHODS END
