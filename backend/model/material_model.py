import os
import json
import uuid
import shutil

from config.data.constant import LAYERS
from model.base.main import BaseModel
from model.layer_model import LayerModel
from generated.paths import PUBLIC_LAYER_FOLDER, PUBLIC_MATERIAL_FOLDER
from utils import time


SURFACE_DEFAULTS = {
    "baseColor": [1.0, 1.0, 1.0, 1.0],
    "subsurface": 0.0,
    "subsurfaceRadius": [1.0, 0.2, 0.1],
    "subsurfaceColor": [1.0, 1.0, 1.0, 1.0],

    "metallic": 0.0,
    "specular": 0.5,
    "specularTint": 0.0,
    "roughness": 0.4,

    "anisotropic": 0.0,
    "anisotropicRotation": 0.0,

    "sheen": 0.0,
    "sheenTint": 0.5,

    "clearcoat": 0.0,
    "clearcoatRoughness": 0.03,

    "ior": 1.45,
    "transmission": 0.0,
    "transmissionRoughness": 0.0,

    "emission": [0.0, 0.0, 0.0, 1.0],
    "emissionStrength": 0.0,

    "alpha": 1.0,

    "normal": 0.0,
    "clearcoatNormal": 0.0,
    "tangent": 0.0,

    "bumpStrength": 0.0,
    "displacementStrength": 0.0,
}


SURFACE_RANGES = {
    "subsurface": (0.0, 1.0),
    "metallic": (0.0, 1.0),
    "specular": (0.0, 1.0),
    "specularTint": (0.0, 1.0),
    "roughness": (0.0, 1.0),
    "anisotropic": (0.0, 1.0),
    "anisotropicRotation": (0.0, 1.0),
    "sheen": (0.0, 1.0),
    "sheenTint": (0.0, 1.0),
    "clearcoat": (0.0, 1.0),
    "clearcoatRoughness": (0.0, 1.0),
    "ior": (1.0, 3.0),
    "transmission": (0.0, 1.0),
    "transmissionRoughness": (0.0, 1.0),
    "emissionStrength": (0.0, 20.0),
    "alpha": (0.0, 1.0),
    "normal": (0.0, 1.0),
    "clearcoatNormal": (0.0, 1.0),
    "tangent": (0.0, 1.0),
    "bumpStrength": (0.0, 1.0),
    "displacementStrength": (0.0, 1.0),
}


SURFACE_SLOT_KEYS = list(SURFACE_DEFAULTS.keys())
CUBE_FACE_NAMES = ["front", "back", "left", "right", "top", "bottom"]

ALLOWED_NODE_TYPES = {
    "output",
    "principled",
    "bitmap",
    "value",
    "uv-map",
    "filter",
    "modifier",
    "falloff",
    "blend",
    "math",
    "preview",
    "multitexture",
}

SOURCE_TYPES = {
    "none",
    "single",
    "multitexture",
    "shader",
}

GEOMETRY_DEFAULTS = {
    "primitive": "cube",

    "width": 1.0,
    "height": 1.0,
    "depth": 1.0,

    "bevel": 0.0,
    "bevel_segments": 1,

    "subdivision": 0,
    "shade_smooth": True,

    "displacement_enabled": False,
    "displacement_strength": 0.0,
    "displacement_midlevel": 0.5,

    "normal_strength": 1.0,
    "bump_strength": 0.0,

    "uv_fit": "stretch",
    "uv_density": 1.0,

    "pivot_x": 0.0,
    "pivot_y": 0.0,
    "pivot_z": 0.0,

    "rotation_x": 0.0,
    "rotation_y": 0.0,
    "rotation_z": 0.0,

    "scale_x": 1.0,
    "scale_y": 1.0,
    "scale_z": 1.0,
}

GEOMETRY_RANGES = {
    "width": (0.001, 100.0),
    "height": (0.001, 100.0),
    "depth": (0.001, 100.0),

    "bevel": (0.0, 5.0),
    "bevel_segments": (1, 64),
    "subdivision": (0, 12),

    "displacement_strength": (0.0, 10.0),
    "displacement_midlevel": (0.0, 1.0),

    "normal_strength": (0.0, 10.0),
    "bump_strength": (0.0, 10.0),

    "uv_density": (0.001, 100.0),

    "pivot_x": (-100.0, 100.0),
    "pivot_y": (-100.0, 100.0),
    "pivot_z": (-100.0, 100.0),

    "rotation_x": (-360.0, 360.0),
    "rotation_y": (-360.0, 360.0),
    "rotation_z": (-360.0, 360.0),

    "scale_x": (0.001, 100.0),
    "scale_y": (0.001, 100.0),
    "scale_z": (0.001, 100.0),
}

ALLOWED_PRIMITIVES = {"cube", "box", "plane", "sphere", "cylinder"}
ALLOWED_UV_FITS = {"stretch", "contain", "cover", "tile", "world"}


def json_loads(value, fallback):
    if value is None or value == "":
        return fallback

    if isinstance(value, (dict, list)):
        return value

    try:
        return json.loads(value)
    except Exception:
        return fallback


