import os
import uuid
import zipfile
import json
from model.base.main import BaseModel
from utils import time
from config.data.constant import PATHS
from generated.paths import PUBLIC_TEMP_UPLOAD_FOLDER, PUBLIC_PATH_FOLDER, ASSETS_PATH_FOLDER
from components import render_svg, generate_svg_map, generate_thumbnail_map

class PathModel(BaseModel):

    @classmethod
    def initialize(cls):
        try:
            cls._copy_standard_assets()
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def fetch(cls, id=None):
        try:
            if id:
                path = next((p for p in PATHS if p["id"] == id), None)
                if not path:
                    return {"error": "Path not found"}, 404
                return path
            else:
                return PATHS
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def add(cls, **kwargs):
        try:
            new_id = kwargs.get("id") or str(uuid.uuid4())
            if any(p["id"] == new_id for p in PATHS):
                return {"error": "Path already exists."}, 409

            path = {
                "id": new_id,
                "name": kwargs.get("name"),
                "time": time("unix_ms"),
                "stroke": kwargs.get("stroke", "#000000"),
                "strokeWidth": kwargs.get("strokeWidth", 0),
                "strokeDash": kwargs.get("strokeDash", 0),
                "strokeDashType": kwargs.get("strokeDashType", ""),
                "strokeDashArray": kwargs.get("strokeDashArray", []),
                "fill": kwargs.get("fill", "#ffffff"),
                "fillOpacity": kwargs.get("fillOpacity", 1),
                "points": kwargs.get("points", []),
                "connections": kwargs.get("connections", []),
                "gradient": kwargs.get("gradient", {}),
                "closed": kwargs.get("closed", False),
                "width": kwargs.get("width", 0),
                "height": kwargs.get("height", 0),
                "edit": kwargs.get("edit", True)
            }

            svg_string = generate_svg_map(path)
            filename = f"{new_id}.svg"
            file_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, filename)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(svg_string)

            image = render_svg(new_id)
            path["thumbnail"] = generate_thumbnail_map(new_id, path=None, size=64, image=image)
            PATHS.append(path)
            return path, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def update(cls, **kwargs):
        try:
            path_id = kwargs.get("id")
            if not path_id:
                return {"error": "Missing path ID"}, 400

            path = next((p for p in PATHS if p["id"] == path_id), None)
            if not path:
                return {"error": "Path not found"}, 404

            for key in ["name", "stroke", "strokeWidth", "strokeDash", "strokeDashType",
                        "strokeDashArray", "fill", "fillOpacity", "points", "connections",
                        "gradient", "closed", "width", "height", "edit"]:
                if key in kwargs:
                    path[key] = kwargs[key]

            path["time"] = time("unix_ms")
            return path, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def delete(cls, id=None):
        try:
            if not id:
                return {"error": "Missing path ID"}, 400
            before = len(PATHS)
            PATHS[:] = [p for p in PATHS if p["id"] != id]
            if len(PATHS) == before:
                return {"error": "Path not found"}, 404
            return {"success": True, "deleted": id}, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def _copy_standard_assets(cls):
        try:
            if not os.path.exists(ASSETS_PATH_FOLDER):
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
                        json_files = [f for f in archive.namelist() if f.endswith(".json") and not f.endswith("/")]
                        shapes = []
                        for json_file in json_files:
                            with archive.open(json_file) as f:
                                shape_data = json.load(f)
                                entries = shape_data if isinstance(shape_data, list) else [shape_data]
                                for entry in entries:
                                    shape_id = str(uuid.uuid4())
                                    if "points" in entry:
                                        entry["points"] = cls._convert(entry["points"])
                                    shape = {**entry, "id": shape_id, "time": time("unix_ms"), "default": True}
                                    try:
                                        svg_string = generate_svg_map(entry)
                                        filename = f"{shape_id}.svg"
                                        file_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, filename)
                                        with open(file_path, "w", encoding="utf-8") as f:
                                            f.write(svg_string)
                                        image = render_svg(shape_id)
                                        shape["thumbnail"] = generate_thumbnail_map(shape_id, path=None, size=64, image=image)
                                        shape["svg"] = f"/download/{filename}"
                                    except Exception as img_err:
                                        print(f"[WARN] Failed thumbnail for shape {shape_id}: {img_err}")
                                    shapes.append(shape)
                                    PATHS.append(shape)
                        if shapes:
                            out_path = os.path.join(extract_dir, f"{file_uuid}.json")
                            with open(out_path, "w") as f:
                                json.dump(shapes, f, indent=2)
                            shape_count += len(shapes)
                except Exception as e:
                    print(f"[ERROR] Failed to process {file}: {e}")
            return {"imported": shape_count}, 200
        except Exception as e:
            return cls.handle_error(e)

    @staticmethod
    def _convert(points):
        return [
            {
                "x": x,
                "y": y,
                "selected": False,
                "linear": True,
                "bezier": None,
                "pulseAt": None,
                "anchor": {"start": {"x": x, "y": y}, "end": {"x": x, "y": y}, "neighbors": {}}
            }
            for x, y in points
        ]