import copy
import json
import uuid

from config.data.constant import LAYERS
from model.base.main import BaseModel
from utils import time


class MeshModel(BaseModel):
    MATERIAL_LAYER_TYPE = 5

    @classmethod
    def _find_layer(cls, id):
        return next((layer for layer in LAYERS if layer.get("id") == id), None)

    @classmethod
    def _shared_defaults(cls, layer):
        order = layer.get("order")

        if order is None:
            order = len(LAYERS)

        layer.setdefault("type", cls.MATERIAL_LAYER_TYPE)
        layer.setdefault("name", "Mesh Layer")
        layer.setdefault("width", 1024)
        layer.setdefault("height", 1024)
        layer.setdefault("matrix", {
            "a": 1,
            "b": 0,
            "c": 0,
            "d": 1,
            "x": 0,
            "y": 0,
            "rotate": 0,
        })
        layer.setdefault("order", order)
        layer.setdefault("hidden", 0)
        layer.setdefault("opacity", 1)
        layer.setdefault("blend_mode", 0)
        layer.setdefault("color", "#ffffff")
        layer.setdefault("mask", "")
        layer.setdefault("keyframes", [])
        layer.setdefault("group", None)
        return layer

    @classmethod
    def _mesh_payload(cls, **payload):
        return {
            key: copy.deepcopy(value)
            for key, value in payload.items()
            if value not in (None, "")
        }

    @staticmethod
    def _as_dict(value):
        if isinstance(value, dict):
            return value

        if isinstance(value, str) and value.strip():
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}

        return {}

    @staticmethod
    def _as_list(value):
        if isinstance(value, list):
            return value

        if isinstance(value, tuple):
            return list(value)

        if isinstance(value, dict):
            numeric_keys = [key for key in value.keys() if str(key).isdigit()]

            if numeric_keys:
                return [value[key] for key in sorted(numeric_keys, key=lambda item: int(item))]

            return []

        if isinstance(value, str) and value.strip():
            try:
                parsed = json.loads(value)
                return MeshModel._as_list(parsed)
            except Exception:
                return []

        return []

    @staticmethod
    def _safe_int(value, fallback=0):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return fallback

    @staticmethod
    def _safe_float(value, fallback=0.0):
        try:
            number = float(value)
        except (TypeError, ValueError):
            return fallback

        if number != number or number in (float("inf"), float("-inf")):
            return fallback

        return number

    @classmethod
    def _quantize_vertices(cls, values, precision=6):
        scale = 10 ** max(0, cls._safe_int(precision, 6))
        return [round(cls._safe_float(value, 0.0) * scale) / scale for value in cls._as_list(values)]

    @classmethod
    def _quantize_indices(cls, values):
        return [max(0, cls._safe_int(value, 0)) for value in cls._as_list(values)]


    @classmethod
    def _finite_point(cls, value):
        if not isinstance(value, (list, tuple)) or len(value) < 3:
            return None

        point = [cls._safe_float(value[0], 0.0), cls._safe_float(value[1], 0.0), cls._safe_float(value[2], 0.0)]
        return point

    @staticmethod
    def _sub3(a, b):
        return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

    @staticmethod
    def _cross3(a, b):
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
        ]

    @classmethod
    def _normalize3(cls, value, fallback=None):
        fallback = fallback or [0.0, 0.0, 1.0]
        length = (value[0] * value[0] + value[1] * value[1] + value[2] * value[2]) ** 0.5

        if length <= 0.0000001:
            return fallback[:]

        return [value[0] / length, value[1] / length, value[2] / length]

    @classmethod
    def _face_normal(cls, points, fallback=None):
        fallback = fallback or [0.0, 0.0, 1.0]

        if len(points) < 3:
            return fallback[:]

        return cls._normalize3(
            cls._cross3(cls._sub3(points[1], points[0]), cls._sub3(points[2], points[0])),
            fallback,
        )

    @classmethod
    def _tangent_for_normal(cls, normal):
        nx, ny, nz = normal
        axis = [0.0, 0.0, 1.0] if abs(nz) < 0.9 else [0.0, 1.0, 0.0]
        tangent = cls._cross3(axis, normal)
        return cls._normalize3(tangent, [1.0, 0.0, 0.0])

    @classmethod
    def _compute_bounds(cls, flat_vertices, stride=11):
        if not isinstance(flat_vertices, list) or len(flat_vertices) < 3:
            return {}

        safe_stride = max(3, cls._safe_int(stride, 11))
        mins = [float("inf"), float("inf"), float("inf")]
        maxs = [float("-inf"), float("-inf"), float("-inf")]

        for offset in range(0, len(flat_vertices) - 2, safe_stride):
            x = cls._safe_float(flat_vertices[offset], 0.0)
            y = cls._safe_float(flat_vertices[offset + 1], 0.0)
            z = cls._safe_float(flat_vertices[offset + 2], 0.0)
            mins[0] = min(mins[0], x)
            mins[1] = min(mins[1], y)
            mins[2] = min(mins[2], z)
            maxs[0] = max(maxs[0], x)
            maxs[1] = max(maxs[1], y)
            maxs[2] = max(maxs[2], z)

        if any(value in (float("inf"), float("-inf")) for value in [*mins, *maxs]):
            return {}

        return {"min": mins, "max": maxs}

    @classmethod
    def _upgrade_flat_vertices(cls, values, source_stride=11):
        source = cls._as_list(values)

        if not source:
            return []

        safe_stride = max(3, cls._safe_int(source_stride, 11))
        output = []

        for offset in range(0, len(source), safe_stride):
            if offset + 2 >= len(source):
                break

            position = [
                cls._safe_float(source[offset], 0.0),
                cls._safe_float(source[offset + 1], 0.0),
                cls._safe_float(source[offset + 2], 0.0),
            ]
            normal = [
                cls._safe_float(source[offset + 3], 0.0) if safe_stride > 3 and offset + 3 < len(source) else 0.0,
                cls._safe_float(source[offset + 4], 0.0) if safe_stride > 4 and offset + 4 < len(source) else 0.0,
                cls._safe_float(source[offset + 5], 1.0) if safe_stride > 5 and offset + 5 < len(source) else 1.0,
            ]
            uv = [
                cls._safe_float(source[offset + 6], 0.0) if safe_stride > 6 and offset + 6 < len(source) else 0.0,
                cls._safe_float(source[offset + 7], 0.0) if safe_stride > 7 and offset + 7 < len(source) else 0.0,
            ]
            tangent = [
                cls._safe_float(source[offset + 8], 1.0) if safe_stride > 8 and offset + 8 < len(source) else 1.0,
                cls._safe_float(source[offset + 9], 0.0) if safe_stride > 9 and offset + 9 < len(source) else 0.0,
                cls._safe_float(source[offset + 10], 0.0) if safe_stride > 10 and offset + 10 < len(source) else 0.0,
            ]
            output.extend([*position, *normal, *uv, *tangent])

        return output


    @classmethod
    def _legacy_box_points_from_mesh(cls, mesh):
        data = cls._as_dict(mesh)
        geometry = cls._as_dict(data.get("geometry", data.get("settings", {})))
        size = cls._safe_float(data.get("size", geometry.get("cube_size", 1.0)), 1.0)
        sx = cls._safe_float(geometry.get("scale_x", 1.0), 1.0)
        sy = cls._safe_float(geometry.get("scale_y", 1.0), 1.0)
        sz = cls._safe_float(geometry.get("scale_z", 1.0), 1.0)
        width = size * cls._safe_float(geometry.get("width", 1.0), 1.0) * sx
        height = size * cls._safe_float(geometry.get("height", 1.0), 1.0) * sy
        depth = size * cls._safe_float(geometry.get("depth", 1.0), 1.0) * sz
        hx = width / 2.0
        hy = height / 2.0
        hz = depth / 2.0

        return [
            [-hx, -hy, -hz],
            [hx, -hy, -hz],
            [hx, hy, -hz],
            [-hx, hy, -hz],
            [-hx, -hy, hz],
            [hx, -hy, hz],
            [hx, hy, hz],
            [-hx, hy, hz],
        ]

    @classmethod
    def _legacy_faces_to_flat_geometry(cls, mesh):
        data = cls._as_dict(mesh)
        source_vertices = data.get("vertices", [])
        faces = cls._as_list(data.get("faces", []))

        if not isinstance(source_vertices, list) or not faces:
            return None

        # Legacy material packages stored cube points as [[x,y,z], ...] plus
        # quad faces. Runtime/WebGL/Brush/MeshEdit need the flat 11-value
        # position-normal-uv-tangent layout, so compile the authoring shape here.
        if source_vertices:
            points = [cls._finite_point(point) for point in source_vertices]
        else:
            # Already compacted packages have the authoring faces but no heavy
            # point array anymore. Rebuild the 8 cube points from the stored
            # geometry settings so the external payload can still be generated.
            points = cls._legacy_box_points_from_mesh(data)

        if not points or any(point is None for point in points):
            return None

        uv_templates = {
            3: [[0.0, 0.0], [1.0, 0.0], [0.5, 1.0]],
            4: [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]],
        }
        flat_vertices = []
        flat_indices = []
        parts = []

        for face in faces:
            if not isinstance(face, dict):
                continue

            raw_indices = [cls._safe_int(index, -1) for index in cls._as_list(face.get("indices", []))]
            raw_indices = [index for index in raw_indices if 0 <= index < len(points)]

            if len(raw_indices) < 3:
                continue

            face_points = [points[index] for index in raw_indices]
            normal = cls._normalize3(
                [cls._safe_float(value, 0.0) for value in cls._as_list(face.get("normal", []))[:3]],
                cls._face_normal(face_points),
            ) if len(cls._as_list(face.get("normal", []))) >= 3 else cls._face_normal(face_points)
            tangent = cls._tangent_for_normal(normal)
            uvs = uv_templates.get(len(raw_indices)) or [
                [0.0 if offset == 0 else 1.0, 0.0 if offset < 2 else 1.0]
                for offset in range(len(raw_indices))
            ]
            start = len(flat_indices)
            base_vertex = int(len(flat_vertices) / 11)

            for local_offset, source_index in enumerate(raw_indices):
                uv = uvs[local_offset] if local_offset < len(uvs) else [0.0, 0.0]
                flat_vertices.extend([*points[source_index], *normal, *uv, *tangent])

            # Fan triangulation. Quads become two triangles, n-gons stay bounded
            # and deterministic without inventing a second topology format.
            for local_offset in range(1, len(raw_indices) - 1):
                flat_indices.extend([
                    base_vertex,
                    base_vertex + local_offset,
                    base_vertex + local_offset + 1,
                ])

            parts.append({
                "name": str(face.get("name", "face") or "face"),
                "faceName": str(face.get("name", "face") or "face"),
                "materialSlot": str(face.get("materialSlot", face.get("name", "face")) or "face"),
                "start": start,
                "count": len(flat_indices) - start,
            })

        if len(flat_vertices) < 33 or len(flat_indices) < 3:
            return None

        return {
            "vertices": cls._quantize_vertices(flat_vertices, 6),
            "indices": cls._quantize_indices(flat_indices),
            "stride": 11,
            "parts": parts,
            "bounds": cls._compute_bounds(flat_vertices, 11),
        }

    @classmethod
    def ensure_runtime_geometry(cls, mesh, fallback=None):
        data = copy.deepcopy(cls._as_dict(mesh))
        fallback_data = copy.deepcopy(cls._as_dict(fallback))

        vertices = data.get("vertices", [])
        indices = data.get("indices", [])
        stride = max(3, cls._safe_int(data.get("stride", 11), 11))
        flat_vertices = []
        flat_indices = cls._quantize_indices(indices)

        if isinstance(vertices, list) and vertices and all(isinstance(value, (int, float, str)) for value in vertices):
            flat_vertices = cls._upgrade_flat_vertices(vertices, stride)
        elif isinstance(vertices, list) and vertices and all(isinstance(value, (list, tuple)) for value in vertices):
            legacy = cls._legacy_faces_to_flat_geometry(data)
            if legacy:
                data.update(legacy)
                flat_vertices = legacy["vertices"]
                flat_indices = legacy["indices"]
                stride = 11
        elif cls._as_list(data.get("faces", [])):
            legacy = cls._legacy_faces_to_flat_geometry(data)
            if legacy:
                data.update(legacy)
                flat_vertices = legacy["vertices"]
                flat_indices = legacy["indices"]
                stride = 11

        if (not flat_vertices or not flat_indices) and fallback_data:
            fallback_runtime = cls.ensure_runtime_geometry(fallback_data) if fallback_data is not data else fallback_data
            fallback_vertices = cls._as_list(fallback_runtime.get("vertices", []))
            fallback_indices = cls._as_list(fallback_runtime.get("indices", []))

            if fallback_vertices and fallback_indices:
                data = {
                    **fallback_runtime,
                    **{key: value for key, value in data.items() if key not in {"vertices", "indices", "parts", "bounds", "stride", "count", "indexType"}},
                }
                flat_vertices = cls._upgrade_flat_vertices(fallback_vertices, fallback_runtime.get("stride", 11))
                flat_indices = cls._quantize_indices(fallback_indices)
                stride = 11

        if flat_vertices and flat_indices:
            data["vertices"] = cls._quantize_vertices(flat_vertices, 6)
            data["indices"] = cls._quantize_indices(flat_indices)
            data["stride"] = 11
            data["count"] = len(data["indices"])
            data["indexType"] = "uint32" if max([0, *data["indices"]]) > 65535 else "uint16"
            data["bounds"] = data.get("bounds") if isinstance(data.get("bounds"), dict) and data.get("bounds") else cls._compute_bounds(data["vertices"], 11)
            data["parts"] = cls._as_list(data.get("parts", []))

        return data

    @classmethod
    def geometry_manifest_for_mesh(cls, mesh):
        data = cls.ensure_runtime_geometry(mesh)
        stride = max(1, cls._safe_int(data.get("stride", 11), 11))
        vertices = cls._as_list(data.get("vertices", []))
        indices = cls._as_list(data.get("indices", []))
        index_type = data.get("indexType", "uint16")
        max_index = max([0, *[cls._safe_int(index, 0) for index in indices]])

        if max_index > 65535:
            index_type = "uint32"

        meta = cls._as_dict(data.get("meta", {}))
        revision = max(
            cls._safe_int(meta.get("editRevision", 0), 0),
            cls._safe_int(meta.get("brushRevision", 0), 0),
            cls._safe_int(meta.get("uvRevision", 0), 0),
            cls._safe_int(cls._as_dict(data.get("geometry_manifest", {})).get("revision", 0), 0),
        )

        return {
            "schema": "geometry-heavy-manifest.v1",
            "id": str(data.get("id", "") or ""),
            "primitive": str(data.get("primitive", cls._as_dict(data.get("settings", {})).get("primitive", "mesh")) or "mesh"),
            "stride": stride,
            "indexType": "uint32" if index_type == "uint32" else "uint16",
            "vertex_count": int(len(vertices) / stride) if stride > 0 else 0,
            "vertex_value_count": len(vertices),
            "index_count": len(indices),
            "triangle_count": int(len(indices) / 3),
            "part_count": len(cls._as_list(data.get("parts", []))),
            "bounds": copy.deepcopy(cls._as_dict(data.get("bounds", {}))),
            "revision": revision,
            "editRevision": cls._safe_int(meta.get("editRevision", 0), 0),
            "brushRevision": cls._safe_int(meta.get("brushRevision", 0), 0),
            "uvRevision": cls._safe_int(meta.get("uvRevision", 0), 0),
            "quantization": {"vertices": 6, "indices": 0},
        }

    @classmethod
    def geometry_payload_for_mesh(cls, mesh, chunk_size=4096):
        data = cls.ensure_runtime_geometry(mesh)
        manifest = cls.geometry_manifest_for_mesh(data)
        vertices = cls._quantize_vertices(data.get("vertices", []), 6)
        indices = cls._quantize_indices(data.get("indices", []))
        safe_chunk_size = max(256, cls._safe_int(chunk_size, 4096))

        def chunks(kind, values):
            output = []
            for start in range(0, len(values), safe_chunk_size):
                part = values[start:start + safe_chunk_size]
                output.append({
                    "key": f"{kind}:{start}",
                    "kind": kind,
                    "start": start,
                    "count": len(part),
                    "data": part,
                })
            return output

        return {
            "schema": "geometry-heavy-payload.v1",
            "mode": "replace",
            "mesh_id": manifest.get("id", ""),
            "revision": manifest.get("revision", 0),
            "manifest": manifest,
            "chunks": [
                *chunks("vertices", vertices),
                *chunks("indices", indices),
            ],
        }

    @classmethod
    def strip_mesh_heavy(cls, mesh):
        data = cls.ensure_runtime_geometry(mesh)
        manifest = cls.geometry_manifest_for_mesh(data)

        data["vertices"] = []
        data["indices"] = []
        data["count"] = manifest.get("index_count", 0)
        data["indexType"] = manifest.get("indexType", data.get("indexType", "uint16"))
        data["geometry_manifest"] = manifest
        data["mesh_manifest"] = manifest
        data.pop("geometry_payload", None)
        data["meta"] = {
            **cls._as_dict(data.get("meta", {})),
            "geometryExternalized": True,
            "geometryRevision": manifest.get("revision", 0),
            "vertexCount": manifest.get("vertex_count", 0),
            "indexCount": manifest.get("index_count", 0),
            "triangleCount": manifest.get("triangle_count", 0),
        }
        return data

    @classmethod
    def _apply_geometry_chunks(cls, base, payload):
        result = cls._as_list(base).copy()
        data = cls._as_dict(payload)
        chunks = cls._as_list(data.get("chunks", []))

        if data.get("mode", "replace") == "replace":
            result = []

        for chunk in chunks:
            if not isinstance(chunk, dict):
                continue

            values = cls._as_list(chunk.get("data", []))
            start = max(0, cls._safe_int(chunk.get("start", 0), 0))
            required = start + len(values)

            if len(result) < required:
                result.extend([0] * (required - len(result)))

            if chunk.get("kind") == "indices":
                values = cls._quantize_indices(values)
            else:
                values = cls._quantize_vertices(values, 6)

            result[start:required] = values

        return result

    @classmethod
    def merge_geometry_payload(cls, mesh, existing_mesh=None, geometry_payload=None):
        data = copy.deepcopy(cls._as_dict(mesh))
        existing = cls._as_dict(existing_mesh)

        # Sculpt commits intentionally do not resend large UV helper arrays. Keep
        # the stored UV payload unless the client explicitly provides a new one.
        if "uv" not in data and isinstance(existing.get("uv"), dict):
            data["uv"] = copy.deepcopy(existing.get("uv"))

        payload = cls._as_dict(geometry_payload or data.get("geometry_payload") or {})
        chunks = cls._as_list(payload.get("chunks", []))

        if chunks:
            vertex_payload = {**payload, "chunks": [chunk for chunk in chunks if isinstance(chunk, dict) and chunk.get("kind") == "vertices"]}
            index_payload = {**payload, "chunks": [chunk for chunk in chunks if isinstance(chunk, dict) and chunk.get("kind") == "indices"]}
            base_vertices = existing.get("vertices", []) if payload.get("mode") == "patch" else []
            base_indices = existing.get("indices", []) if payload.get("mode") == "patch" else []

            data["vertices"] = cls._apply_geometry_chunks(base_vertices, vertex_payload)
            data["indices"] = cls._apply_geometry_chunks(base_indices, index_payload)
            data["geometry_manifest"] = copy.deepcopy(cls._as_dict(payload.get("manifest", {})))
        else:
            data["vertices"] = cls._quantize_vertices(data.get("vertices", existing.get("vertices", [])), 6)
            data["indices"] = cls._quantize_indices(data.get("indices", existing.get("indices", [])))

        data.pop("geometry_payload", None)
        return cls.ensure_runtime_geometry(data, fallback=existing)

    @classmethod
    def compile_mesh_for_storage(cls, mesh, existing_mesh=None, geometry_payload=None):
        data = cls.merge_geometry_payload(mesh, existing_mesh=existing_mesh, geometry_payload=geometry_payload)
        manifest = cls.geometry_manifest_for_mesh(data)
        data["geometry_manifest"] = manifest
        data["mesh_manifest"] = manifest
        data["indexType"] = manifest.get("indexType", data.get("indexType", "uint16"))
        data["count"] = manifest.get("index_count", len(cls._as_list(data.get("indices", []))))
        data["meta"] = {
            **cls._as_dict(data.get("meta", {})),
            "geometryRevision": manifest.get("revision", 0),
            "vertexCount": manifest.get("vertex_count", 0),
            "indexCount": manifest.get("index_count", 0),
            "triangleCount": manifest.get("triangle_count", 0),
        }
        return data

    @classmethod
    def compact_nested_mesh_refs(cls, value, manifest):
        data = copy.deepcopy(value)

        if isinstance(data, dict) and isinstance(data.get("mesh"), dict):
            data["mesh"] = cls.strip_mesh_heavy(data["mesh"])
            data["mesh_manifest"] = copy.deepcopy(manifest)
            data["geometry_manifest"] = copy.deepcopy(manifest)

        return data

    @classmethod
    def fetch(cls, id=""):
        try:
            if id:
                layer = cls._find_layer(id)

                if not layer:
                    return {"error": "Mesh layer not found"}, 404

                if int(layer.get("type", -1)) != cls.MATERIAL_LAYER_TYPE:
                    return {"error": "Layer is not a mesh layer"}, 400

                return layer, 200

            return [
                layer for layer in LAYERS
                if int(layer.get("type", -1)) == cls.MATERIAL_LAYER_TYPE
            ], 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def create(cls, id="", name="Mesh Layer", width=1024, height=1024, hidden=0, opacity=1, order=0,
               matrix=None, keyframes=None, geometry=None, mesh=None, settings=None, preview=None,
               viewport_camera=None, material=None, shader=None, particle_system=None, **extra):
        try:
            layer_id = id or str(uuid.uuid4())
            layer = cls._shared_defaults({
                "id": layer_id,
                "type": cls.MATERIAL_LAYER_TYPE,
                "name": name,
                "width": width,
                "height": height,
                "hidden": hidden,
                "opacity": opacity,
                "order": order if order is not None else len(LAYERS),
                "matrix": matrix or None,
                "keyframes": keyframes or [],
            })

            geometry_payload = extra.pop("geometry_payload", None)
            geometry_manifest = extra.pop("geometry_manifest", None)
            compiled_mesh = None

            if mesh is not None or geometry_payload:
                compiled_mesh = cls.compile_mesh_for_storage(mesh or {}, geometry_payload=geometry_payload)
                geometry_manifest = compiled_mesh.get("geometry_manifest", geometry_manifest or {})

            layer.update(cls._mesh_payload(
                geometry=geometry,
                mesh=compiled_mesh,
                geometry_manifest=geometry_manifest,
                settings=settings,
                preview=preview,
                viewport_camera=viewport_camera,
                material=cls.compact_nested_mesh_refs(material, geometry_manifest) if material else material,
                shader=cls.compact_nested_mesh_refs(shader, geometry_manifest) if shader else shader,
                particle_system=particle_system,
                **extra,
            ))
            layer["time"] = time("unix_ms")

            LAYERS.append(layer)
            return layer, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def update(cls, id, name="", width=0, height=0, hidden=None, opacity=None, order=None,
               matrix=None, keyframes=None, geometry=None, mesh=None, settings=None, preview=None,
               viewport_camera=None, material=None, shader=None, particle_system=None, **extra):
        try:
            layer = cls._find_layer(id)

            if not layer:
                return {"error": "Mesh layer not found"}, 404

            if int(layer.get("type", -1)) != cls.MATERIAL_LAYER_TYPE:
                return {"error": "Layer is not a mesh layer"}, 400

            if name:
                layer["name"] = name
            if width:
                layer["width"] = width
            if height:
                layer["height"] = height
            if hidden is not None:
                layer["hidden"] = int(hidden)
            if opacity is not None:
                layer["opacity"] = float(opacity)
            if order is not None:
                layer["order"] = int(order)
            if matrix:
                layer["matrix"] = matrix
            if keyframes is not None:
                layer["keyframes"] = keyframes

            geometry_payload = extra.pop("geometry_payload", None)
            geometry_manifest = extra.pop("geometry_manifest", None)
            compiled_mesh = None

            if mesh is not None or geometry_payload:
                compiled_mesh = cls.compile_mesh_for_storage(mesh or {}, existing_mesh=layer.get("mesh", {}), geometry_payload=geometry_payload)
                geometry_manifest = compiled_mesh.get("geometry_manifest", geometry_manifest or layer.get("geometry_manifest", {}))

            layer.update(cls._mesh_payload(
                geometry=geometry,
                mesh=compiled_mesh,
                geometry_manifest=geometry_manifest,
                settings=settings,
                preview=preview,
                viewport_camera=viewport_camera,
                material=cls.compact_nested_mesh_refs(material, geometry_manifest) if material else material,
                shader=cls.compact_nested_mesh_refs(shader, geometry_manifest) if shader else shader,
                particle_system=particle_system,
                **extra,
            ))
            layer["time"] = time("unix_ms")

            return layer, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def delete(cls, id):
        try:
            layer = cls._find_layer(id)

            if not layer:
                return {"error": "Mesh layer not found"}, 404

            if int(layer.get("type", -1)) != cls.MATERIAL_LAYER_TYPE:
                return {"error": "Layer is not a mesh layer"}, 400

            LAYERS.remove(layer)
            return {"message": "Mesh layer deleted"}, 200
        except Exception as e:
            return cls.handle_error(e)
