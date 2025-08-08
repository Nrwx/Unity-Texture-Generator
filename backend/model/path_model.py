import os
import zipfile
import json
import uuid
from utils import time
from config.data.constant import PATHS
from generated.paths import (PUBLIC_TEMP_UPLOAD_FOLDER, PUBLIC_TEMP_RENDER_FOLDER, ASSETS_PATH_FOLDER, PUBLIC_PATH_FOLDER)
from components import render_svg, generate_svg_map, generate_thumbnail_map
from utils import time

class PathModel:

    @staticmethod
    def add(name=None, width=None, height=None, edit=None, id=None, stroke=None, strokeWidth=None, strokeDash=None, strokeDashType=None, strokeDashArray=None, fill=None, fillOpacity=None, points=None, connections=None, gradient=None, closed=None):
        new_id = id or str(uuid.uuid4())

        # ✅ Duplikatschutz basierend auf ID
        if any(p["id"] == new_id for p in PATHS):
            print(f"[INFO] Path with id {new_id} already exists. Skipping.")
            return {"error": "Path already exists."}, 409

        path = {
            "name": name,
            "id": new_id,
            "time": time("unix_ms"),
            "stroke": stroke if stroke is not None else "#000000",
            "strokeWidth": strokeWidth if strokeWidth is not None else 0,
            "strokeDash": strokeDash if strokeDash is not None else 0,
            "strokeDashType": strokeDashType if strokeDashType is not None else "",
            "strokeDashArray": strokeDashArray if strokeDashArray is not None else [],
            "fill": fill if fill is not None else "#ffffff",
            "fillOpacity": fillOpacity if fillOpacity is not None else 1.0,
            "points": points if points is not None else [],
            "connections": connections if connections is not None else [],
            "gradient": gradient if gradient is not None else {},
            "closed": closed if closed is not None else False,
            "width": width if width is not None else 0,
            "height": height if height is not None else 0,
            "edit": edit if edit is not None else True,
        }

        svg_string = generate_svg_map(path)

        filename = f"{new_id}.svg"
        file_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, filename)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(svg_string)

        image = render_svg(new_id)

        thumbnail = generate_thumbnail_map(
            new_id,
            path=None,
            size=64,
            image=image
        )
        path["thumbnail"] = thumbnail

        PATHS.append(path)
        return path, 200

    @staticmethod
    def update(**kwargs):
        path_id = kwargs.get("id")
        if not path_id:
            return {"error": "Missing path ID"}, 400

        path = next((p for p in PATHS if p["id"] == path_id), None)
        if not path:
            return {"error": "Path not found"}, 404

        for key in [
           "name", "stroke", "strokeWidth", "strokeDash", "strokeDashType", "strokeDashArray",
            "fill", "fillOpacity", "points", "connections", "gradient", "closed", "width", "height", "edit"
        ]:
            if key in kwargs:
                path[key] = kwargs[key]

        path["time"] = time("unix_ms")
        return path, 200

    @staticmethod
    def delete(id=None):
        if not id:
            return {"error": "Missing path ID"}, 400

        before = len(PATHS)
        PATHS[:] = [p for p in PATHS if p["id"] != id]
        after = len(PATHS)

        if before == after:
            return {"error": "Path not found"}, 404

        return {"success": True, "deleted": id}, 200

    @staticmethod
    def fetch(id=None):
        if not id:
            return PATHS, 200

        path = next((p for p in PATHS if p["id"] == id), None)
        if not path:
            return {"error": "Path not found"}, 404

        return path, 200

    @staticmethod
    def initialize():
        if not os.path.exists(ASSETS_PATH_FOLDER):
            print("[ERROR] ASSETS_PATH_FOLDER does not exist.")
            return [], 404

        shape_count = 0

        for file in os.listdir(ASSETS_PATH_FOLDER):
            if not file.endswith(".zip"):
                continue

            zip_path = os.path.join(ASSETS_PATH_FOLDER, file)
            folder_uuid = str(uuid.uuid4())
            file_uuid = str(uuid.uuid4())
            extract_dir = os.path.join(PUBLIC_PATH_FOLDER, folder_uuid)
            os.makedirs(extract_dir, exist_ok=True)

            try:
                with zipfile.ZipFile(zip_path, 'r') as archive:
                    json_files = [
                        f for f in archive.namelist()
                        if f.endswith(".json") and not f.endswith("/")
                    ]

                    shapes = []

                    for json_file in json_files:
                        with archive.open(json_file) as f:
                            shape_data = json.load(f)
                            entries = shape_data if isinstance(shape_data, list) else [shape_data]

                            for entry in entries:
                                shape_id = str(uuid.uuid4())

                                # 🧩 Wandle points um, falls vorhanden
                                if "points" in entry:
                                    entry["points"] = PathModel.convert(entry["points"])

                                shape = {
                                    **entry,
                                    "id": shape_id,
                                    "time": time("unix_ms"),
                                    "default": True
                                }

                                try:
                                    svg_string = generate_svg_map(entry)

                                    filename = f"{shape_id}.svg"
                                    file_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, filename)

                                    with open(file_path, "w", encoding="utf-8") as f:
                                        f.write(svg_string)

                                    image = render_svg(shape_id)

                                    thumbnail = generate_thumbnail_map(
                                        shape_id,
                                        path=None,
                                        size=64,
                                        image=image
                                    )
                                    shape["thumbnail"] = thumbnail
                                    shape["svg"] = f"/download/{filename}"
                                except Exception as img_err:
                                    print(f"[WARN] Failed to generate thumbnail for shape {shape_id}: {img_err}")

                                shapes.append(shape)
                                PATHS.append(shape)

                    if shapes:
                        out_path = os.path.join(extract_dir, f"{file_uuid}.json")
                        with open(out_path, "w") as f:
                            json.dump(shapes, f, indent=2)

                        print(f"[INFO] Imported {len(shapes)} shape(s) into {folder_uuid}/{file_uuid}.json")
                        shape_count += len(shapes)

            except Exception as e:
                print(f"[ERROR] Failed to process {file}: {e}")

        return {"imported": shape_count}, 200


    def convert(points):
        result = []
        for x, y in points:
            point = {
                "x": x,
                "y": y,
                "selected": False,
                "linear": True,
                "bezier": None,
                "pulseAt": None,
                "anchor": {
                    "start": {"x": x, "y": y},
                    "end": {"x": x, "y": y},
                    "neighbors": {}
                }
            }
            result.append(point)
        return result