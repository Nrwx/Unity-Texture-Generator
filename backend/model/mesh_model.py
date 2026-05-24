import copy
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

            layer.update(cls._mesh_payload(
                geometry=geometry,
                mesh=mesh,
                settings=settings,
                preview=preview,
                viewport_camera=viewport_camera,
                material=material,
                shader=shader,
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

            layer.update(cls._mesh_payload(
                geometry=geometry,
                mesh=mesh,
                settings=settings,
                preview=preview,
                viewport_camera=viewport_camera,
                material=material,
                shader=shader,
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