class MaterialModel(BaseModel):
    CONTRACT_VERSION = 4
    MATERIAL_LAYER_TYPE = 5
    RENDERER = "canvas-cube"
    ENGINE = "material"

    @classmethod
    def ensure_dirs(cls):
        os.makedirs(PUBLIC_MATERIAL_FOLDER, exist_ok=True)

    @classmethod
    def material_folder(cls, material_id):
        cls.ensure_dirs()
        folder = os.path.join(PUBLIC_MATERIAL_FOLDER, str(material_id))
        os.makedirs(folder, exist_ok=True)
        return folder

    @staticmethod
    def clamp(value, min_value, max_value):
        try:
            value = float(value)
        except Exception:
            value = min_value

        return max(min_value, min(max_value, value))

    @staticmethod
    def safe_bool(value):
        if isinstance(value, bool):
            return value

        if isinstance(value, str):
            return value.lower() in ("1", "true", "yes", "on")

        return bool(value)

    @staticmethod
    def safe_float(value, fallback=0.0):
        try:
            return float(value)
        except Exception:
            return fallback

    @staticmethod
    def hex_to_rgba(hex_color, alpha=1.0):
        value = str(hex_color or "#ffffff").strip().lstrip("#")

        if len(value) == 3:
            value = "".join([char * 2 for char in value])

        if len(value) != 6:
            value = "ffffff"

        r = int(value[0:2], 16) / 255.0
        g = int(value[2:4], 16) / 255.0
        b = int(value[4:6], 16) / 255.0
        a = MaterialModel.clamp(alpha, 0.0, 1.0)

        return [
            round(r, 6),
            round(g, 6),
            round(b, 6),
            round(a, 6),
        ]

    @classmethod
    def find_layer(cls, layer_id):
        return next(
            (layer for layer in LAYERS if layer.get("id") == layer_id),
            None,
        )

    @classmethod
    def resolve_source_layer_size(cls, source_layer, cube_size):
        width = int(source_layer.get("width") or cube_size or 256)
        height = int(source_layer.get("height") or cube_size or 256)

        return max(width, 1), max(height, 1)

    @classmethod
    def resolve_source_path(cls, source_layer_id):
        path = os.path.join(PUBLIC_LAYER_FOLDER, f"{source_layer_id}.png")
        return path if os.path.exists(path) else ""

    @classmethod
    def resolve_layer_bitmap(cls, layer_id="", fallback_url=""):
        layer = cls.find_layer(layer_id)

        if not layer:
            return fallback_url or ""

        return (
            layer.get("masked")
            or layer.get("texture", {}).get("url")
            or layer.get("url")
            or layer.get("svg")
            or fallback_url
            or ""
        )

    @classmethod
    def normalize_texture_url(cls, url):
        return str(url or "").strip()

    @classmethod
    def is_download_url(cls, url):
        return isinstance(url, str) and url.startswith("/download/")

    @classmethod
    def public_download_url_to_path(cls, url):
        if not isinstance(url, str):
            return ""

        clean_url = url.split("?")[0].strip()

        if clean_url.startswith("/material/texture/"):
            relative_path = clean_url[len("/material/texture/"):].lstrip("/")
            return os.path.join(PUBLIC_MATERIAL_FOLDER, relative_path)

        if clean_url.startswith("/material/package/"):
            relative_path = clean_url[len("/material/package/"):].lstrip("/")
            return os.path.join(PUBLIC_MATERIAL_FOLDER, relative_path)

        if clean_url.startswith("/download/materials/"):
            relative_path = clean_url[len("/download/materials/"):].lstrip("/")
            return os.path.join(PUBLIC_MATERIAL_FOLDER, relative_path)

        if clean_url.startswith("/download/"):
            relative_path = clean_url[len("/download/"):].lstrip("/")

            if "/" not in relative_path and "\\" not in relative_path:
                return os.path.join(PUBLIC_LAYER_FOLDER, relative_path)

            return os.path.join(PUBLIC_MATERIAL_FOLDER, relative_path)

        return ""

    @classmethod
    def make_material_url(cls, material_id, filename):
        return f"/material/texture/{material_id}/{filename}?ts={time('unix_ms')}"

    @classmethod
    def make_material_package_url(cls, material_id, filename):
        return f"/material/package/{material_id}/{filename}?ts={time('unix_ms')}"

    @classmethod
    def resolve_bitmap_payload(cls, bitmap):
        if not isinstance(bitmap, dict):
            bitmap = {}

        layer_id = str(bitmap.get("layer_id", "") or "")
        url = cls.normalize_texture_url(bitmap.get("url", ""))

        if layer_id and not url:
            url = cls.resolve_layer_bitmap(layer_id)

        return {
            "layer_id": layer_id,
            "url": url,
            "name": str(bitmap.get("name", "") or layer_id or ""),
            "width": int(float(bitmap.get("width", 0) or 0)),
            "height": int(float(bitmap.get("height", 0) or 0)),
            "filename": str(bitmap.get("filename", "") or ""),
            "cached": cls.safe_bool(bitmap.get("cached", False)),
            "channel": str(bitmap.get("channel", "rgba") or "rgba"),
        }

    @classmethod
    def copy_source_texture(
        cls,
        material_id,
        source_layer_id="",
        texture_url="",
        suffix="base_color",
    ):
        cls.ensure_dirs()

        texture_url = cls.normalize_texture_url(texture_url)
        source_path = ""

        if texture_url and cls.is_download_url(texture_url):
            possible_path = cls.public_download_url_to_path(texture_url)

            if possible_path and os.path.exists(possible_path):
                source_path = possible_path

        if not source_path and source_layer_id:
            possible_path = os.path.join(
                PUBLIC_LAYER_FOLDER,
                f"{source_layer_id}.png",
            )

            if os.path.exists(possible_path):
                source_path = possible_path

        if not source_path:
            resolved = texture_url or cls.resolve_layer_bitmap(source_layer_id)

            return {
                "url": resolved,
                "filename": "",
                "cached": False,
                "missing": not bool(resolved),
                "path": "",
            }

        filename = f"{suffix}.png"
        target_folder = cls.material_folder(material_id)
        target_path = os.path.join(target_folder, filename)

        os.makedirs(target_folder, exist_ok=True)

        if os.path.abspath(source_path) != os.path.abspath(target_path):
            shutil.copy2(source_path, target_path)

        if not os.path.exists(target_path):
            return {
                "url": texture_url or cls.resolve_layer_bitmap(source_layer_id),
                "filename": "",
                "cached": False,
                "missing": True,
                "path": target_path,
            }

        return {
            "url": cls.make_material_url(material_id, filename),
            "filename": filename,
            "cached": True,
            "missing": False,
            "path": target_path,
        }

    @classmethod
    def cache_bitmap_payload(cls, material_id, bitmap, suffix):
        payload = cls.resolve_bitmap_payload(bitmap)

        if not payload.get("url") and not payload.get("layer_id"):
            return payload

        cached = cls.copy_source_texture(
            material_id=material_id,
            source_layer_id=payload.get("layer_id", ""),
            texture_url=payload.get("url", ""),
            suffix=suffix,
        )

        if cached.get("url"):
            payload["url"] = cached["url"]

        payload["filename"] = cached.get("filename", "")
        payload["cached"] = cached.get("cached", False)
        payload["missing"] = cached.get("missing", False)
        payload["path"] = cached.get("path", "")

        return payload

    @classmethod
    def get_mapped_uv_faces(cls, uv):
        faces = uv.get("faces", {}) if isinstance(uv, dict) else {}

        return [
            face
            for face in CUBE_FACE_NAMES
            if cls.normalize_texture_url(
                faces.get(face, {}).get("bitmap", {}).get("url", "")
            )
        ]

    @classmethod
    def get_uv_texture_groups(cls, uv):
        faces = uv.get("faces", {}) if isinstance(uv, dict) else {}
        groups = {}

        for face in CUBE_FACE_NAMES:
            face_data = faces.get(face, {})

            if not isinstance(face_data, dict):
                continue

            bitmap = cls.resolve_bitmap_payload(face_data.get("bitmap", {}))
            url = cls.normalize_texture_url(bitmap.get("url", ""))

            if not url:
                continue

            if url not in groups:
                groups[url] = {
                    "url": url,
                    "name": bitmap.get("name") or bitmap.get("layer_id") or "Texture",
                    "layer_id": bitmap.get("layer_id", ""),
                    "filename": bitmap.get("filename", ""),
                    "cached": bitmap.get("cached", False),
                    "channel": bitmap.get("channel", "rgba"),
                    "bitmap": bitmap,
                    "faces": [],
                }

            groups[url]["faces"].append(face)

        return list(groups.values())

    @classmethod
    def get_uv_texture_mode(cls, uv):
        groups = cls.get_uv_texture_groups(uv)

        if not groups:
            return "none"

        return "multitexture" if len(groups) > 1 else "single"

    @classmethod
    def get_uv_target_slots(cls, uv, bitmap_maps=None):
        data = uv if isinstance(uv, dict) else {}
        target_slots = data.get("target_slots", [])

        if not isinstance(target_slots, list):
            target_slots = []

        target_slots = [
            slot_key
            for slot_key in target_slots
            if slot_key in SURFACE_SLOT_KEYS
        ]

        if target_slots:
            return target_slots

        target_slot = data.get("target_slot") or "baseColor"

        if target_slot in SURFACE_SLOT_KEYS:
            return [target_slot]

        if isinstance(bitmap_maps, dict):
            inferred = [
                slot_key
                for slot_key, slot in bitmap_maps.items()
                if (
                    slot_key in SURFACE_SLOT_KEYS
                    and isinstance(slot, dict)
                    and slot.get("uv_node_id") == "uv-cubemap-layout"
                )
            ]

            if inferred:
                return inferred

        return ["baseColor"]

    @classmethod
    def normalize_surface(cls, surface):
        data = json_loads(surface, {})
        normalized = dict(SURFACE_DEFAULTS)

        if not isinstance(data, dict):
            return normalized

        for key, value in data.items():
            if key not in normalized:
                continue

            if key in SURFACE_RANGES:
                min_value, max_value = SURFACE_RANGES[key]
                normalized[key] = cls.clamp(value, min_value, max_value)
                continue

            if isinstance(normalized[key], list):
                if isinstance(value, str) and value.startswith("#"):
                    alpha = normalized[key][3] if len(normalized[key]) > 3 else 1.0
                    normalized[key] = cls.hex_to_rgba(value, alpha)
                elif isinstance(value, list):
                    normalized[key] = value
                continue

            normalized[key] = value

        return normalized

    @classmethod
    def default_bitmap_slot(cls):
        return {
            "enabled": False,
            "source_type": "none",

            "layer_id": "",
            "url": "",
            "name": "",

            "node_id": "",
            "uv_node_id": "",

            "faces": {},
            "mapped_faces": [],
            "texture_groups": [],

            "filename": "",
            "cached": False,
            "missing": False,

            "channel": "rgba",
            "strength": 1.0,
            "offset": 0.0,
            "invert": False,
            "blend": "replace",
        }

    @classmethod
    def normalize_bitmap_maps(cls, bitmap_maps):
        data = json_loads(bitmap_maps, {})
        normalized = {}

        if not isinstance(data, dict):
            data = {}

        for key in SURFACE_SLOT_KEYS:
            incoming = data.get(key, {})
            slot = cls.default_bitmap_slot()

            if isinstance(incoming, dict):
                source_type = str(incoming.get("source_type", "none") or "none")

                if source_type not in SOURCE_TYPES:
                    source_type = "none"

                faces = incoming.get("faces", {})
                mapped_faces = incoming.get("mapped_faces", [])
                texture_groups = incoming.get("texture_groups", [])

                if not isinstance(faces, dict):
                    faces = {}

                if not isinstance(mapped_faces, list):
                    mapped_faces = []

                if not isinstance(texture_groups, list):
                    texture_groups = []

                slot.update({
                    "enabled": cls.safe_bool(incoming.get("enabled", False)),
                    "source_type": source_type,

                    "layer_id": str(incoming.get("layer_id", "") or ""),
                    "url": cls.normalize_texture_url(incoming.get("url", "")),
                    "name": str(incoming.get("name", "") or ""),

                    "node_id": str(incoming.get("node_id", "") or ""),
                    "uv_node_id": str(incoming.get("uv_node_id", "") or ""),

                    "faces": faces,
                    "mapped_faces": [
                        face for face in mapped_faces if face in CUBE_FACE_NAMES
                    ],
                    "texture_groups": texture_groups,

                    "filename": str(incoming.get("filename", "") or ""),
                    "cached": cls.safe_bool(incoming.get("cached", False)),
                    "missing": cls.safe_bool(incoming.get("missing", False)),

                    "channel": str(incoming.get("channel", "rgba") or "rgba"),
                    "strength": cls.clamp(incoming.get("strength", 1.0), 0.0, 2.0),
                    "offset": cls.clamp(incoming.get("offset", 0.0), -1.0, 1.0),
                    "invert": cls.safe_bool(incoming.get("invert", False)),
                    "blend": str(incoming.get("blend", "replace") or "replace"),
                })

                if slot["layer_id"] and not slot["url"]:
                    slot["url"] = cls.resolve_layer_bitmap(slot["layer_id"])

                if slot["source_type"] == "single":
                    slot["enabled"] = bool(slot["url"] or slot["node_id"])

                elif slot["source_type"] == "multitexture":
                    cleaned_groups = []

                    for group in slot["texture_groups"]:
                        if not isinstance(group, dict):
                            continue

                        url = cls.normalize_texture_url(group.get("url", ""))

                        if not url:
                            continue

                        cleaned_groups.append({
                            "url": url,
                            "name": str(group.get("name", "") or group.get("layer_id", "") or "Texture"),
                            "layer_id": str(group.get("layer_id", "") or ""),
                            "filename": str(group.get("filename", "") or ""),
                            "cached": cls.safe_bool(group.get("cached", False)),
                            "missing": cls.safe_bool(group.get("missing", False)),
                            "channel": str(group.get("channel", slot["channel"]) or slot["channel"]),
                            "faces": [
                                face for face in group.get("faces", [])
                                if face in CUBE_FACE_NAMES
                            ],
                        })

                    slot["texture_groups"] = cleaned_groups
                    slot["enabled"] = len(cleaned_groups) > 0

                    if not cleaned_groups:
                        slot["source_type"] = "none"

                elif slot["source_type"] == "shader":
                    slot["enabled"] = bool(slot["node_id"])

                else:
                    slot["enabled"] = False

            normalized[key] = slot

        return normalized

    @classmethod
    def default_uv_face(cls, face):
        defaults = {
            "top": (0.25, 0.0),
            "left": (0.0, 1.0 / 3.0),
            "front": (0.25, 1.0 / 3.0),
            "right": (0.5, 1.0 / 3.0),
            "back": (0.75, 1.0 / 3.0),
            "bottom": (0.25, 2.0 / 3.0),
        }

        x, y = defaults.get(face, (0.25, 1.0 / 3.0))

        return {
            "face": face,
            "enabled": True,

            "x": x,
            "y": y,
            "width": 0.25,
            "height": 1.0 / 3.0,

            "translate_x": 0.0,
            "translate_y": 0.0,
            "scale_x": 1.0,
            "scale_y": 1.0,
            "rotate": 0.0,
            "flip_x": False,
            "flip_y": False,

            "bitmap": {
                "layer_id": "",
                "url": "",
                "name": "",
                "width": 0,
                "height": 0,
                "filename": "",
                "cached": False,
                "missing": False,
                "channel": "rgba",
            },
        }

    @classmethod
    def normalize_uv(cls, uv):
        data = json_loads(uv, {})

        if not isinstance(data, dict):
            data = {}

        input_faces = data.get("faces", {})
        faces = {}

        if not isinstance(input_faces, dict):
            input_faces = {}

        for face in CUBE_FACE_NAMES:
            item = cls.default_uv_face(face)
            incoming = input_faces.get(face, {})

            if isinstance(incoming, dict):
                item.update({
                    "enabled": cls.safe_bool(incoming.get("enabled", True)),
                    "x": cls.clamp(incoming.get("x", item["x"]), 0.0, 1.0),
                    "y": cls.clamp(incoming.get("y", item["y"]), 0.0, 1.0),
                    "width": cls.clamp(incoming.get("width", item["width"]), 0.001, 1.0),
                    "height": cls.clamp(incoming.get("height", item["height"]), 0.001, 1.0),
                    "translate_x": cls.clamp(incoming.get("translate_x", 0.0), -2.0, 2.0),
                    "translate_y": cls.clamp(incoming.get("translate_y", 0.0), -2.0, 2.0),
                    "scale_x": cls.clamp(incoming.get("scale_x", 1.0), 0.01, 10.0),
                    "scale_y": cls.clamp(incoming.get("scale_y", 1.0), 0.01, 10.0),
                    "rotate": cls.clamp(incoming.get("rotate", 0.0), -360.0, 360.0),
                    "flip_x": cls.safe_bool(incoming.get("flip_x", False)),
                    "flip_y": cls.safe_bool(incoming.get("flip_y", False)),
                    "bitmap": cls.resolve_bitmap_payload(incoming.get("bitmap", {})),
                })

            faces[face] = item

        selected_faces = data.get("selected_faces", ["front"])

        if not isinstance(selected_faces, list):
            selected_faces = ["front"]

        selected_faces = [
            face for face in selected_faces
            if face in CUBE_FACE_NAMES
        ] or ["front"]

        active_face = data.get("active_face", "front")

        if active_face not in CUBE_FACE_NAMES:
            active_face = "front"

        target_slot = data.get("target_slot", "baseColor")

        if target_slot not in SURFACE_SLOT_KEYS:
            target_slot = "baseColor"

        target_slots = data.get("target_slots", [target_slot])

        if not isinstance(target_slots, list):
            target_slots = [target_slot]

        target_slots = [
            slot_key
            for slot_key in target_slots
            if slot_key in SURFACE_SLOT_KEYS
        ] or [target_slot]

        return {
            "mode": data.get("mode", "cubemap"),
            "view_mode": data.get("view_mode", "cubemap"),
            "active_face": active_face,
            "selected_faces": selected_faces,
            "atlas": data.get("atlas", "cross"),
            "target_slot": target_slots[0],
            "target_slots": target_slots,
            "faces": faces,
        }

    @classmethod
    def normalize_geometry(cls, geometry):
        data = json_loads(geometry, {})
        normalized = dict(GEOMETRY_DEFAULTS)

        if not isinstance(data, dict):
            return normalized

        primitive = str(data.get("primitive", normalized["primitive"]) or normalized["primitive"])
        uv_fit = str(data.get("uv_fit", normalized["uv_fit"]) or normalized["uv_fit"])

        normalized["primitive"] = primitive if primitive in ALLOWED_PRIMITIVES else "cube"
        normalized["uv_fit"] = uv_fit if uv_fit in ALLOWED_UV_FITS else "stretch"

        for key, value in data.items():
            if key not in normalized:
                continue

            if key in {"primitive", "uv_fit"}:
                continue

            if key in {"shade_smooth", "displacement_enabled"}:
                normalized[key] = cls.safe_bool(value)
                continue

            if key in GEOMETRY_RANGES:
                min_value, max_value = GEOMETRY_RANGES[key]
                number = cls.clamp(value, min_value, max_value)

                if key in {"bevel_segments", "subdivision"}:
                    number = int(round(number))

                normalized[key] = number
                continue

            normalized[key] = value

        return normalized

    @classmethod
    def cache_uv_textures(cls, material_id, uv):
        if not isinstance(uv, dict):
            return uv

        faces = uv.get("faces", {})

        if not isinstance(faces, dict):
            return uv

        url_cache = {}

        for face in CUBE_FACE_NAMES:
            face_data = faces.get(face)

            if not isinstance(face_data, dict):
                continue

            bitmap = face_data.get("bitmap", {})

            if not isinstance(bitmap, dict):
                continue

            original_url = cls.normalize_texture_url(bitmap.get("url", ""))
            layer_id = str(bitmap.get("layer_id", "") or "")
            cache_key = original_url or layer_id

            if not cache_key:
                continue

            if cache_key not in url_cache:
                url_cache[cache_key] = cls.cache_bitmap_payload(
                    material_id=material_id,
                    bitmap=bitmap,
                    suffix=f"uv_{face}",
                )

            face_data["bitmap"] = {
                **bitmap,
                **url_cache[cache_key],
            }

        return uv

    @classmethod
    def refresh_uv_texture_slot(cls, bitmap_maps, uv, slot_key):
        if slot_key not in SURFACE_SLOT_KEYS:
            return bitmap_maps

        mapped_faces = cls.get_mapped_uv_faces(uv)
        texture_groups = cls.get_uv_texture_groups(uv)
        texture_mode = cls.get_uv_texture_mode(uv)
        slot = bitmap_maps.get(slot_key, cls.default_bitmap_slot())

        if not mapped_faces or texture_mode == "none":
            if slot.get("uv_node_id") == "uv-cubemap-layout":
                preserved = cls.default_bitmap_slot()
                preserved.update({
                    "offset": slot.get("offset", 0.0),
                    "strength": slot.get("strength", 1.0),
                    "channel": slot.get("channel", "rgba"),
                    "invert": slot.get("invert", False),
                    "blend": slot.get("blend", "replace"),
                })
                bitmap_maps[slot_key] = preserved
            else:
                bitmap_maps[slot_key] = slot

            return bitmap_maps

        if texture_mode == "single":
            group = texture_groups[0]
            bitmap = group.get("bitmap", {})

            slot.update({
                "enabled": True,
                "source_type": "single",

                "layer_id": group.get("layer_id", ""),
                "url": group.get("url", ""),
                "filename": group.get("filename", ""),
                "cached": group.get("cached", False),
                "missing": group.get("missing", False),
                "name": bitmap.get("name", "") or group.get("name", "") or f"{slot_key} SingleTexture",

                "node_id": "uv-cubemap-single-bitmap",
                "uv_node_id": "uv-cubemap-layout",

                "faces": uv.get("faces", {}),
                "mapped_faces": mapped_faces,
                "texture_groups": [{
                    "url": group.get("url", ""),
                    "name": group.get("name", "Texture"),
                    "layer_id": group.get("layer_id", ""),
                    "filename": group.get("filename", ""),
                    "cached": group.get("cached", False),
                    "missing": group.get("missing", False),
                    "channel": group.get("channel", slot.get("channel", "rgba")),
                    "faces": group.get("faces", []),
                }],

                "channel": bitmap.get("channel", slot.get("channel", "rgba")),
                "strength": slot.get("strength", 1.0),
                "offset": slot.get("offset", 0.0),
                "invert": slot.get("invert", False),
                "blend": slot.get("blend", "replace"),
            })

            bitmap_maps[slot_key] = slot
            return bitmap_maps

        slot.update({
            "enabled": True,
            "source_type": "multitexture",

            "layer_id": "",
            "url": "",
            "filename": "",
            "cached": False,
            "missing": False,
            "name": f"{slot_key} MultiTexture ({len(texture_groups)} textures / {len(mapped_faces)} faces)",

            "node_id": "uv-cubemap-multitexture",
            "uv_node_id": "uv-cubemap-layout",

            "faces": uv.get("faces", {}),
            "mapped_faces": mapped_faces,
            "texture_groups": [
                {
                    "url": group.get("url", ""),
                    "name": group.get("name", "Texture"),
                    "layer_id": group.get("layer_id", ""),
                    "filename": group.get("filename", ""),
                    "cached": group.get("cached", False),
                    "missing": group.get("missing", False),
                    "channel": group.get("channel", slot.get("channel", "rgba")),
                    "faces": group.get("faces", []),
                }
                for group in texture_groups
            ],

            "channel": slot.get("channel", "rgba"),
            "strength": slot.get("strength", 1.0),
            "offset": slot.get("offset", 0.0),
            "invert": slot.get("invert", False),
            "blend": slot.get("blend", "replace"),
        })

        bitmap_maps[slot_key] = slot
        return bitmap_maps

    @classmethod
    def refresh_all_uv_texture_slots(cls, bitmap_maps, uv):
        for slot_key in cls.get_uv_target_slots(uv, bitmap_maps):
            bitmap_maps = cls.refresh_uv_texture_slot(bitmap_maps, uv, slot_key)

        return bitmap_maps

    @classmethod
    def create_output_node(cls):
        return {
            "id": "material-output",
            "type": "output",
            "label": "Material Output",
            "locked": True,
            "position": {"x": 760, "y": 220},
            "inputs": {
                "surface": {"type": "shader"},
            },
            "outputs": {},
            "settings": {},
        }

    @classmethod
    def create_principled_node(cls):
        return {
            "id": "principled-bsdf",
            "type": "principled",
            "label": "Principled BSDF",
            "locked": False,
            "position": {"x": 520, "y": 160},
            "inputs": {
                key: {
                    "type": "color" if isinstance(SURFACE_DEFAULTS.get(key), list) else "float"
                }
                for key in SURFACE_SLOT_KEYS
            },
            "outputs": {
                "bsdf": {"type": "shader"},
            },
            "settings": {
                "source": "surface",
            },
        }

    @classmethod
    def create_bitmap_node_from_slot(cls, slot_key, slot):
        return {
            "id": f"bitmap-{slot_key}",
            "type": "bitmap",
            "label": f"{slot_key} Bitmap",
            "locked": False,
            "position": {
                "x": 80,
                "y": 80 + SURFACE_SLOT_KEYS.index(slot_key) * 34,
            },
            "inputs": {},
            "outputs": {
                "color": {
                    "slot": slot_key,
                    "url": slot.get("url", ""),
                    "channel": slot.get("channel", "rgba"),
                },
                "value": {
                    "slot": slot_key,
                    "channel": slot.get("channel", "rgba"),
                },
            },
            "settings": {
                "slot": slot_key,
                "layer_id": slot.get("layer_id", ""),
                "url": slot.get("url", ""),
                "name": slot.get("name", ""),
                "channel": slot.get("channel", "rgba"),
                "strength": slot.get("strength", 1.0),
                "offset": slot.get("offset", 0.0),
                "invert": slot.get("invert", False),
                "blend": slot.get("blend", "replace"),
            },
        }

    @classmethod
    def create_multitexture_node_from_slot(cls, slot_key, slot):
        groups = slot.get("texture_groups", [])

        if not isinstance(groups, list):
            groups = []

        return {
            "id": slot.get("node_id") or f"multitexture-{slot_key}",
            "type": "multitexture",
            "label": slot.get("name") or f"{slot_key} MultiTexture",
            "locked": False,
            "position": {
                "x": 80,
                "y": 80 + SURFACE_SLOT_KEYS.index(slot_key) * 34,
            },
            "inputs": {
                (group.get("slot") or f"texture_{index + 1}"): {"type": "color"}
                for index, group in enumerate(groups)
                if isinstance(group, dict)
            },
            "outputs": {
                "color": {"type": "color"},
                "alpha": {"type": "float"},
            },
            "settings": {
                "slot": slot_key,
                "target_slot": slot_key,
                "target_slots": [slot_key],
                "mode": "cubemap-url-group-composite",
                "name": slot.get("name", ""),
                "channel": slot.get("channel", "rgba"),
                "strength": slot.get("strength", 1.0),
                "offset": slot.get("offset", 0.0),
                "invert": slot.get("invert", False),
                "blend": slot.get("blend", "replace"),
                "faces": slot.get("faces", {}),
                "mapped_faces": slot.get("mapped_faces", []),
                "texture_groups": groups,
            },
        }

    @classmethod
    def normalize_node(cls, node, index=0):
        if not isinstance(node, dict):
            node = {}

        node_type = node.get("type", "value")

        if node_type not in ALLOWED_NODE_TYPES:
            node_type = "value"

        normalized = {
            "id": str(node.get("id") or str(uuid.uuid4())),
            "type": node_type,
            "label": str(node.get("label") or node_type.title()),
            "locked": bool(node.get("locked", False)),
            "position": node.get("position") or {
                "x": 120 + index * 40,
                "y": 120 + index * 20,
            },
            "inputs": node.get("inputs") if isinstance(node.get("inputs"), dict) else {},
            "outputs": node.get("outputs") if isinstance(node.get("outputs"), dict) else {},
            "settings": node.get("settings") if isinstance(node.get("settings"), dict) else {},
        }

        if "generated" in node:
            normalized["generated"] = bool(node.get("generated"))

        if "system" in node:
            normalized["system"] = str(node.get("system") or "")

        return normalized

    @classmethod
    def normalize_edge(cls, edge):
        if not isinstance(edge, dict):
            return None

        from_data = edge.get("from") or {}
        to_data = edge.get("to") or {}

        from_node = from_data.get("node")
        from_socket = from_data.get("socket")
        to_node = to_data.get("node")
        to_socket = to_data.get("socket")

        if not from_node or not from_socket or not to_node or not to_socket:
            return None

        normalized = {
            "id": str(edge.get("id") or str(uuid.uuid4())),
            "from": {
                "node": str(from_node),
                "socket": str(from_socket),
            },
            "to": {
                "node": str(to_node),
                "socket": str(to_socket),
            },
        }

        if "core" in edge:
            normalized["core"] = bool(edge.get("core"))

        if "generated" in edge:
            normalized["generated"] = bool(edge.get("generated"))

        if "system" in edge:
            normalized["system"] = str(edge.get("system") or "")

        return normalized

    @classmethod
    def build_auto_shader_graph(cls, bitmap_maps):
        principled = cls.create_principled_node()
        output = cls.create_output_node()

        nodes = [principled, output]
        edges = [{
            "id": "edge-principled-bsdf-to-material-output",
            "from": {
                "node": "principled-bsdf",
                "socket": "bsdf",
            },
            "to": {
                "node": "material-output",
                "socket": "surface",
            },
            "core": True,
        }]

        for slot_key, slot in bitmap_maps.items():
            if not isinstance(slot, dict) or not slot.get("enabled"):
                continue

            output_socket = "color" if isinstance(SURFACE_DEFAULTS.get(slot_key), list) else "value"

            if slot.get("source_type") == "multitexture" and slot.get("texture_groups"):
                texture_node = cls.create_multitexture_node_from_slot(slot_key, slot)
                nodes.append(texture_node)

                edges.append({
                    "id": f"edge-{texture_node['id']}-to-principled-{slot_key}",
                    "from": {
                        "node": texture_node["id"],
                        "socket": output_socket,
                    },
                    "to": {
                        "node": "principled-bsdf",
                        "socket": slot_key,
                    },
                })
                continue

            if not slot.get("url"):
                continue

            bitmap_node = cls.create_bitmap_node_from_slot(slot_key, slot)
            nodes.append(bitmap_node)

            edges.append({
                "id": f"edge-{bitmap_node['id']}-to-principled-{slot_key}",
                "from": {
                    "node": bitmap_node["id"],
                    "socket": output_socket,
                },
                "to": {
                    "node": "principled-bsdf",
                    "socket": slot_key,
                },
            })

        return {
            "version": 1,
            "nodes": nodes,
            "edges": edges,
        }

    @classmethod
    def normalize_shader_graph(cls, shader_graph, bitmap_maps):
        data = json_loads(shader_graph, {})

        if not isinstance(data, dict) or not data.get("nodes"):
            return cls.build_auto_shader_graph(bitmap_maps)

        nodes = []
        edges = []

        has_output = False
        has_principled = False

        for index, node in enumerate(data.get("nodes", [])):
            if not isinstance(node, dict):
                continue

            normalized = cls.normalize_node(node, index)

            if normalized["type"] == "output":
                normalized["id"] = "material-output"
                normalized["type"] = "output"
                normalized["locked"] = True
                normalized["inputs"] = cls.create_output_node()["inputs"]
                normalized["outputs"] = {}
                has_output = True

            if normalized["id"] == "principled-bsdf" or normalized["type"] == "principled":
                normalized["id"] = "principled-bsdf"
                normalized["type"] = "principled"
                normalized["outputs"] = cls.create_principled_node()["outputs"]
                has_principled = True

            nodes.append(normalized)

        if not has_principled:
            nodes.append(cls.create_principled_node())

        if not has_output:
            nodes.append(cls.create_output_node())

        existing_node_ids = {node["id"] for node in nodes}

        for edge in data.get("edges", []):
            normalized_edge = cls.normalize_edge(edge)

            if not normalized_edge:
                continue

            if (
                normalized_edge["from"]["node"] in existing_node_ids
                and normalized_edge["to"]["node"] in existing_node_ids
            ):
                edges.append(normalized_edge)

        connected_from_ids = {
            edge.get("from", {}).get("node")
            for edge in edges
        }

        auto_bitmap_ids = {
            f"bitmap-{slot_key}"
            for slot_key in SURFACE_SLOT_KEYS
        }

        nodes = [
            node for node in nodes
            if node.get("id") not in auto_bitmap_ids
            or node.get("id") in connected_from_ids
        ]

        existing_slot_nodes = {
            node.get("settings", {}).get("slot")
            for node in nodes
            if node.get("type") == "bitmap"
        }

        connected_slots = {
            edge.get("to", {}).get("socket")
            for edge in edges
            if edge.get("to", {}).get("node") == "principled-bsdf"
        }

        for slot_key, slot in bitmap_maps.items():
            if not isinstance(slot, dict) or not slot.get("enabled"):
                continue

            if slot_key in connected_slots:
                continue

            if slot_key in existing_slot_nodes:
                continue

            output_socket = "color" if isinstance(SURFACE_DEFAULTS.get(slot_key), list) else "value"

            if slot.get("source_type") == "multitexture" and slot.get("texture_groups"):
                texture_node = cls.create_multitexture_node_from_slot(slot_key, slot)
                nodes.append(texture_node)

                edges.append({
                    "id": f"edge-{texture_node['id']}-to-principled-{slot_key}",
                    "from": {
                        "node": texture_node["id"],
                        "socket": output_socket,
                    },
                    "to": {
                        "node": "principled-bsdf",
                        "socket": slot_key,
                    },
                })
                continue

            if not slot.get("url"):
                continue

            bitmap_node = cls.create_bitmap_node_from_slot(slot_key, slot)
            nodes.append(bitmap_node)

            edges.append({
                "id": f"edge-{bitmap_node['id']}-to-principled-{slot_key}",
                "from": {
                    "node": bitmap_node["id"],
                    "socket": output_socket,
                },
                "to": {
                    "node": "principled-bsdf",
                    "socket": slot_key,
                },
            })

        seen_edges = set()
        cleaned_edges = []

        for edge in edges:
            key = (
                edge.get("from", {}).get("node"),
                edge.get("from", {}).get("socket"),
                edge.get("to", {}).get("node"),
                edge.get("to", {}).get("socket"),
            )

            if key in seen_edges:
                continue

            seen_edges.add(key)
            edge["core"] = (
                key[0] == "principled-bsdf"
                and key[1] == "bsdf"
                and key[2] == "material-output"
                and key[3] == "surface"
            )
            cleaned_edges.append(edge)

        return {
            "version": int(data.get("version", 1) or 1),
            "nodes": nodes,
            "edges": cleaned_edges,
        }

    @classmethod
    def graph_indexes(cls, shader_graph):
        nodes = {
            node.get("id"): node
            for node in shader_graph.get("nodes", [])
            if isinstance(node, dict) and node.get("id")
        }

        incoming = {}

        for edge in shader_graph.get("edges", []):
            if not isinstance(edge, dict):
                continue

            to_data = edge.get("to", {})
            key = (
                to_data.get("node"),
                to_data.get("socket"),
            )

            if key[0] and key[1]:
                incoming[key] = edge

        return nodes, incoming

    @classmethod
    def get_incoming_node(cls, nodes, incoming, node_id, sockets):
        for socket in sockets:
            edge = incoming.get((node_id, socket))

            if edge:
                from_node = nodes.get(edge.get("from", {}).get("node"))

                if from_node:
                    return from_node, edge

        return None, None

    @classmethod
    def cache_graph_bitmap(cls, material_id, settings, suffix):
        bitmap = {
            "layer_id": settings.get("layer_id", ""),
            "url": settings.get("url", ""),
            "name": settings.get("name", ""),
            "width": settings.get("width", 0),
            "height": settings.get("height", 0),
            "channel": settings.get("channel", "rgba"),
        }

        cached = cls.cache_bitmap_payload(material_id, bitmap, suffix)

        settings.update({
            "layer_id": cached.get("layer_id", settings.get("layer_id", "")),
            "url": cached.get("url", settings.get("url", "")),
            "name": cached.get("name", settings.get("name", "")),
            "filename": cached.get("filename", settings.get("filename", "")),
            "cached": cached.get("cached", False),
            "missing": cached.get("missing", False),
        })

        return {
            "source_type": "single",
            "layer_id": settings.get("layer_id", ""),
            "url": settings.get("url", ""),
            "name": settings.get("name", ""),
            "filename": settings.get("filename", ""),
            "cached": settings.get("cached", False),
            "missing": settings.get("missing", False),
            "channel": settings.get("channel", "rgba"),
            "node_id": settings.get("node_id", ""),
            "texture_groups": [],
            "mapped_faces": settings.get("mapped_faces", []),
            "faces": settings.get("faces", {}),
        }

    @classmethod
    def resolve_graph_source(cls, material_id, nodes, incoming, node_id, socket="", seen=None):
        seen = seen or set()

        if not node_id or node_id in seen:
            return None

        seen.add(node_id)
        node = nodes.get(node_id)

        if not node:
            return None

        node_type = node.get("type")
        settings = node.get("settings")

        if not isinstance(settings, dict):
            settings = {}
            node["settings"] = settings

        settings["node_id"] = node.get("id", "")

        if node_type == "bitmap":
            resolved_bitmap = cls.cache_graph_bitmap(
                material_id,
                settings,
                f"node_{node.get('id', 'bitmap')}",
            )

            return resolved_bitmap if resolved_bitmap.get("url") else None

        if node_type == "multitexture":
            groups = []
            configured_groups = settings.get("texture_groups", [])

            if not isinstance(configured_groups, list):
                configured_groups = []

            for index, group in enumerate(configured_groups):
                if not isinstance(group, dict):
                    continue

                group_settings = dict(group)
                input_socket = group_settings.get("slot") or f"texture_{index + 1}"

                source_node, _edge = cls.get_incoming_node(
                    nodes,
                    incoming,
                    node.get("id"),
                    [input_socket],
                )

                resolved = cls.resolve_graph_source(
                    material_id,
                    nodes,
                    incoming,
                    source_node.get("id") if source_node else "",
                    input_socket,
                    set(seen),
                )

                if resolved and resolved.get("url"):
                    group_settings.update({
                        "url": resolved.get("url", ""),
                        "layer_id": resolved.get("layer_id", group_settings.get("layer_id", "")),
                        "name": resolved.get("name", group_settings.get("name", "")),
                        "filename": resolved.get("filename", group_settings.get("filename", "")),
                        "cached": resolved.get("cached", False),
                        "missing": resolved.get("missing", False),
                        "channel": resolved.get("channel", settings.get("channel", "rgba")),
                    })
                else:
                    cached = cls.cache_bitmap_payload(
                        material_id,
                        group_settings,
                        f"node_{node.get('id', 'multitexture')}_{index + 1}",
                    )
                    group_settings.update({
                        "url": cached.get("url", group_settings.get("url", "")),
                        "layer_id": cached.get("layer_id", group_settings.get("layer_id", "")),
                        "name": cached.get("name", group_settings.get("name", "")),
                        "filename": cached.get("filename", group_settings.get("filename", "")),
                        "cached": cached.get("cached", False),
                        "missing": cached.get("missing", False),
                        "channel": group_settings.get("channel", settings.get("channel", "rgba")),
                    })

                if group_settings.get("url"):
                    groups.append({
                        "slot": group_settings.get("slot", input_socket),
                        "url": group_settings.get("url", ""),
                        "name": group_settings.get("name", "") or group_settings.get("layer_id", "") or "Texture",
                        "layer_id": group_settings.get("layer_id", ""),
                        "filename": group_settings.get("filename", ""),
                        "cached": group_settings.get("cached", False),
                        "missing": group_settings.get("missing", False),
                        "channel": group_settings.get("channel", settings.get("channel", "rgba")),
                        "faces": [
                            face for face in group_settings.get("faces", [])
                            if face in CUBE_FACE_NAMES
                        ],
                    })

            settings["texture_groups"] = groups

            if not groups:
                return None

            return {
                "source_type": "multitexture",
                "layer_id": "",
                "url": "",
                "name": node.get("label") or settings.get("name", "") or "Cube MultiTexture",
                "filename": "",
                "cached": all(group.get("cached", False) for group in groups),
                "missing": False,
                "channel": settings.get("channel", "rgba"),
                "node_id": node.get("id", ""),
                "texture_groups": groups,
                "mapped_faces": settings.get("mapped_faces", []),
                "faces": settings.get("faces", {}),
            }

        source_node, _edge = cls.get_incoming_node(
            nodes,
            incoming,
            node.get("id"),
            ["image", "color", "value", "factor", "uv", "surface"],
        )

        resolved = cls.resolve_graph_source(
            material_id,
            nodes,
            incoming,
            source_node.get("id") if source_node else "",
            socket,
            seen,
        )

        if resolved:
            resolved = dict(resolved)
            resolved["source_type"] = "shader"
            resolved["node_id"] = node.get("id", resolved.get("node_id", ""))
            resolved["name"] = node.get("label") or resolved.get("name", "")
            resolved["channel"] = settings.get("channel", resolved.get("channel", "rgba"))
            resolved["strength"] = settings.get("strength", resolved.get("strength", 1.0))
            resolved["offset"] = settings.get("offset", resolved.get("offset", 0.0))
            resolved["invert"] = settings.get("invert", resolved.get("invert", False))
            resolved["blend"] = settings.get("blend", resolved.get("blend", "replace"))

        return resolved

    @classmethod
    def resolve_shader_graph_slots(cls, material_id, shader_graph, bitmap_maps):
        nodes, incoming = cls.graph_indexes(shader_graph)

        for slot_key in SURFACE_SLOT_KEYS:
            edge = incoming.get(("principled-bsdf", slot_key))

            if not edge:
                continue

            source_id = edge.get("from", {}).get("node")
            resolved = cls.resolve_graph_source(
                material_id,
                nodes,
                incoming,
                source_id,
                edge.get("from", {}).get("socket", ""),
            )

            if not resolved:
                continue

            current = bitmap_maps.get(slot_key, cls.default_bitmap_slot())

            slot = {
                **current,
                "enabled": True,
                "source_type": resolved.get("source_type", "shader"),
                "layer_id": resolved.get("layer_id", current.get("layer_id", "")),
                "url": resolved.get("url", current.get("url", "")),
                "name": resolved.get("name", current.get("name", "")),
                "node_id": source_id or resolved.get("node_id", current.get("node_id", "")),
                "uv_node_id": current.get("uv_node_id", ""),
                "faces": resolved.get("faces", current.get("faces", {})),
                "mapped_faces": resolved.get("mapped_faces", current.get("mapped_faces", [])),
                "texture_groups": resolved.get("texture_groups", current.get("texture_groups", [])),
                "filename": resolved.get("filename", current.get("filename", "")),
                "cached": resolved.get("cached", current.get("cached", False)),
                "missing": resolved.get("missing", current.get("missing", False)),
                "channel": resolved.get("channel", current.get("channel", "rgba")),
                "strength": resolved.get("strength", current.get("strength", 1.0)),
                "offset": resolved.get("offset", current.get("offset", 0.0)),
                "invert": resolved.get("invert", current.get("invert", False)),
                "blend": resolved.get("blend", current.get("blend", "replace")),
            }

            if (
                slot["source_type"] == "shader"
                and not slot.get("url")
                and not slot.get("texture_groups")
            ):
                slot["enabled"] = False
                slot["source_type"] = "none"

            bitmap_maps[slot_key] = slot

        return bitmap_maps

    @classmethod
    def sync_shader_graph_texture_refs(cls, shader_graph, bitmap_maps, uv):
        target_slots = cls.get_uv_target_slots(uv, bitmap_maps)
        primary_slot_key = target_slots[0] if target_slots else "baseColor"
        primary_map = bitmap_maps.get(primary_slot_key, {})

        for node in shader_graph.get("nodes", []):
            if not isinstance(node, dict):
                continue

            settings = node.get("settings")

            if not isinstance(settings, dict):
                settings = {}
                node["settings"] = settings

            slot_key = settings.get("slot")

            if node.get("id") in {"uv-cubemap-single-bitmap", "uv-cubemap-multitexture"}:
                slot_key = primary_slot_key

            if (
                node.get("type") == "bitmap"
                and slot_key in bitmap_maps
                and not (node.get("generated") is True and node.get("system") == "uv-cubemap")
            ):
                slot = bitmap_maps.get(slot_key, {})
                settings.update({
                    "slot": slot_key,
                    "layer_id": slot.get("layer_id", ""),
                    "url": slot.get("url", ""),
                    "name": slot.get("name", ""),
                    "filename": slot.get("filename", ""),
                    "cached": slot.get("cached", False),
                    "missing": slot.get("missing", False),
                    "channel": slot.get("channel", "rgba"),
                    "strength": slot.get("strength", 1.0),
                    "offset": slot.get("offset", 0.0),
                    "invert": slot.get("invert", False),
                    "blend": slot.get("blend", "replace"),
                })

            if str(node.get("id", "")).startswith("uv-texture-group-bitmap-"):
                try:
                    group_index = int(str(node.get("id")).rsplit("-", 1)[-1]) - 1
                except Exception:
                    group_index = -1

                groups = primary_map.get("texture_groups", [])

                if 0 <= group_index < len(groups):
                    group = groups[group_index]
                    settings.update({
                        "group_index": group_index,
                        "layer_id": group.get("layer_id", ""),
                        "url": group.get("url", ""),
                        "name": group.get("name", ""),
                        "filename": group.get("filename", ""),
                        "cached": group.get("cached", False),
                        "missing": group.get("missing", False),
                        "channel": group.get("channel", primary_map.get("channel", "rgba")),
                        "faces": uv.get("faces", {}),
                        "mapped_faces": group.get("faces", []),
                        "target_slot": primary_slot_key,
                        "target_slots": target_slots,
                    })

            if node.get("id") == "uv-cubemap-layout":
                settings.update({
                    "faces": uv.get("faces", {}),
                    "mapped_faces": primary_map.get("mapped_faces", []),
                    "texture_groups": primary_map.get("texture_groups", []),
                    "target_slot": primary_slot_key,
                    "target_slots": target_slots,
                })

            if node.get("id") == "uv-cubemap-single-bitmap":
                settings.update({
                    "slot": primary_slot_key,
                    "target_slot": primary_slot_key,
                    "target_slots": target_slots,
                    "layer_id": primary_map.get("layer_id", ""),
                    "url": primary_map.get("url", ""),
                    "name": primary_map.get("name", ""),
                    "filename": primary_map.get("filename", ""),
                    "cached": primary_map.get("cached", False),
                    "missing": primary_map.get("missing", False),
                    "channel": primary_map.get("channel", "rgba"),
                    "faces": uv.get("faces", {}),
                    "mapped_faces": primary_map.get("mapped_faces", []),
                    "texture_groups": primary_map.get("texture_groups", []),
                })

            if node.get("id") == "uv-cubemap-multitexture":
                settings.update({
                    "slot": primary_slot_key,
                    "target_slot": primary_slot_key,
                    "target_slots": target_slots,
                    "channel": primary_map.get("channel", "rgba"),
                    "faces": uv.get("faces", {}),
                    "mapped_faces": primary_map.get("mapped_faces", []),
                    "texture_groups": primary_map.get("texture_groups", []),
                })

        return shader_graph

    @classmethod
    def collect_material_textures(cls, bitmap_maps, uv, shader_graph):
        textures = []
        by_url = {}

        def add_texture(
            url,
            name="",
            layer_id="",
            filename="",
            channel="rgba",
            faces=None,
            node_id="",
            slot="",
        ):
            if not url:
                return

            if url in by_url:
                existing = by_url[url]
                existing_faces = set(existing.get("faces", []))
                existing["faces"] = list(existing_faces.union(faces or []))
                return

            item = {
                "url": url,
                "name": name or layer_id or node_id or "Texture",
                "layer_id": layer_id,
                "filename": filename,
                "channel": channel or "rgba",
                "faces": faces or [],
                "node_id": node_id,
                "slot": slot,
            }

            by_url[url] = item
            textures.append(item)

        for face_name, face in (uv.get("faces", {}) if isinstance(uv, dict) else {}).items():
            bitmap = face.get("bitmap", {}) if isinstance(face, dict) else {}

            add_texture(
                url=bitmap.get("url", ""),
                name=bitmap.get("name", ""),
                layer_id=bitmap.get("layer_id", ""),
                filename=bitmap.get("filename", ""),
                channel=bitmap.get("channel", "rgba"),
                faces=[face_name],
                node_id="uv-cubemap-layout",
                slot="uv",
            )

        for node in (shader_graph.get("nodes", []) if isinstance(shader_graph, dict) else []):
            if not isinstance(node, dict):
                continue

            settings = node.get("settings", {})

            if not isinstance(settings, dict):
                settings = {}

            if isinstance(settings.get("texture_groups"), list):
                for group in settings.get("texture_groups", []):
                    if not isinstance(group, dict):
                        continue

                    add_texture(
                        url=group.get("url", ""),
                        name=group.get("name", ""),
                        layer_id=group.get("layer_id", ""),
                        filename=group.get("filename", ""),
                        channel=group.get("channel", settings.get("channel", "rgba")),
                        faces=group.get("faces", []),
                        node_id=node.get("id", ""),
                        slot=group.get("slot", ""),
                    )

            if node.get("type") == "bitmap":
                add_texture(
                    url=settings.get("url", ""),
                    name=settings.get("name", ""),
                    layer_id=settings.get("layer_id", ""),
                    filename=settings.get("filename", ""),
                    channel=settings.get("channel", "rgba"),
                    faces=settings.get("mapped_faces", []),
                    node_id=node.get("id", ""),
                    slot=settings.get("slot", ""),
                )

        if isinstance(bitmap_maps, dict):
            for slot_key, slot in bitmap_maps.items():
                if not isinstance(slot, dict):
                    continue

                if isinstance(slot.get("texture_groups"), list):
                    for group in slot.get("texture_groups", []):
                        if not isinstance(group, dict):
                            continue

                        add_texture(
                            url=group.get("url", ""),
                            name=group.get("name", ""),
                            layer_id=group.get("layer_id", ""),
                            filename=group.get("filename", ""),
                            channel=group.get("channel", slot.get("channel", "rgba")),
                            faces=group.get("faces", []),
                            node_id=slot.get("node_id", ""),
                            slot=slot_key,
                        )

                if slot.get("url"):
                    add_texture(
                        url=slot.get("url", ""),
                        name=slot.get("name", ""),
                        layer_id=slot.get("layer_id", ""),
                        filename=slot.get("filename", ""),
                        channel=slot.get("channel", "rgba"),
                        faces=slot.get("mapped_faces", []),
                        node_id=slot.get("node_id", ""),
                        slot=slot_key,
                    )

        return textures

    @classmethod
    def build_low_poly_cube_mesh(cls, cube_size=256.0, geometry=None):
        geometry = geometry or {}
        size = float(cube_size or 256.0)

        scale_x = cls.clamp(geometry.get("scale_x", 1.0), 0.001, 100.0)
        scale_y = cls.clamp(geometry.get("scale_y", 1.0), 0.001, 100.0)
        scale_z = cls.clamp(geometry.get("scale_z", 1.0), 0.001, 100.0)

        width = size * cls.clamp(geometry.get("width", 1.0), 0.001, 100.0) * scale_x
        height = size * cls.clamp(geometry.get("height", 1.0), 0.001, 100.0) * scale_y
        depth = size * cls.clamp(geometry.get("depth", 1.0), 0.001, 100.0) * scale_z

        hx = width / 2.0
        hy = height / 2.0
        hz = depth / 2.0

        return {
            "type": "LOW_POLY_CUBE",
            "size": size,
            "vertices": [
                [-hx, -hy, -hz],
                [hx, -hy, -hz],
                [hx, hy, -hz],
                [-hx, hy, -hz],
                [-hx, -hy, hz],
                [hx, -hy, hz],
                [hx, hy, hz],
                [-hx, hy, hz],
            ],
            "faces": [
                {"name": "back", "indices": [0, 1, 2, 3], "normal": [0, 0, -1]},
                {"name": "front", "indices": [4, 5, 6, 7], "normal": [0, 0, 1]},
                {"name": "bottom", "indices": [0, 4, 5, 1], "normal": [0, -1, 0]},
                {"name": "top", "indices": [3, 2, 6, 7], "normal": [0, 1, 0]},
                {"name": "right", "indices": [1, 5, 6, 2], "normal": [1, 0, 0]},
                {"name": "left", "indices": [0, 3, 7, 4], "normal": [-1, 0, 0]},
            ],
            "geometry": geometry,
            "primitive": geometry.get("primitive", "cube"),
            "bevel": geometry.get("bevel", 0.0),
            "bevel_segments": geometry.get("bevel_segments", 1),
            "subdivision": geometry.get("subdivision", 0),
            "shade_smooth": geometry.get("shade_smooth", True),
            "displacement": {
                "enabled": geometry.get("displacement_enabled", False),
                "strength": geometry.get("displacement_strength", 0.0),
                "midlevel": geometry.get("displacement_midlevel", 0.5),
            },
            "uv": {
                "fit": geometry.get("uv_fit", "stretch"),
                "density": geometry.get("uv_density", 1.0),
            },
            "transform": {
                "pivot": [
                    geometry.get("pivot_x", 0.0),
                    geometry.get("pivot_y", 0.0),
                    geometry.get("pivot_z", 0.0),
                ],
                "rotation": [
                    geometry.get("rotation_x", 0.0),
                    geometry.get("rotation_y", 0.0),
                    geometry.get("rotation_z", 0.0),
                ],
                "scale": [
                    geometry.get("scale_x", 1.0),
                    geometry.get("scale_y", 1.0),
                    geometry.get("scale_z", 1.0),
                ],
            },
        }

    @classmethod
    def build_shader_payload(
        cls,
        surface,
        geometry,
        bitmap_maps,
        uv,
        shader_graph,
    ):
        if not isinstance(shader_graph, dict):
            shader_graph = {}

        edges = shader_graph.get("edges", [])

        if not isinstance(edges, list):
            edges = []

        material_connected = any(
            edge.get("from", {}).get("node") == "principled-bsdf"
            and edge.get("from", {}).get("socket") == "bsdf"
            and edge.get("to", {}).get("node") == "material-output"
            and edge.get("to", {}).get("socket") == "surface"
            for edge in edges
            if isinstance(edge, dict)
        )

        shader_graph["material_connected"] = material_connected

        return {
            "shader": "canvas-principled-node-graph",
            "version": cls.CONTRACT_VERSION,
            "material_connected": material_connected,
            "inputs": surface,
            "surface": surface,
            "geometry": geometry,
            "bitmap_maps": bitmap_maps,
            "uv": uv,
            "graph": shader_graph,
        }

    @classmethod
    def build_blender_material(
        cls,
        material_id,
        layer_id,
        name,
        surface,
        geometry,
        bitmap_maps,
        uv,
        shader_graph,
        texture,
        blend_mode="BLEND",
        shadow_method="HASHED",
        use_nodes=True,
    ):
        alpha = surface.get("alpha", 1.0)
        textures = cls.collect_material_textures(
            bitmap_maps=bitmap_maps,
            uv=uv,
            shader_graph=shader_graph,
        )

        return {
            "id": material_id,
            "layer_id": layer_id,
            "schema": "blender-principled-bsdf-node-graph",
            "engine": "BLENDER",
            "version": "4.x",
            "name": name or "Cube Material",
            "shader": "Principled BSDF",
            "use_nodes": bool(use_nodes),

            "material_settings": {
                "blend_method": str(blend_mode or "BLEND"),
                "shadow_method": str(shadow_method or "HASHED"),
                "use_screen_refraction": alpha < 1.0,
                "show_transparent_back": True,
                "geometry": {
                    "primitive": geometry.get("primitive"),
                    "shade_smooth": geometry.get("shade_smooth"),
                    "bevel": geometry.get("bevel"),
                    "bevel_segments": geometry.get("bevel_segments"),
                    "subdivision": geometry.get("subdivision"),
                    "displacement_enabled": geometry.get("displacement_enabled"),
                },
            },

            "geometry": geometry,

            "principled_bsdf": {
                "base_color": surface.get("baseColor"),
                "subsurface": surface.get("subsurface"),
                "subsurface_radius": surface.get("subsurfaceRadius"),
                "subsurface_color": surface.get("subsurfaceColor"),
                "metallic": surface.get("metallic"),
                "specular": surface.get("specular"),
                "specular_tint": surface.get("specularTint"),
                "roughness": surface.get("roughness"),
                "anisotropic": surface.get("anisotropic"),
                "anisotropic_rotation": surface.get("anisotropicRotation"),
                "sheen": surface.get("sheen"),
                "sheen_tint": surface.get("sheenTint"),
                "clearcoat": surface.get("clearcoat"),
                "clearcoat_roughness": surface.get("clearcoatRoughness"),
                "ior": surface.get("ior"),
                "transmission": surface.get("transmission"),
                "transmission_roughness": surface.get("transmissionRoughness"),
                "emission_color": surface.get("emission"),
                "emission_strength": surface.get("emissionStrength"),
                "alpha": surface.get("alpha"),
                "normal": surface.get("normal"),
                "clearcoat_normal": surface.get("clearcoatNormal"),
                "tangent": surface.get("tangent"),
                "bump_strength": surface.get("bumpStrength"),
                "displacement_strength": surface.get("displacementStrength"),
            },

            "textures": textures,

            "texture": texture,
            "surface": surface,
            "bitmap_maps": bitmap_maps,
            "uv": uv,
            "shader_graph": shader_graph,
        }

    @classmethod
    def unpack_material_values(
        cls,
        values=None,
        name="Cube Material",
        surface=None,
        geometry=None,
        bitmap_maps=None,
        uv=None,
        shader_graph=None,
        cube_size=256.0,
        rotate_preview=True,
        blend_mode="BLEND",
        shadow_method="HASHED",
        use_nodes=True,
        **fallbacks,
    ):
        raw_values = values if isinstance(values, dict) else json_loads(values, {})

        if not isinstance(raw_values, dict):
            raw_values = {}

        surface_data = raw_values.get("surface", surface)
        geometry_data = raw_values.get("geometry", geometry)
        bitmap_maps_data = raw_values.get("bitmap_maps", bitmap_maps)
        uv_data = raw_values.get("uv", uv)
        shader_graph_data = raw_values.get("shader_graph", shader_graph)

        if not isinstance(surface_data, dict):
            surface_data = json_loads(surface_data, {})

        if not isinstance(geometry_data, dict):
            geometry_data = json_loads(geometry_data, {})

        if not isinstance(bitmap_maps_data, dict):
            bitmap_maps_data = json_loads(bitmap_maps_data, {})

        if not isinstance(uv_data, dict):
            uv_data = json_loads(uv_data, {})

        if not isinstance(shader_graph_data, dict):
            shader_graph_data = json_loads(shader_graph_data, {})

        resolved = {
            "name": raw_values.get("name", name or "Cube Material"),

            "surface": surface_data if isinstance(surface_data, dict) else {},
            "geometry": geometry_data if isinstance(geometry_data, dict) else {},
            "bitmap_maps": bitmap_maps_data if isinstance(bitmap_maps_data, dict) else {},
            "uv": uv_data if isinstance(uv_data, dict) else {},
            "shader_graph": shader_graph_data if isinstance(shader_graph_data, dict) else {},

            "cube_size": raw_values.get("cube_size", cube_size),
            "rotate_preview": raw_values.get("rotate_preview", rotate_preview),
            "blend_mode": raw_values.get("blend_mode", blend_mode or "BLEND"),
            "shadow_method": raw_values.get("shadow_method", shadow_method or "HASHED"),
            "use_nodes": raw_values.get("use_nodes", use_nodes),
        }

        resolved["name"] = str(resolved.get("name") or "Cube Material")
        resolved["cube_size"] = cls.safe_float(resolved.get("cube_size"), 256.0)
        resolved["rotate_preview"] = cls.safe_bool(resolved.get("rotate_preview"))
        resolved["use_nodes"] = cls.safe_bool(resolved.get("use_nodes"))
        resolved["blend_mode"] = str(resolved.get("blend_mode") or "BLEND")
        resolved["shadow_method"] = str(resolved.get("shadow_method") or "HASHED")

        return resolved

    @classmethod
    def build_material_package(
        cls,
        material_id=None,
        layer_id="",
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
        values=None,
        **extra
    ):
        cls.ensure_dirs()

        payload = cls.unpack_material_values(
            values=values,
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
            payload=extra
        )

        material_id = material_id or str(uuid.uuid4())

        normalized_surface = cls.normalize_surface(payload["surface"])
        normalized_geometry = cls.normalize_geometry(payload["geometry"])
        normalized_uv = cls.normalize_uv(payload["uv"])

        normalized_uv = cls.cache_uv_textures(
            material_id=material_id,
            uv=normalized_uv,
        )

        normalized_maps = cls.normalize_bitmap_maps(payload["bitmap_maps"])

        normalized_maps = cls.refresh_all_uv_texture_slots(
            normalized_maps,
            normalized_uv,
        )

        normalized_graph = cls.normalize_shader_graph(
            payload["shader_graph"],
            normalized_maps,
        )

        normalized_maps = cls.resolve_shader_graph_slots(
            material_id,
            normalized_graph,
            normalized_maps,
        )

        normalized_graph = cls.sync_shader_graph_texture_refs(
            normalized_graph,
            normalized_maps,
            normalized_uv,
        )

        mesh = cls.build_low_poly_cube_mesh(
            cube_size=payload["cube_size"],
            geometry=normalized_geometry,
        )

        shader = cls.build_shader_payload(
            surface=normalized_surface,
            geometry=normalized_geometry,
            bitmap_maps=normalized_maps,
            uv=normalized_uv,
            shader_graph=normalized_graph,
        )

        primary_url = cls.resolve_primary_preview_url({
            "bitmap_maps": normalized_maps,
            "uv": normalized_uv,
            "texture": {},
        })

        texture = {
            "url": primary_url,
            "filename": "",
            "cached": False,
            "missing": not bool(primary_url),
        }

        material = cls.build_blender_material(
            material_id=material_id,
            layer_id=layer_id,
            name=payload["name"],
            surface=normalized_surface,
            geometry=normalized_geometry,
            bitmap_maps=normalized_maps,
            uv=normalized_uv,
            shader_graph=normalized_graph,
            texture=texture,
            blend_mode=payload["blend_mode"],
            shadow_method=payload["shadow_method"],
            use_nodes=payload["use_nodes"],
        )

        package = {
            "id": material_id,
            "layer_id": layer_id,
            "contract_version": cls.CONTRACT_VERSION,
            "type": "MATERIAL_LOW_POLY_CUBE",
            "renderer": cls.RENDERER,
            "engine": cls.ENGINE,

            "created_at": time("unix_ms"),
            "updated_at": time("unix_ms"),
            "source_layer_id": source_layer_id,

            "name": payload["name"],

            "surface": normalized_surface,
            "geometry": normalized_geometry,
            "bitmap_maps": normalized_maps,
            "uv": normalized_uv,
            "shader_graph": normalized_graph,

            "texture": texture,
            "material": material,
            "mesh": mesh,
            "shader": shader,

            "preview": {
                "rotate": bool(payload["rotate_preview"]),
                "idle_rotation": {
                    "enabled": bool(payload["rotate_preview"]),
                    "speed": 0.006,
                    "tilt": 0.42,
                },
            },

            "settings": {
                "blend_mode": payload["blend_mode"],
                "shadow_method": payload["shadow_method"],
                "use_nodes": bool(payload["use_nodes"]),
                "cube_size": payload["cube_size"],
            },
        }

        filename = "package.material.json"
        folder = cls.material_folder(material_id)
        package_path = os.path.join(folder, filename)

        package["package"] = {
            "filename": filename,
            "path": package_path,
            "url": cls.make_material_package_url(material_id, filename),
        }

        with open(package_path, "w", encoding="utf-8") as handle:
            json.dump(package, handle, indent=2, ensure_ascii=False)

        return package

    @classmethod
    def resolve_primary_preview_url(cls, package):
        maps = package.get("bitmap_maps", {})

        if isinstance(maps, dict):
            preferred_slots = [
                "baseColor",
                "emission",
                "alpha",
                "normal",
                "roughness",
                "metallic",
                "bumpStrength",
                "displacementStrength",
            ]

            for slot_key in preferred_slots:
                slot = maps.get(slot_key, {})

                if not isinstance(slot, dict):
                    continue

                if slot.get("url"):
                    return slot["url"]

                groups = slot.get("texture_groups", [])

                if isinstance(groups, list):
                    for group in groups:
                        if isinstance(group, dict) and group.get("url"):
                            return group["url"]

            for slot in maps.values():
                if not isinstance(slot, dict):
                    continue

                if slot.get("url"):
                    return slot["url"]

                groups = slot.get("texture_groups", [])

                if isinstance(groups, list):
                    for group in groups:
                        if isinstance(group, dict) and group.get("url"):
                            return group["url"]

        uv_faces = package.get("uv", {}).get("faces", {})

        if isinstance(uv_faces, dict):
            for face in ("front", "right", "left", "top", "bottom", "back"):
                face_data = uv_faces.get(face, {})

                if not isinstance(face_data, dict):
                    continue

                bitmap = face_data.get("bitmap", {})

                if isinstance(bitmap, dict) and bitmap.get("url"):
                    return bitmap["url"]

        texture = package.get("texture", {})

        if isinstance(texture, dict) and texture.get("url"):
            return texture["url"]

        return ""

    @classmethod
    def attach_material_to_layer(cls, layer, package):
        primary_url = cls.resolve_primary_preview_url(package)

        layer.update({
            "type": cls.MATERIAL_LAYER_TYPE,
            "renderer": cls.RENDERER,
            "engine": cls.ENGINE,

            "material_id": package["id"],
            "source": package.get("source_layer_id", layer.get("source", "")),
            "source_layer_id": package.get("source_layer_id", ""),

            "name": package.get("name") or layer.get("name") or "Material Cube",

            "surface": package["surface"],
            "geometry": package["geometry"],
            "bitmap_maps": package["bitmap_maps"],
            "uv": package["uv"],
            "shader_graph": package["shader_graph"],

            "material": package["material"],
            "mesh": package["mesh"],
            "shader": package["shader"],
            "texture": {
                **package.get("texture", {}),
                "url": primary_url or package.get("texture", {}).get("url", ""),
            },
            "package": package["package"],
            "preview": package["preview"],
            "settings": package["settings"],

            "url": primary_url or package.get("texture", {}).get("url", "") or layer.get("url", ""),
            "thumbnail": primary_url or package.get("texture", {}).get("url", "") or layer.get("thumbnail", "") or layer.get("url", ""),

            "time": time("unix_ms"),
        })

        return layer

    @classmethod
    def build_preview_layer(cls, source_layer, package):
        width, height = cls.resolve_source_layer_size(
            source_layer,
            package.get("settings", {}).get("cube_size", 256),
        )

        primary_url = cls.resolve_primary_preview_url(package)

        return {
            "id": package["id"],
            "source": package.get("source_layer_id", ""),
            "source_layer_id": package.get("source_layer_id", ""),
            "name": package.get("name", "Cube Material"),
            "type": cls.MATERIAL_LAYER_TYPE,

            "renderer": cls.RENDERER,
            "engine": cls.ENGINE,
            "material_id": package["id"],

            "hidden": 0,
            "width": width,
            "height": height,
            "opacity": source_layer.get("opacity", 1),

            "matrix": source_layer.get("matrix", {
                "a": 1,
                "b": 0,
                "c": 0,
                "d": 1,
                "x": 0,
                "y": 0,
                "rotate": 0,
            }),

            "url": primary_url,
            "thumbnail": primary_url,

            "surface": package["surface"],
            "geometry": package["geometry"],
            "bitmap_maps": package["bitmap_maps"],
            "uv": package["uv"],
            "shader_graph": package["shader_graph"],

            "material": package["material"],
            "mesh": package["mesh"],
            "shader": package["shader"],
            "texture": package["texture"],
            "package": package["package"],
            "preview": package["preview"],
            "settings": package["settings"],

            "time": time("unix_ms"),
        }

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
        values=None,
        **extra,
    ):
        try:
            source_layer = cls.find_layer(source_layer_id)

            if not source_layer:
                return {
                    "error": f"Source layer '{source_layer_id}' not found.",
                }, 404

            material_id = f"preview-{uuid.uuid4()}"

            package = cls.build_material_package(
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
                **extra,
            )

            preview_layer = cls.build_preview_layer(source_layer, package)

            return {
                "id": material_id,
                "title": "material-preview",
                "src": preview_layer.get("url", ""),
                "layer": preview_layer,
                "package": package,
                "contract": {
                    "version": cls.CONTRACT_VERSION,
                    "renderer": cls.RENDERER,
                    "engine": cls.ENGINE,
                },
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def create_cube(
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
        values=None,
        **extra,
    ):
        try:
            source_layer = cls.find_layer(source_layer_id)

            if not source_layer:
                return {
                    "error": f"Source layer '{source_layer_id}' not found.",
                }, 404

            # Wichtig:
            # Hier wird der echte Contract aus values ODER aus den Einzelfeldern gelesen.
            # Danach verwenden wir NUR NOCH payload.
            payload = cls.unpack_material_values(
                values=values,
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
                payload=extra,
            )

            width, height = cls.resolve_source_layer_size(
                source_layer,
                payload.get("cube_size", cube_size),
            )

            source_path = cls.resolve_source_path(source_layer_id)

            add_result, add_status = LayerModel.add(
                name=payload.get("name") or "Material Cube",
                path=source_path,
                id="",
                type=cls.MATERIAL_LAYER_TYPE,
                width=width,
                height=height,
            )

            if add_status != 200:
                return add_result, add_status

            layer = add_result
            layer_id = layer["id"]
            material_id = str(uuid.uuid4())

            package = cls.build_material_package(
                material_id=material_id,
                layer_id=layer_id,
                source_layer_id=source_layer_id,

                name=payload["name"],
                surface=payload["surface"],
                geometry=payload["geometry"],
                bitmap_maps=payload["bitmap_maps"],
                uv=payload["uv"],
                shader_graph=payload["shader_graph"],

                cube_size=payload["cube_size"],
                rotate_preview=payload["rotate_preview"],
                blend_mode=payload["blend_mode"],
                shadow_method=payload["shadow_method"],
                use_nodes=payload["use_nodes"],

                # Wichtig:
                # Full-Contract nochmal mitgeben, damit build_material_package
                # garantiert dieselbe Wahrheit bekommt.
                values=payload,
            )

            cls.attach_material_to_layer(layer, package)

            return {
                "message": "Material Cube erfolgreich erstellt.",
                "id": layer_id,
                "material_id": material_id,
                "layer": layer,
                "package": package,
                "contract": {
                    "version": cls.CONTRACT_VERSION,
                    "renderer": cls.RENDERER,
                    "engine": cls.ENGINE,
                },
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def update(
        cls,
        id="",
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
        values=None,
        **extra,
    ):
        try:
            layer = cls.find_layer(id)

            if not layer:
                return {
                    "error": f"Layer '{id}' not found.",
                }, 404

            if int(layer.get("type", -1)) != cls.MATERIAL_LAYER_TYPE:
                return {
                    "error": f"Layer '{id}' is not a material layer.",
                }, 400

            material_id = (
                layer.get("material_id")
                or layer.get("material", {}).get("id")
                or str(uuid.uuid4())
            )

            source_layer_id = (
                layer.get("source_layer_id")
                or layer.get("source")
                or extra.get("source_layer_id")
                or ""
            )

            package = cls.build_material_package(
                material_id=material_id,
                layer_id=id,
                source_layer_id=source_layer_id,
                name=name or layer.get("name") or "Cube Material",
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
                **extra,
            )

            cls.attach_material_to_layer(layer, package)

            return {
                "message": "Material Layer erfolgreich aktualisiert.",
                "id": id,
                "material_id": material_id,
                "layer": layer,
                "package": package,
                "contract": {
                    "version": cls.CONTRACT_VERSION,
                    "renderer": cls.RENDERER,
                    "engine": cls.ENGINE,
                },
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def export_blender(cls, id=""):
        try:
            layer = cls.find_layer(id)

            if not layer or int(layer.get("type", -1)) != cls.MATERIAL_LAYER_TYPE:
                return {
                    "error": f"Material layer '{id}' not found.",
                }, 404

            return {
                "id": id,
                "material_id": layer.get("material_id"),
                "name": layer.get("name"),
                "material": layer.get("material"),
                "mesh": layer.get("mesh"),
                "surface": layer.get("surface"),
                "geometry": layer.get("geometry"),
                "bitmap_maps": layer.get("bitmap_maps"),
                "uv": layer.get("uv"),
                "shader_graph": layer.get("shader_graph"),
                "shader": layer.get("shader"),
                "texture": layer.get("texture"),
                "package": layer.get("package"),
                "contract": {
                    "version": cls.CONTRACT_VERSION,
                    "renderer": cls.RENDERER,
                    "engine": cls.ENGINE,
                },
            }, 200

        except Exception as e:
            return cls.handle_error(e)