import os
import json
import uuid
import shutil
from PIL import Image

from config.data.constant import LAYERS
from model.base.main import BaseModel
from model.layer_model import LayerModel
from generated.paths import PUBLIC_LAYER_FOLDER, PUBLIC_MATERIAL_FOLDER
from utils import time

from components import apply_resize


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
    "Shader",
    "Texture",
    "UV",
    "Math",
    "Vector",
    "Color",
    "Output",
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
TEXTURE_PRELOAD_OPTIONS = [32, 64, 128, 256, 512, 1024, "Original"]
TEXTURE_SIZE_ORIGINAL = "Original"

TEXTURE_SIZE_TO_RESIZE_INDEX = {
    32: 1,
    64: 2,
    128: 3,
    256: 4,
    512: 5,
    1024: 6,
}

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
            "original_width": int(float(bitmap.get("original_width", 0) or 0)),
            "original_height": int(float(bitmap.get("original_height", 0) or 0)),
            "filename": str(bitmap.get("filename", "") or ""),
            "cached": cls.safe_bool(bitmap.get("cached", False)),
            "missing": cls.safe_bool(bitmap.get("missing", False)),
            "channel": str(bitmap.get("channel", "rgba") or "rgba"),
            "texture_size": cls.normalize_texture_size(bitmap.get("texture_size", TEXTURE_SIZE_ORIGINAL)),
            "texture_lod_key": str(bitmap.get("texture_lod_key", "") or ""),
            "texture_resized": cls.safe_bool(bitmap.get("texture_resized", False)),
        }

    @classmethod
    def normalize_texture_size(cls, value):
        if value in (None, "", 0, "0", "original", "Original", "ORIGINAL"):
            return TEXTURE_SIZE_ORIGINAL

        try:
            number = int(value)
        except Exception:
            return TEXTURE_SIZE_ORIGINAL

        return number if number in TEXTURE_SIZE_TO_RESIZE_INDEX else TEXTURE_SIZE_ORIGINAL

    @classmethod
    def texture_lod_key(cls, texture_size):
        texture_size = cls.normalize_texture_size(texture_size)
        return "original" if texture_size == TEXTURE_SIZE_ORIGINAL else str(texture_size)

    @classmethod
    def resolve_lod_target(cls, image_width, image_height, texture_size):
        texture_size = cls.normalize_texture_size(texture_size)

        if texture_size == TEXTURE_SIZE_ORIGINAL:
            return None

        image_width = max(1, int(image_width or 1))
        image_height = max(1, int(image_height or 1))
        max_edge = int(texture_size)

        if image_width == max_edge or image_height == max_edge:
            # Bereits auf der gewählten Max-Kante.
            # Trotzdem nur "skippen", wenn die andere Kante proportional passt.
            if image_width >= image_height:
                expected_height = max(1, round(max_edge * image_height / image_width))
                if image_width == max_edge and image_height == expected_height:
                    return None
            else:
                expected_width = max(1, round(max_edge * image_width / image_height))
                if image_height == max_edge and image_width == expected_width:
                    return None

        if image_width >= image_height:
            target_width = max_edge
            target_height = max(1, round(max_edge * image_height / image_width))
        else:
            target_width = max(1, round(max_edge * image_width / image_height))
            target_height = max_edge

        if target_width == image_width and target_height == image_height:
            return None

        return target_width, target_height

    @classmethod
    def resize_texture_image(cls, source_path, target_path, texture_size):
        texture_size = cls.normalize_texture_size(texture_size)

        with Image.open(source_path) as image:
            image = image.convert("RGBA")
            original_width, original_height = image.size

            target_size = cls.resolve_lod_target(
                original_width,
                original_height,
                texture_size,
            )

            if target_size:
                target_width, target_height = target_size

                resized = apply_resize(
                    image=image,
                    resize_index=0,
                    resize_mode=1,
                    upscale_method=1,
                    resize_width=target_width,
                    resize_height=target_height,
                    resize_keep_aspect_ratio=1,
                    resize_is_custom=1,
                )
            else:
                resized = image

            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            resized.save(target_path, "PNG")

            width, height = resized.size

        return {
            "width": int(width),
            "height": int(height),
            "original_width": int(original_width),
            "original_height": int(original_height),
            "texture_size": texture_size,
            "texture_lod_key": cls.texture_lod_key(texture_size),
            "texture_resized": texture_size != TEXTURE_SIZE_ORIGINAL and (
                int(width) != int(original_width) or int(height) != int(original_height)
            ),
        }

    @classmethod
    def copy_source_texture(
        cls,
        material_id,
        source_layer_id="",
        texture_url="",
        suffix="base_color",
        texture_size=TEXTURE_SIZE_ORIGINAL,
        force=False,
    ):
        cls.ensure_dirs()

        texture_size = cls.normalize_texture_size(texture_size)
        lod_key = cls.texture_lod_key(texture_size)

        texture_url = cls.normalize_texture_url(texture_url)
        source_path = ""

        # Wichtig: Original-Layer bevorzugen, damit nicht von bereits gecachten LODs
        # erneut skaliert wird.
        if source_layer_id:
            possible_path = os.path.join(
                PUBLIC_LAYER_FOLDER,
                f"{source_layer_id}.png",
            )

            if os.path.exists(possible_path):
                source_path = possible_path

        if not source_path and texture_url and cls.is_download_url(texture_url):
            possible_path = cls.public_download_url_to_path(texture_url)

            if possible_path and os.path.exists(possible_path):
                source_path = possible_path

        if not source_path:
            resolved = texture_url or cls.resolve_layer_bitmap(source_layer_id)

            return {
                "url": resolved,
                "filename": "",
                "cached": False,
                "missing": not bool(resolved),
                "path": "",
                "width": 0,
                "height": 0,
                "original_width": 0,
                "original_height": 0,
                "texture_size": texture_size,
                "texture_lod_key": lod_key,
                "texture_resized": False,
            }

        filename = f"{suffix}_{lod_key}.png"
        target_folder = cls.material_folder(material_id)
        target_path = os.path.join(target_folder, filename)

        os.makedirs(target_folder, exist_ok=True)

        if force or not os.path.exists(target_path):
            resize_meta = cls.resize_texture_image(
                source_path=source_path,
                target_path=target_path,
                texture_size=texture_size,
            )
        else:
            with Image.open(target_path) as image:
                width, height = image.size

            with Image.open(source_path) as source_image:
                original_width, original_height = source_image.size

            resize_meta = {
                "width": int(width),
                "height": int(height),
                "original_width": int(original_width),
                "original_height": int(original_height),
                "texture_size": texture_size,
                "texture_lod_key": lod_key,
                "texture_resized": texture_size != TEXTURE_SIZE_ORIGINAL and (
                    int(width) != int(original_width) or int(height) != int(original_height)
                ),
            }

        if not os.path.exists(target_path):
            return {
                "url": texture_url or cls.resolve_layer_bitmap(source_layer_id),
                "filename": "",
                "cached": False,
                "missing": True,
                "path": target_path,
                **resize_meta,
            }

        return {
            "url": cls.make_material_url(material_id, filename),
            "filename": filename,
            "cached": True,
            "missing": False,
            "path": target_path,
            **resize_meta,
        }

    @classmethod
    def cache_bitmap_payload(
        cls,
        material_id,
        bitmap,
        suffix,
        texture_size=TEXTURE_SIZE_ORIGINAL,
    ):
        payload = cls.resolve_bitmap_payload(bitmap)
        texture_size = cls.normalize_texture_size(texture_size)
        lod_key = cls.texture_lod_key(texture_size)

        if not payload.get("url") and not payload.get("layer_id"):
            payload.update({
                "texture_size": texture_size,
                "texture_lod_key": lod_key,
                "texture_resized": False,
            })
            return payload

        already_scaled = (
            payload.get("cached") is True
            and str(payload.get("texture_lod_key", "")) == lod_key
            and cls.normalize_texture_size(payload.get("texture_size")) == texture_size
        )

        cached = cls.copy_source_texture(
            material_id=material_id,
            source_layer_id=payload.get("layer_id", ""),
            texture_url=payload.get("url", ""),
            suffix=suffix,
            texture_size=texture_size,
            force=not already_scaled,
        )

        if cached.get("url"):
            payload["url"] = cached["url"]

        payload["filename"] = cached.get("filename", "")
        payload["cached"] = cached.get("cached", False)
        payload["missing"] = cached.get("missing", False)
        payload["path"] = cached.get("path", "")

        payload["width"] = cached.get("width", payload.get("width", 0))
        payload["height"] = cached.get("height", payload.get("height", 0))
        payload["original_width"] = cached.get("original_width", payload.get("original_width", 0))
        payload["original_height"] = cached.get("original_height", payload.get("original_height", 0))

        payload["texture_size"] = cached.get("texture_size", texture_size)
        payload["texture_lod_key"] = cached.get("texture_lod_key", lod_key)
        payload["texture_resized"] = cached.get("texture_resized", False)

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
            "width": 0,
            "height": 0,
            "original_width": 0,
            "original_height": 0,

            "texture_size": TEXTURE_SIZE_ORIGINAL,
            "texture_lod_key": "",
            "texture_resized": False,

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
                    "width": int(float(incoming.get("width", 0) or 0)),
                    "height": int(float(incoming.get("height", 0) or 0)),
                    "original_width": int(float(incoming.get("original_width", 0) or 0)),
                    "original_height": int(float(incoming.get("original_height", 0) or 0)),

                    "texture_size": cls.normalize_texture_size(
                        incoming.get("texture_size", TEXTURE_SIZE_ORIGINAL)
                    ),
                    "texture_lod_key": str(incoming.get("texture_lod_key", "") or ""),
                    "texture_resized": cls.safe_bool(incoming.get("texture_resized", False)),

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
                            "width": int(float(group.get("width", 0) or 0)),
                            "height": int(float(group.get("height", 0) or 0)),
                            "original_width": int(float(group.get("original_width", 0) or 0)),
                            "original_height": int(float(group.get("original_height", 0) or 0)),
                            "texture_size": cls.normalize_texture_size(
                                group.get("texture_size", slot.get("texture_size", TEXTURE_SIZE_ORIGINAL))
                            ),
                            "texture_lod_key": str(group.get("texture_lod_key", "") or ""),
                            "texture_resized": cls.safe_bool(group.get("texture_resized", False)),
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

        islands = data.get("islands", [])
        vertices = data.get("vertices", [])
        edges = data.get("edges", [])
        triangles = data.get("triangles", [])
        seams = data.get("seams", [])

        return {
            "mode": data.get("mode", "cubemap"),
            "view_mode": data.get("view_mode", "cubemap"),
            "active_face": active_face,
            "selected_faces": selected_faces,
            "atlas": data.get("atlas", "cross"),
            "target_slot": target_slots[0],
            "target_slots": target_slots,
            "faces": faces,
            "tool": data.get("tool", "select"),
            "unwrap_mode": data.get("unwrap_mode", "primitive"),
            "unwrap_projection": data.get("unwrap_projection", "primitive"),
            "unwrap_padding": cls.clamp(data.get("unwrap_padding", 0.015), 0.0, 0.25),
            "unwrap_normalize": cls.safe_bool(data.get("unwrap_normalize", True)),
            "unwrap_pack": cls.safe_bool(data.get("unwrap_pack", True)),
            "active_island_id": str(data.get("active_island_id", "") or ""),
            "selected_island_ids": data.get("selected_island_ids", []) if isinstance(data.get("selected_island_ids", []), list) else [],
            "selected_vertex_ids": data.get("selected_vertex_ids", []) if isinstance(data.get("selected_vertex_ids", []), list) else [],
            "selected_edge_ids": data.get("selected_edge_ids", []) if isinstance(data.get("selected_edge_ids", []), list) else [],
            "selected_seam_ids": data.get("selected_seam_ids", []) if isinstance(data.get("selected_seam_ids", []), list) else [],
            "islands": islands if isinstance(islands, list) else [],
            "vertices": vertices if isinstance(vertices, list) else [],
            "edges": edges if isinstance(edges, list) else [],
            "triangles": triangles if isinstance(triangles, list) else [],
            "seams": seams if isinstance(seams, list) else [],
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
    def cache_uv_textures(
        cls,
        material_id,
        uv,
        texture_size=TEXTURE_SIZE_ORIGINAL,
    ):
        if not isinstance(uv, dict):
            return uv

        faces = uv.get("faces", {})

        if not isinstance(faces, dict):
            return uv

        texture_size = cls.normalize_texture_size(texture_size)
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
            cache_key = f"{original_url or layer_id}::{cls.texture_lod_key(texture_size)}"

            if not original_url and not layer_id:
                continue

            if cache_key not in url_cache:
                url_cache[cache_key] = cls.cache_bitmap_payload(
                    material_id=material_id,
                    bitmap=bitmap,
                    suffix=f"uv_{face}",
                    texture_size=texture_size,
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

                    "width": group.get("width", 0),
                    "height": group.get("height", 0),
                    "original_width": group.get("original_width", 0),
                    "original_height": group.get("original_height", 0),
                    "texture_size": group.get("texture_size", slot.get("texture_size", TEXTURE_SIZE_ORIGINAL)),
                    "texture_lod_key": group.get("texture_lod_key", ""),
                    "texture_resized": group.get("texture_resized", False)
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
                    "width": group.get("width", 0),
                    "height": group.get("height", 0),
                    "original_width": group.get("original_width", 0),
                    "original_height": group.get("original_height", 0),
                    "texture_size": group.get("texture_size", slot.get("texture_size", TEXTURE_SIZE_ORIGINAL)),
                    "texture_lod_key": group.get("texture_lod_key", ""),
                    "texture_resized": group.get("texture_resized", False),
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
    def cache_graph_bitmap(
        cls,
        material_id,
        settings,
        suffix,
        texture_size=TEXTURE_SIZE_ORIGINAL,
    ):
        bitmap = {
            "layer_id": settings.get("layer_id", ""),
            "url": settings.get("url", ""),
            "name": settings.get("name", ""),
            "width": settings.get("width", 0),
            "height": settings.get("height", 0),
            "original_width": settings.get("original_width", 0),
            "original_height": settings.get("original_height", 0),
            "filename": settings.get("filename", ""),
            "cached": settings.get("cached", False),
            "missing": settings.get("missing", False),
            "channel": settings.get("channel", "rgba"),
            "texture_size": settings.get("texture_size", texture_size),
            "texture_lod_key": settings.get("texture_lod_key", ""),
            "texture_resized": settings.get("texture_resized", False),
        }

        cached = cls.cache_bitmap_payload(
            material_id,
            bitmap,
            suffix,
            texture_size=texture_size,
        )

        settings.update({
            "layer_id": cached.get("layer_id", settings.get("layer_id", "")),
            "url": cached.get("url", settings.get("url", "")),
            "name": cached.get("name", settings.get("name", "")),
            "filename": cached.get("filename", settings.get("filename", "")),
            "cached": cached.get("cached", False),
            "missing": cached.get("missing", False),

            "width": cached.get("width", settings.get("width", 0)),
            "height": cached.get("height", settings.get("height", 0)),
            "original_width": cached.get("original_width", settings.get("original_width", 0)),
            "original_height": cached.get("original_height", settings.get("original_height", 0)),
            "texture_size": cached.get("texture_size", texture_size),
            "texture_lod_key": cached.get("texture_lod_key", ""),
            "texture_resized": cached.get("texture_resized", False),
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

            "width": settings.get("width", 0),
            "height": settings.get("height", 0),
            "original_width": settings.get("original_width", 0),
            "original_height": settings.get("original_height", 0),
            "texture_size": settings.get("texture_size", texture_size),
            "texture_lod_key": settings.get("texture_lod_key", ""),
            "texture_resized": settings.get("texture_resized", False),
        }

    @classmethod
    def resolve_graph_source(cls, material_id, nodes, incoming, node_id, socket="", seen=None, texture_size=TEXTURE_SIZE_ORIGINAL):
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
                texture_size=texture_size,
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
                    texture_size=texture_size,
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
                        texture_size=texture_size,
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
                        "width": group_settings.get("width", 0),
                        "height": group_settings.get("height", 0),
                        "original_width": group_settings.get("original_width", 0),
                        "original_height": group_settings.get("original_height", 0),
                        "texture_size": group_settings.get("texture_size", texture_size),
                        "texture_lod_key": group_settings.get("texture_lod_key", ""),
                        "texture_resized": group_settings.get("texture_resized", False),
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
            texture_size=texture_size,
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
    def resolve_shader_graph_slots(cls,material_id,shader_graph,bitmap_maps,texture_size=TEXTURE_SIZE_ORIGINAL):
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
                texture_size=texture_size
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
                "width": resolved.get("width", current.get("width", 0)),
                "height": resolved.get("height", current.get("height", 0)),
                "original_width": resolved.get("original_width", current.get("original_width", 0)),
                "original_height": resolved.get("original_height", current.get("original_height", 0)),
                "texture_size": resolved.get("texture_size", current.get("texture_size", texture_size)),
                "texture_lod_key": resolved.get("texture_lod_key", current.get("texture_lod_key", "")),
                "texture_resized": resolved.get("texture_resized", current.get("texture_resized", False)),
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
                    "width": slot.get("width", 0),
                    "height": slot.get("height", 0),
                    "original_width": slot.get("original_width", 0),
                    "original_height": slot.get("original_height", 0),
                    "texture_size": slot.get("texture_size", TEXTURE_SIZE_ORIGINAL),
                    "texture_lod_key": slot.get("texture_lod_key", ""),
                    "texture_resized": slot.get("texture_resized", False),
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
                        "width": group.get("width", 0),
                        "height": group.get("height", 0),
                        "original_width": group.get("original_width", 0),
                        "original_height": group.get("original_height", 0),
                        "texture_size": group.get("texture_size", TEXTURE_SIZE_ORIGINAL),
                        "texture_lod_key": group.get("texture_lod_key", ""),
                        "texture_resized": group.get("texture_resized", False),
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
                    "width": primary_map.get("width", 0),
                    "height": primary_map.get("height", 0),
                    "original_width": primary_map.get("original_width", 0),
                    "original_height": primary_map.get("original_height", 0),
                    "texture_size": primary_map.get("texture_size", TEXTURE_SIZE_ORIGINAL),
                    "texture_lod_key": primary_map.get("texture_lod_key", ""),
                    "texture_resized": primary_map.get("texture_resized", False),
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
            width=0,
            height=0,
            original_width=0,
            original_height=0,
            texture_size=TEXTURE_SIZE_ORIGINAL,
            texture_lod_key="",
            texture_resized=False,
        ):
            if not url:
                return

            if url in by_url:
                existing = by_url[url]
                existing_faces = set(existing.get("faces", []))
                existing["faces"] = list(existing_faces.union(faces or []))

                # Fehlende Metadaten nachziehen, falls dieselbe URL zuerst ohne Meta kam.
                if not existing.get("width") and width:
                    existing["width"] = width

                if not existing.get("height") and height:
                    existing["height"] = height

                if not existing.get("original_width") and original_width:
                    existing["original_width"] = original_width

                if not existing.get("original_height") and original_height:
                    existing["original_height"] = original_height

                if not existing.get("texture_lod_key") and texture_lod_key:
                    existing["texture_lod_key"] = texture_lod_key

                if existing.get("texture_size") in ("", None, TEXTURE_SIZE_ORIGINAL) and texture_size:
                    existing["texture_size"] = texture_size

                existing["texture_resized"] = (
                    existing.get("texture_resized", False) or bool(texture_resized)
                )

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

                "width": int(float(width or 0)),
                "height": int(float(height or 0)),
                "original_width": int(float(original_width or 0)),
                "original_height": int(float(original_height or 0)),
                "texture_size": cls.normalize_texture_size(texture_size),
                "texture_lod_key": str(texture_lod_key or ""),
                "texture_resized": cls.safe_bool(texture_resized),
            }

            by_url[url] = item
            textures.append(item)

        # UV face bitmaps
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

                width=bitmap.get("width", 0),
                height=bitmap.get("height", 0),
                original_width=bitmap.get("original_width", 0),
                original_height=bitmap.get("original_height", 0),
                texture_size=bitmap.get("texture_size", TEXTURE_SIZE_ORIGINAL),
                texture_lod_key=bitmap.get("texture_lod_key", ""),
                texture_resized=bitmap.get("texture_resized", False),
            )

        # Shader graph nodes
        for node in (shader_graph.get("nodes", []) if isinstance(shader_graph, dict) else []):
            if not isinstance(node, dict):
                continue

            settings = node.get("settings", {})

            if not isinstance(settings, dict):
                settings = {}

            # MultiTexture / grouped textures in shader nodes
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
                        slot=group.get("slot", settings.get("slot", "")),

                        width=group.get("width", 0),
                        height=group.get("height", 0),
                        original_width=group.get("original_width", 0),
                        original_height=group.get("original_height", 0),
                        texture_size=group.get(
                            "texture_size",
                            settings.get("texture_size", TEXTURE_SIZE_ORIGINAL),
                        ),
                        texture_lod_key=group.get(
                            "texture_lod_key",
                            settings.get("texture_lod_key", ""),
                        ),
                        texture_resized=group.get(
                            "texture_resized",
                            settings.get("texture_resized", False),
                        ),
                    )

            # Single bitmap node
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

                    width=settings.get("width", 0),
                    height=settings.get("height", 0),
                    original_width=settings.get("original_width", 0),
                    original_height=settings.get("original_height", 0),
                    texture_size=settings.get("texture_size", TEXTURE_SIZE_ORIGINAL),
                    texture_lod_key=settings.get("texture_lod_key", ""),
                    texture_resized=settings.get("texture_resized", False),
                )

        # Material bitmap maps / surface slots
        if isinstance(bitmap_maps, dict):
            for slot_key, slot in bitmap_maps.items():
                if not isinstance(slot, dict):
                    continue

                # Slot texture groups
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

                            width=group.get("width", 0),
                            height=group.get("height", 0),
                            original_width=group.get("original_width", 0),
                            original_height=group.get("original_height", 0),
                            texture_size=group.get(
                                "texture_size",
                                slot.get("texture_size", TEXTURE_SIZE_ORIGINAL),
                            ),
                            texture_lod_key=group.get(
                                "texture_lod_key",
                                slot.get("texture_lod_key", ""),
                            ),
                            texture_resized=group.get(
                                "texture_resized",
                                slot.get("texture_resized", False),
                            ),
                        )

                # Direct single slot texture
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

                        width=slot.get("width", 0),
                        height=slot.get("height", 0),
                        original_width=slot.get("original_width", 0),
                        original_height=slot.get("original_height", 0),
                        texture_size=slot.get("texture_size", TEXTURE_SIZE_ORIGINAL),
                        texture_lod_key=slot.get("texture_lod_key", ""),
                        texture_resized=slot.get("texture_resized", False),
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
    def normalize_mesh(cls, mesh, fallback):
        data = json_loads(mesh, {})

        if not isinstance(data, dict):
            return fallback

        vertices = data.get("vertices", [])
        indices = data.get("indices", [])

        if not isinstance(vertices, list) or not isinstance(indices, list):
            return fallback

        try:
            flat_vertices = [float(value) for value in vertices]
            flat_indices = [max(0, int(value)) for value in indices]
        except (TypeError, ValueError):
            return fallback

        stride = int(data.get("stride", 11) or 11)

        if stride < 8 or len(flat_vertices) < stride * 3 or len(flat_indices) < 3:
            return fallback

        max_index = max(flat_indices) if flat_indices else 0

        return {
            **data,
            "id": str(data.get("id", "") or fallback.get("id", "material-mesh")),
            "primitive": str(data.get("primitive", fallback.get("primitive", "cube")) or "cube"),
            "stride": stride,
            "vertices": flat_vertices,
            "indices": flat_indices,
            "indexType": "uint32" if data.get("indexType") == "uint32" or max_index > 65535 else "uint16",
            "count": int(data.get("count", len(flat_indices)) or len(flat_indices)),
            "parts": data.get("parts", []) if isinstance(data.get("parts", []), list) else [],
            "settings": data.get("settings", {}) if isinstance(data.get("settings", {}), dict) else {},
            "bounds": data.get("bounds", {}) if isinstance(data.get("bounds", {}), dict) else {},
            "meta": data.get("meta", {}) if isinstance(data.get("meta", {}), dict) else {},
        }

    @classmethod
    def normalize_particle_system(cls, particle_system):
        data = json_loads(particle_system, {})

        if not isinstance(data, dict):
            data = {}

        particles = data.get("particles", {})
        if not isinstance(particles, dict):
            particles = {}

        interpolation_defaults = {
            "lifetime": [{"x": 0, "y": 1}, {"x": 0.5, "y": 1}, {"x": 1, "y": 1}],
            "size_x": [{"x": 0, "y": 1}, {"x": 0.5, "y": 1}, {"x": 1, "y": 1}],
            "size_y": [{"x": 0, "y": 1}, {"x": 0.5, "y": 1}, {"x": 1, "y": 1}],
            "alpha": [{"x": 0, "y": 1}, {"x": 0.5, "y": 1}, {"x": 1, "y": 1}],
            "gravity": [{"x": 0, "y": 0}, {"x": 0.5, "y": 0}, {"x": 1, "y": 0}],
            "velocity": [{"x": 0, "y": 0}, {"x": 0.5, "y": 0}, {"x": 1, "y": 0}],
        }
        interpolation_attributes = set(interpolation_defaults.keys())
        incoming_interpolations = data.get("interpolations", {})
        if not isinstance(incoming_interpolations, dict):
            incoming_interpolations = {}

        def clamp_value(value, minimum, maximum, fallback=0):
            try:
                number = float(value)
            except (TypeError, ValueError):
                number = fallback
            return max(minimum, min(maximum, number))

        def clamp_int(value, minimum, maximum, fallback=0):
            return int(clamp_value(value, minimum, maximum, fallback))

        lifetime_value = clamp_value(data.get("lifetime", 1), 0.1, 60, 1)
        path_follow_data = data.get("path_follow", {})
        if not isinstance(path_follow_data, dict):
            path_follow_data = {}

        def default_interpolation_points(value):
            return [
                {"x": 0, "y": value},
                {"x": lifetime_value / 2, "y": value},
                {"x": lifetime_value, "y": value},
            ]

        def normalize_interpolation_points(key, default_points):
            points = (
                incoming_interpolations.get(key)
                if isinstance(incoming_interpolations.get(key), list)
                else default_points
            )
            normalized = [
                {
                    "x": clamp_value(point.get("x", 0), 0, lifetime_value, 0),
                    "y": clamp_value(point.get("y", 0), -1000, 1000, 0),
                }
                for point in points
                if isinstance(point, dict)
            ]

            if normalized:
                return sorted(normalized, key=lambda item: item.get("x", 0))

            fallback_y = default_points[0].get("y", 0) if default_points else 0
            return default_interpolation_points(fallback_y)

        def vector_payload(source, fallback=None):
            fallback = fallback or {}
            if not isinstance(source, dict):
                source = {}

            return {
                "x": clamp_value(source.get("x", fallback.get("x", 0)), -1000, 1000, fallback.get("x", 0)),
                "y": clamp_value(source.get("y", fallback.get("y", 0)), -1000, 1000, fallback.get("y", 0)),
                "z": clamp_value(source.get("z", fallback.get("z", 0)), -1000, 1000, fallback.get("z", 0)),
            }

        def path_point_payload(point, fallback_t=0, index=0):
            if not isinstance(point, dict):
                point = {}

            return {
                "id": str(point.get("id", "") or f"path-point-{index}"),
                "t": clamp_value(point.get("t", fallback_t), 0, lifetime_value, fallback_t),
                "translate": vector_payload(point.get("translate", {}), {"x": 0, "y": 0, "z": 0}),
            }

        path_points = path_follow_data.get("points", [])
        if not isinstance(path_points, list):
            path_points = []
        normalized_path_points = [
            path_point_payload(point, index=index)
            for index, point in enumerate(path_points)
            if isinstance(point, dict)
        ]
        if not normalized_path_points:
            normalized_path_points = [
                path_point_payload({"t": 0}, 0, 0),
                path_point_payload({"t": lifetime_value, "translate": {"x": 0, "y": 0.35, "z": 0.2}}, lifetime_value, 1),
            ]
        normalized_path_points = sorted(normalized_path_points, key=lambda item: item.get("t", 0))
        incoming_layers = data.get("layers", [])
        if not isinstance(incoming_layers, list) or not incoming_layers:
            incoming_layers = [{
                "id": "particle-layer-default",
                "name": "Default Layer",
                "texture_slot": data.get("texture_slot", "baseColor"),
                "layer_id": "",
                "url": "",
            }]

        normalized_layers = []
        for index, layer in enumerate(incoming_layers):
            if not isinstance(layer, dict):
                continue

            normalized_layers.append({
                "id": str(layer.get("id", "") or f"particle-layer-{index}"),
                "name": str(layer.get("name", "") or ("Default Layer" if index == 0 else f"Layer {index + 1}")),
                "texture_slot": str(layer.get("texture_slot", data.get("texture_slot", "baseColor")) or "baseColor"),
                "layer_id": str(layer.get("layer_id", "") or ""),
                "url": str(layer.get("url", "") or ""),
            })

        if not normalized_layers:
            normalized_layers = [{
                "id": "particle-layer-default",
                "name": "Default Layer",
                "texture_slot": str(data.get("texture_slot", "baseColor") or "baseColor"),
                "layer_id": "",
                "url": "",
            }]

        active_layer_id = str(data.get("active_layer_id", "") or normalized_layers[0]["id"])
        active_layer = next((layer for layer in normalized_layers if layer["id"] == active_layer_id), normalized_layers[0])

        return {
            "id": str(data.get("id", "") or "particle-system"),
            "version": int(data.get("version", 1) or 1),
            "enabled": cls.safe_bool(data.get("enabled", False)),
            "mode": str(data.get("mode", "texture") or "texture"),
            "source": str(data.get("source", "texture") or "texture"),
            "emitter": str(data.get("emitter", "volume") or "volume"),
            "root_animation": str(data.get("root_animation", "inner") or "inner")
            if str(data.get("root_animation", "inner") or "inner") in {"point", "inner", "outer"} else "inner",
            "texture_slot": str(active_layer.get("texture_slot", data.get("texture_slot", "baseColor")) or "baseColor"),
            "count": clamp_int(data.get("count", 320), 1, 5000, 320),
            "seed": clamp_int(data.get("seed", 1337), 1, 9999999, 1337),
            "lifetime": lifetime_value,
            "age": clamp_value(data.get("age", 1.2), 0, 60, 1.2),
            "time_scale": clamp_value(data.get("time_scale", 1), 0, 8, 1),
            "size": clamp_value(data.get("size", 18), 1, 120, 18),
            "radius": clamp_value(data.get("radius", 1), 0.001, 50, 1),
            "random_size": cls.safe_bool(data.get("random_size", data.get("randomSize", False))),
            "size_randomness": clamp_value(data.get("size_randomness", 0), 0, 1, 0),
            "size_x": clamp_value(data.get("size_x", 1), 0.001, 20, 1),
            "size_y": clamp_value(data.get("size_y", 1), 0.001, 20, 1),
            "alpha": clamp_value(data.get("alpha", 1), 0, 1, 1),
            "spread_x": clamp_value(data.get("spread_x", 1), 0.001, 20, 1),
            "spread_y": clamp_value(data.get("spread_y", 1), 0.001, 20, 1),
            "spread_z": clamp_value(data.get("spread_z", 1), 0.001, 20, 1),
            "velocity": clamp_value(data.get("velocity", 0), -10, 10, 0),
            "velocity_x": clamp_value(data.get("velocity_x", 0), -10, 10, 0),
            "velocity_y": clamp_value(data.get("velocity_y", 0), -10, 10, 0),
            "velocity_z": clamp_value(data.get("velocity_z", 0), -10, 10, 0),
            "direction_x": clamp_value(data.get("direction_x", 0), -50, 50, 0),
            "direction_y": clamp_value(data.get("direction_y", 0), -50, 50, 0),
            "direction_z": clamp_value(data.get("direction_z", 0), -50, 50, 0),
            "rotation": clamp_value(data.get("rotation", 0), -360, 360, 0),
            "velocity_randomness": clamp_value(data.get("velocity_randomness", 0), 0, 10, 0),
            "gravity": clamp_value(data.get("gravity", 0), -10, 10, 0),
            "turbulence": clamp_value(data.get("turbulence", 0.22), 0, 10, 0.22),
            "orbit": clamp_value(data.get("orbit", 0.18), -10, 10, 0.18),
            "mesh_influence": clamp_value(data.get("mesh_influence", 0.65), 0, 1, 0.65),
            "color": data.get("color", [1, 1, 1, 1]) if isinstance(data.get("color", []), list) else [1, 1, 1, 1],
            "color_ramp": data.get("color_ramp", []) if isinstance(data.get("color_ramp", []), list) else [],
            "blend": str(data.get("blend", "alpha") or "alpha"),
            "depth_write": cls.safe_bool(data.get("depth_write", False)),
            "sort": data.get("sort", True) is not False,
            "use_mesh_reference": cls.safe_bool(data.get("use_mesh_reference", False)),
            "interpolation_attribute": str(data.get("interpolation_attribute", "alpha") or "alpha")
            if str(data.get("interpolation_attribute", "alpha") or "alpha") in interpolation_attributes else "alpha",
            "interpolations": {
                key: normalize_interpolation_points(key, default_interpolation_points(default_points[0].get("y", 0)))
                for key, default_points in interpolation_defaults.items()
            },
            "path_follow": {
                "enabled": cls.safe_bool(path_follow_data.get("enabled", False)),
                "active_point_id": str(
                    path_follow_data.get("active_point_id", "")
                    or normalized_path_points[0].get("id", "")
                ),
                "points": normalized_path_points,
            },
            "active_layer_id": active_layer.get("id", "particle-layer-default"),
            "layers": normalized_layers,
            "particles": {
                "stride": int(particles.get("stride", 12) or 12),
                "count": clamp_int(particles.get("count", data.get("count", 320)), 0, 5000, 0),
                "positions": particles.get("positions", []) if isinstance(particles.get("positions", []), list) else [],
                "sizes": particles.get("sizes", []) if isinstance(particles.get("sizes", []), list) else [],
                "scales": particles.get("scales", []) if isinstance(particles.get("scales", []), list) else [],
                "alphas": particles.get("alphas", []) if isinstance(particles.get("alphas", []), list) else [],
                "phases": particles.get("phases", []) if isinstance(particles.get("phases", []), list) else [],
                "rotations": particles.get("rotations", []) if isinstance(particles.get("rotations", []), list) else [],
                "colors": particles.get("colors", []) if isinstance(particles.get("colors", []), list) else [],
                "compact": cls.safe_bool(particles.get("compact", False)),
            },
            "meta": data.get("meta", {}) if isinstance(data.get("meta", {}), dict) else {},
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
        texture_size=TEXTURE_SIZE_ORIGINAL
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
                "texture_size": texture_size,
                "texture_lod_key": cls.texture_lod_key(texture_size)
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
        texture_size=TEXTURE_SIZE_ORIGINAL,
        **fallbacks
    ):
        raw_values = values if isinstance(values, dict) else json_loads(values, {})

        if not isinstance(raw_values, dict):
            raw_values = {}

        surface_data = raw_values.get("surface", surface)
        geometry_data = raw_values.get("geometry", geometry)
        bitmap_maps_data = raw_values.get("bitmap_maps", bitmap_maps)
        uv_data = raw_values.get("uv", uv)
        shader_graph_data = raw_values.get("shader_graph", shader_graph)
        mesh_data = raw_values.get("mesh", fallbacks.get("mesh", {}))
        particle_system_data = raw_values.get("particle_system", fallbacks.get("particle_system", {}))

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

        if not isinstance(mesh_data, dict):
            mesh_data = json_loads(mesh_data, {})

        if not isinstance(particle_system_data, dict):
            particle_system_data = json_loads(particle_system_data, {})

        resolved = {
            "name": raw_values.get("name", name or "Cube Material"),

            "surface": surface_data if isinstance(surface_data, dict) else {},
            "geometry": geometry_data if isinstance(geometry_data, dict) else {},
            "bitmap_maps": bitmap_maps_data if isinstance(bitmap_maps_data, dict) else {},
            "uv": uv_data if isinstance(uv_data, dict) else {},
            "shader_graph": shader_graph_data if isinstance(shader_graph_data, dict) else {},
            "mesh": mesh_data if isinstance(mesh_data, dict) else {},
            "particle_system": particle_system_data if isinstance(particle_system_data, dict) else {},

            "cube_size": raw_values.get("cube_size", cube_size),
            "rotate_preview": raw_values.get("rotate_preview", rotate_preview),
            "blend_mode": raw_values.get("blend_mode", blend_mode or "BLEND"),
            "shadow_method": raw_values.get("shadow_method", shadow_method or "HASHED"),
            "use_nodes": raw_values.get("use_nodes", use_nodes),
            "texture_size": cls.normalize_texture_size(raw_values.get("texture_size", raw_values.get("TEXTURE_SIZE",fallbacks.get("texture_size", texture_size))))
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
        texture_size=TEXTURE_SIZE_ORIGINAL,
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
            texture_size=texture_size,
            **extra
        )

        material_id = material_id or str(uuid.uuid4())

        normalized_surface = cls.normalize_surface(payload["surface"])
        normalized_geometry = cls.normalize_geometry(payload["geometry"])
        normalized_uv = cls.normalize_uv(payload["uv"])

        texture_size = cls.normalize_texture_size(payload.get("texture_size", TEXTURE_SIZE_ORIGINAL))

        normalized_uv = cls.cache_uv_textures(
            material_id=material_id,
            uv=normalized_uv,
            texture_size=texture_size
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
            texture_size=texture_size
        )

        normalized_graph = cls.sync_shader_graph_texture_refs(
            normalized_graph,
            normalized_maps,
            normalized_uv,
        )

        fallback_mesh = cls.build_low_poly_cube_mesh(
            cube_size=payload["cube_size"],
            geometry=normalized_geometry,
        )
        mesh = cls.normalize_mesh(payload.get("mesh", {}), fallback_mesh)
        particle_system = cls.normalize_particle_system(payload.get("particle_system", {}))
        preview_rotate = bool(payload["rotate_preview"]) and not bool(particle_system.get("enabled", False))

        shader = cls.build_shader_payload(
            surface=normalized_surface,
            geometry=normalized_geometry,
            bitmap_maps=normalized_maps,
            uv=normalized_uv,
            shader_graph=normalized_graph,
        )
        shader["particle_system"] = particle_system

        primary_url = cls.resolve_primary_preview_url({
            "bitmap_maps": normalized_maps,
            "uv": normalized_uv,
            "texture": {},
        })

        texture = {
            "url": primary_url,
            "thumbnail": primary_url,
            "lod_url": primary_url,
            "filename": "",
            "texture_size": texture_size,
            "texture_lod_key": cls.texture_lod_key(texture_size),
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
            texture_size=texture_size,
        )
        material["particle_system"] = particle_system

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
            "particle_system": particle_system,

            "texture": texture,
            "material": material,
            "mesh": mesh,
            "shader": shader,

            "preview": {
                "rotate": preview_rotate,
                "idle_rotation": {
                    "enabled": preview_rotate,
                    "speed": 0.006,
                    "tilt": 0.42,
                },
            },

            "settings": {
                "blend_mode": payload["blend_mode"],
                "shadow_method": payload["shadow_method"],
                "use_nodes": bool(payload["use_nodes"]),
                "texture_size": texture_size,
                "texture_preload": TEXTURE_PRELOAD_OPTIONS,
                "cube_size": payload["cube_size"]
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
        texture_size = cls.normalize_texture_size(
            package.get("settings", {}).get(
                "texture_size",
                package.get("texture", {}).get("texture_size", TEXTURE_SIZE_ORIGINAL),
            )
        )
        lod_key = cls.texture_lod_key(texture_size)

        def is_matching_lod(item):
            if not isinstance(item, dict) or not item.get("url"):
                return False

            item_lod_key = str(item.get("texture_lod_key", "") or "")

            if item_lod_key:
                return item_lod_key == lod_key

            # Für alte Daten ohne Flag: Original darf noch akzeptiert werden.
            return texture_size == TEXTURE_SIZE_ORIGINAL

        def get_url(item):
            return item.get("url", "") if isinstance(item, dict) else ""

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

                if is_matching_lod(slot):
                    return get_url(slot)

                groups = slot.get("texture_groups", [])

                if isinstance(groups, list):
                    for group in groups:
                        if is_matching_lod(group):
                            return get_url(group)

            for slot in maps.values():
                if not isinstance(slot, dict):
                    continue

                if is_matching_lod(slot):
                    return get_url(slot)

                groups = slot.get("texture_groups", [])

                if isinstance(groups, list):
                    for group in groups:
                        if is_matching_lod(group):
                            return get_url(group)

        uv_faces = package.get("uv", {}).get("faces", {})

        if isinstance(uv_faces, dict):
            for face in ("front", "right", "left", "top", "bottom", "back"):
                face_data = uv_faces.get(face, {})

                if not isinstance(face_data, dict):
                    continue

                bitmap = face_data.get("bitmap", {})

                if is_matching_lod(bitmap):
                    return get_url(bitmap)

        texture = package.get("texture", {})

        if is_matching_lod(texture):
            return get_url(texture)

        # Fallback: falls alte Daten noch keine texture_lod_key-Felder haben.
        if isinstance(maps, dict):
            for slot_key in preferred_slots:
                slot = maps.get(slot_key, {})

                if isinstance(slot, dict) and slot.get("url"):
                    return slot["url"]

                groups = slot.get("texture_groups", []) if isinstance(slot, dict) else []

                if isinstance(groups, list):
                    for group in groups:
                        if isinstance(group, dict) and group.get("url"):
                            return group["url"]

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
            "particle_system": package.get("particle_system", {}),

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
            "particle_system": package.get("particle_system", {}),

            "material": package["material"],
            "mesh": package["mesh"],
            "shader": package["shader"],
            "texture": {
                **package.get("texture", {}),
                "url": primary_url,
                "thumbnail": primary_url,
                "lod_url": primary_url,
            },
            "package": package["package"],
            "preview": package["preview"],
            "settings": package["settings"],
            "texture_size": package.get("settings", {}).get("texture_size", TEXTURE_SIZE_ORIGINAL),
            "texture_lod_key": package.get("settings", {}).get("texture_lod_key", cls.texture_lod_key(
                package.get("settings", {}).get("texture_size", TEXTURE_SIZE_ORIGINAL)
            )),
            "time": time("unix_ms"),
        }

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
                **extra,
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
