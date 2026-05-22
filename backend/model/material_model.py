import os
import json
import uuid
import shutil

from config.data.constant import LAYERS
from model.base.main import BaseModel
from model.layer_model import LayerModel
from generated.paths import (PUBLIC_LAYER_FOLDER, PUBLIC_MATERIAL_FOLDER)
from utils import time

MATERIAL_TEXTURE_FOLDER = os.path.join(MATERIAL_FOLDER, "textures")


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

        payload["cached"] = cached.get("cached", False)
        payload["path"] = cached.get("path", "")
        payload["filename"] = cached.get("filename", "")

        return payload


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
    def refresh_base_color_texture_groups(cls, bitmap_maps, uv):
        mapped_faces = cls.get_mapped_uv_faces(uv)
        texture_groups = cls.get_uv_texture_groups(uv)
        texture_mode = cls.get_uv_texture_mode(uv)

        base = bitmap_maps.get("baseColor", cls.default_bitmap_slot())

        if not mapped_faces or texture_mode == "none":
            bitmap_maps["baseColor"] = base
            return bitmap_maps

        if texture_mode == "single":
            group = texture_groups[0]
            bitmap = group.get("bitmap", {})

            base.update({
                "enabled": True,
                "source_type": "single",
                "layer_id": bitmap.get("layer_id", ""),
                "url": bitmap.get("url", ""),
                "name": bitmap.get("name", "") or "SingleTexture",
                "node_id": "uv-cubemap-single-bitmap",
                "uv_node_id": "uv-cubemap-layout",
                "faces": uv.get("faces", {}),
                "mapped_faces": mapped_faces,
                "texture_groups": [{
                    "url": group.get("url", ""),
                    "name": group.get("name", "Texture"),
                    "layer_id": group.get("layer_id", ""),
                    "faces": group.get("faces", []),
                }],
            })

            bitmap_maps["baseColor"] = base
            return bitmap_maps

        base.update({
            "enabled": True,
            "source_type": "multitexture",
            "layer_id": "",
            "url": "",
            "name": f"Cube MultiTexture ({len(texture_groups)} textures / {len(mapped_faces)} faces)",
            "node_id": "uv-cubemap-multitexture",
            "uv_node_id": "uv-cubemap-layout",
            "faces": uv.get("faces", {}),
            "mapped_faces": mapped_faces,
            "texture_groups": [
                {
                    "url": group.get("url", ""),
                    "name": group.get("name", "Texture"),
                    "layer_id": group.get("layer_id", ""),
                    "faces": group.get("faces", []),
                }
                for group in texture_groups
            ],
        })

        bitmap_maps["baseColor"] = base
        return bitmap_maps

    @classmethod
    def ensure_dirs(cls):
        os.makedirs(PUBLIC_MATERIAL_FOLDER, exist_ok=True)
        os.makedirs(MATERIAL_TEXTURE_FOLDER, exist_ok=True)

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
    def resolve_layer_bitmap(cls, layer_id="", fallback_url=""):
        layer = cls.find_layer(layer_id)

        if not layer:
            return fallback_url or ""

        return (
            layer.get("masked")
            or layer.get("texture", {}).get("url")
            or layer.get("material", {}).get("textures", {}).get("base_color", {}).get("url")
            or layer.get("thumbnail")
            or layer.get("url")
            or layer.get("svg")
            or fallback_url
            or ""
        )

    @classmethod
    def normalize_texture_url(cls, url):
        return str(url or "").strip()


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
        }


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
            bitmap = cls.resolve_bitmap_payload(face_data.get("bitmap", {}))
            url = cls.normalize_texture_url(bitmap.get("url", ""))

            if not url:
                continue

            if url not in groups:
                groups[url] = {
                    "url": url,
                    "name": bitmap.get("name") or bitmap.get("layer_id") or "Texture",
                    "layer_id": bitmap.get("layer_id", ""),
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
    def normalize_surface(cls, surface):
        data = json_loads(surface, {})
        normalized = dict(SURFACE_DEFAULTS)

        for key, value in data.items():
            if key not in normalized:
                continue

            if key in SURFACE_RANGES:
                min_value, max_value = SURFACE_RANGES[key]
                normalized[key] = cls.clamp(value, min_value, max_value)
            elif isinstance(normalized[key], list):
                if isinstance(value, str) and value.startswith("#"):
                    alpha = normalized[key][3] if len(normalized[key]) > 3 else 1.0
                    normalized[key] = cls.hex_to_rgba(value, alpha)
                elif isinstance(value, list):
                    normalized[key] = value
            else:
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
                            "faces": [
                                face for face in group.get("faces", [])
                                if face in CUBE_FACE_NAMES
                            ],
                        })

                    slot["texture_groups"] = cleaned_groups
                    slot["enabled"] = len(cleaned_groups) > 1

                    if not slot["enabled"]:
                        slot["source_type"] = "single" if cleaned_groups else "none"

                        if cleaned_groups:
                            slot["url"] = cleaned_groups[0]["url"]
                            slot["layer_id"] = cleaned_groups[0]["layer_id"]
                            slot["name"] = cleaned_groups[0]["name"]
                            slot["mapped_faces"] = cleaned_groups[0]["faces"]

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
            },
        }

    @classmethod
    def normalize_uv(cls, uv):
        data = json_loads(uv, {})
        input_faces = data.get("faces", {}) if isinstance(data, dict) else {}

        faces = {}

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

        selected_faces = data.get("selected_faces", ["front"]) if isinstance(data, dict) else ["front"]

        if not isinstance(selected_faces, list):
            selected_faces = ["front"]

        selected_faces = [
            face for face in selected_faces
            if face in CUBE_FACE_NAMES
        ] or ["front"]

        active_face = data.get("active_face", "front") if isinstance(data, dict) else "front"

        if active_face not in CUBE_FACE_NAMES:
            active_face = "front"

        return {
            "mode": data.get("mode", "cubemap") if isinstance(data, dict) else "cubemap",
            "view_mode": data.get("view_mode", "cubemap") if isinstance(data, dict) else "cubemap",
            "active_face": active_face,
            "selected_faces": selected_faces,
            "atlas": data.get("atlas", "cross") if isinstance(data, dict) else "cross",
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
    def sync_base_color_from_uv(cls, bitmap_maps, uv):
        mapped_faces = cls.get_mapped_uv_faces(uv)
        texture_groups = cls.get_uv_texture_groups(uv)
        texture_mode = cls.get_uv_texture_mode(uv)

        base = bitmap_maps.get("baseColor", cls.default_bitmap_slot())

        if not mapped_faces or texture_mode == "none":
            if base.get("uv_node_id") == "uv-cubemap-layout":
                base.update(cls.default_bitmap_slot())

            bitmap_maps["baseColor"] = base
            return bitmap_maps

        if texture_mode == "single":
            group = texture_groups[0]
            bitmap = group.get("bitmap", {})

            base.update({
                "enabled": True,
                "source_type": "single",

                "layer_id": bitmap.get("layer_id", ""),
                "url": bitmap.get("url", ""),
                "name": bitmap.get("name", "") or "SingleTexture",

                "node_id": "uv-cubemap-single-bitmap",
                "uv_node_id": "uv-cubemap-layout",

                "faces": uv.get("faces", {}),
                "mapped_faces": mapped_faces,
                "texture_groups": [{
                    "url": group.get("url", ""),
                    "name": group.get("name", "Texture"),
                    "layer_id": group.get("layer_id", ""),
                    "faces": group.get("faces", []),
                }],
            })

            bitmap_maps["baseColor"] = base
            return bitmap_maps

        base.update({
            "enabled": True,
            "source_type": "multitexture",

            "layer_id": "",
            "url": "",
            "name": f"Cube MultiTexture ({len(texture_groups)} textures / {len(mapped_faces)} faces)",

            "node_id": "uv-cubemap-multitexture",
            "uv_node_id": "uv-cubemap-layout",

            "faces": uv.get("faces", {}),
            "mapped_faces": mapped_faces,
            "texture_groups": [
                {
                    "url": group.get("url", ""),
                    "name": group.get("name", "Texture"),
                    "layer_id": group.get("layer_id", ""),
                    "faces": group.get("faces", []),
                }
                for group in texture_groups
            ],
        })

        bitmap_maps["baseColor"] = base
        return bitmap_maps

    @classmethod
    def create_output_node(cls):
        return {
            "id": "surface-output",
            "type": "output",
            "label": "Material Output",
            "locked": True,
            "position": {"x": 760, "y": 220},
            "inputs": {key: None for key in SURFACE_SLOT_KEYS},
            "outputs": {},
            "settings": {},
        }

    @classmethod
    def create_bitmap_node_from_slot(cls, slot_key, slot):
        return {
            "id": f"bitmap-{slot_key}",
            "type": "bitmap",
            "label": f"{slot_key} Bitmap",
            "locked": False,
            "position": {"x": 80, "y": 80 + SURFACE_SLOT_KEYS.index(slot_key) * 34},
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
    def normalize_node(cls, node, index=0):
        node_type = node.get("type", "value")

        if node_type not in ALLOWED_NODE_TYPES:
            node_type = "value"

        normalized = {
            "id": str(node.get("id") or str(uuid.uuid4())),
            "type": node_type,
            "label": str(node.get("label") or node_type.title()),
            "locked": bool(node.get("locked", False)),
            "position": node.get("position") or {"x": 120 + index * 40, "y": 120 + index * 20},
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
        output = cls.create_output_node()
        nodes = [output]
        edges = []

        for slot_key, slot in bitmap_maps.items():
            if not slot.get("enabled") or not slot.get("url"):
                continue

            bitmap_node = cls.create_bitmap_node_from_slot(slot_key, slot)
            nodes.append(bitmap_node)

            output_socket = "color" if isinstance(SURFACE_DEFAULTS.get(slot_key), list) else "value"

            edges.append({
                "id": f"edge-{bitmap_node['id']}-to-output-{slot_key}",
                "from": {
                    "node": bitmap_node["id"],
                    "socket": output_socket,
                },
                "to": {
                    "node": "surface-output",
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

        for index, node in enumerate(data.get("nodes", [])):
            if not isinstance(node, dict):
                continue

            normalized = cls.normalize_node(node, index)

            if normalized["type"] == "output":
                normalized["id"] = "surface-output"
                normalized["locked"] = True
                has_output = True

            nodes.append(normalized)

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

        # Auto nodes für belegte Slots ergänzen, falls noch nicht vorhanden.
        existing_slot_nodes = {
            node.get("settings", {}).get("slot")
            for node in nodes
            if node.get("type") == "bitmap"
        }

        for slot_key, slot in bitmap_maps.items():
            if not slot.get("enabled") or not slot.get("url"):
                continue

            if slot_key in existing_slot_nodes:
                continue

            bitmap_node = cls.create_bitmap_node_from_slot(slot_key, slot)
            nodes.append(bitmap_node)

            output_socket = "color" if isinstance(SURFACE_DEFAULTS.get(slot_key), list) else "value"

            edges.append({
                "id": f"edge-{bitmap_node['id']}-to-output-{slot_key}",
                "from": {
                    "node": bitmap_node["id"],
                    "socket": output_socket,
                },
                "to": {
                    "node": "surface-output",
                    "socket": slot_key,
                },
            })

        return {
            "version": int(data.get("version", 1) or 1),
            "nodes": nodes,
            "edges": edges,
        }

    @classmethod
    def is_download_url(cls, url):
        return isinstance(url, str) and url.startswith("/download/")


    @classmethod
    def public_download_url_to_path(cls, url):
        if not cls.is_download_url(url):
            return ""

        clean_url = str(url).split("?")[0]
        prefix = "/download/"

        if not clean_url.startswith(prefix):
            return ""

        relative_path = clean_url[len(prefix):].lstrip("/")

        return os.path.join(PUBLIC_LAYER_FOLDER, relative_path)


    @classmethod
    def make_material_texture_url(cls, filename):
        return f"/download/materials/textures/{filename}?ts={time('unix_ms')}"


    @classmethod
    def copy_source_texture(cls, material_id, source_layer_id="", texture_url="", suffix="base_color"):
        cls.ensure_dirs()

        texture_url = cls.normalize_texture_url(texture_url)

        source_path = ""

        if texture_url and cls.is_download_url(texture_url):
            possible_path = cls.public_download_url_to_path(texture_url)

            if possible_path and os.path.exists(possible_path):
                source_path = possible_path

        if not source_path and source_layer_id:
            possible_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{source_layer_id}.png")

            if os.path.exists(possible_path):
                source_path = possible_path

        if not source_path:
            resolved = texture_url or cls.resolve_layer_bitmap(source_layer_id)

            return {
                "path": "",
                "url": resolved,
                "filename": "",
                "cached": False,
                "missing": not bool(resolved),
            }

        filename = f"{material_id}_{suffix}.png"
        target_path = os.path.join(MATERIAL_TEXTURE_FOLDER, filename)

        shutil.copy2(source_path, target_path)

        if not os.path.exists(target_path):
            return {
                "path": "",
                "url": texture_url or cls.resolve_layer_bitmap(source_layer_id),
                "filename": "",
                "cached": False,
                "missing": True,
            }

        return {
            "path": target_path,
            "url": cls.make_material_texture_url(filename),
            "filename": filename,
            "cached": True,
            "missing": False,
        }

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
        use_nodes=True
    ):
        alpha = surface.get("alpha", 1.0)

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

            "textures": {
                "base_color": {
                    "enabled": bool(texture.get("url")),
                    "url": texture.get("url", ""),
                    "path": texture.get("path", ""),
                    "filename": texture.get("filename", ""),
                    "color_space": "sRGB",
                },
            },

            "bitmap_maps": bitmap_maps,
            "uv": uv,
            "shader_graph": shader_graph,
        }

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
    ):
        cls.ensure_dirs()

        material_id = material_id or str(uuid.uuid4())

        normalized_surface = cls.normalize_surface(surface)
        normalized_geometry = cls.normalize_geometry(geometry)

        normalized_uv = cls.normalize_uv(uv)

        # 1. Erst alle Face-Bitmaps persistent machen.
        normalized_uv = cls.cache_uv_textures(
            material_id=material_id,
            uv=normalized_uv,
        )

        # 2. Dann bitmap_maps normalisieren.
        normalized_maps = cls.normalize_bitmap_maps(bitmap_maps)

        # 3. Danach baseColor intelligent aus UV neu ableiten.
        normalized_maps = cls.refresh_base_color_texture_groups(
            normalized_maps,
            normalized_uv,
        )

        # 4. Jetzt erst Shader Graph normalisieren, damit er die finalen URLs bekommt.
        normalized_graph = cls.normalize_shader_graph(
            shader_graph,
            normalized_maps,
        )

        base_map = normalized_maps.get("baseColor", {})

        texture_url = ""

        if base_map.get("source_type") == "single":
            texture_url = base_map.get("url", "")

        texture = {
            "path": "",
            "url": texture_url,
            "filename": "",
            "cached": bool(texture_url and "/download/materials/textures/" in texture_url),
            "missing": False,
        }

        if not texture.get("url") and base_map.get("source_type") != "multitexture":
            fallback_url = cls.resolve_layer_bitmap(source_layer_id)

            if fallback_url:
                texture = cls.copy_source_texture(
                    material_id=material_id,
                    source_layer_id=source_layer_id,
                    texture_url=fallback_url,
                    suffix="base_color",
                )

        mesh = cls.build_low_poly_cube_mesh(
            cube_size=cube_size,
            geometry=normalized_geometry,
        )

        shader = {
            "shader": "canvas-principled-node-graph",
            "version": 4,
            "inputs": normalized_surface,
            "geometry": normalized_geometry,
            "bitmap_maps": normalized_maps,
            "uv": normalized_uv,
            "graph": normalized_graph,
        }

        material = cls.build_blender_material(
            material_id=material_id,
            layer_id=layer_id,
            name=name,
            surface=normalized_surface,
            geometry=normalized_geometry,
            bitmap_maps=normalized_maps,
            uv=normalized_uv,
            shader_graph=normalized_graph,
            texture=texture,
            blend_mode=blend_mode,
            shadow_method=shadow_method,
            use_nodes=use_nodes,
        )

        package = {
            "id": material_id,
            "layer_id": layer_id,
            "type": "MATERIAL_LOW_POLY_CUBE",
            "renderer": "canvas-cube",
            "created_at": time("unix_ms"),
            "source_layer_id": source_layer_id,

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
                "rotate": bool(rotate_preview),
                "idle_rotation": {
                    "enabled": bool(rotate_preview),
                    "speed": 0.006,
                    "tilt": 0.42,
                },
            },

            "settings": {
                "blend_mode": blend_mode,
                "shadow_method": shadow_method,
                "use_nodes": bool(use_nodes),
                "cube_size": cube_size,
            },
        }

        filename = f"{material_id}.material.json"
        package_path = os.path.join(PUBLIC_MATERIAL_FOLDER, filename)

        with open(package_path, "w", encoding="utf-8") as handle:
            json.dump(package, handle, indent=2, ensure_ascii=False)

        package["package"] = {
            "filename": filename,
            "path": package_path,
            "url": f"/download/materials/{filename}?ts={time('unix_ms')}",
        }

        return package

    @classmethod
    def attach_material_to_layer(cls, layer, package):
        layer.update({
            "renderer": "canvas-cube",
            "engine": "material",

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
        })

        return layer

    @classmethod
    def create_cube(
        cls,
        source_layer_id,
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
    ):
        try:
            source_layer = cls.find_layer(source_layer_id)

            if not source_layer:
                return {"error": f"Source layer '{source_layer_id}' not found."}, 404

            source_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{source_layer_id}.png")
            layer_width = int(source_layer.get("width") or cube_size or 256)
            layer_height = int(source_layer.get("height") or cube_size or 256)

            add_result, add_status = LayerModel.add(
                name=name or "Material Cube",
                path=source_path if os.path.exists(source_path) else "",
                id="",
                type=5,
                width=layer_width,
                height=layer_height,
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
            )

            layer["source"] = source_layer_id
            cls.attach_material_to_layer(layer, package)

            return {
                "message": "Material Cube erfolgreich erstellt.",
                "id": layer_id,
                "layer": layer,
                "package": package,
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def update(
        cls,
        id,
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
    ):
        try:
            layer = cls.find_layer(id)

            if not layer:
                return {"error": f"Layer '{id}' not found."}, 404

            if layer.get("type") != 5:
                return {"error": f"Layer '{id}' is not a material layer."}, 400

            source_layer_id = layer.get("source") or ""
            material_id = layer.get("material", {}).get("id") or str(uuid.uuid4())

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
            )

            cls.attach_material_to_layer(layer, package)

            return {
                "message": "Material erfolgreich aktualisiert.",
                "id": id,
                "layer": layer,
                "package": package,
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def export_blender(cls, id):
        try:
            layer = cls.find_layer(id)

            if not layer or layer.get("type") != 5:
                return {"error": f"Material layer '{id}' not found."}, 404

            return {
                "id": id,
                "layer_id": id,
                "surface": layer.get("surface"),
                "geometry": layer.get("geometry"),
                "bitmap_maps": layer.get("bitmap_maps"),
                "material": layer.get("material"),
                "mesh": layer.get("mesh"),
                "shader": layer.get("shader"),
                "uv": layer.get("uv"),
                "shader_graph": layer.get("shader_graph"),
                "texture": layer.get("texture"),
                "package": layer.get("package"),
                "settings": layer.get("settings"),
            }, 200

        except Exception as e:
            return cls.handle_error(e)