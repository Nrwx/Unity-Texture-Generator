import os
import uuid
import torch

from PIL import Image
from model.base.main import BaseModel
from generated.paths import PUBLIC_LAYER_FOLDER, PUBLIC_BACKUP_FOLDER
from config.data.constant import VIEWPORT_CONFIG, LAYERS
from utils import time

from diffusers import AutoPipelineForText2Image


class Local_aiModel(BaseModel):
    _pipe = None
    _loaded_model_key = None

    MODEL_MAP = {
        "sd15": "runwayml/stable-diffusion-v1-5",
        "sdxl": "stabilityai/stable-diffusion-xl-base-1.0",
        "default": "runwayml/stable-diffusion-v1-5",
    }

    @classmethod
    def generate_image(cls, prompt, model="sd15", size="512x512", layer_type=0):
        try:
            if not prompt:
                return {"error": "Prompt fehlt."}, 400

            width, height = cls._parse_size(size)
            pipe = cls._get_pipeline(model)

            result = pipe(
                prompt=prompt,
                width=width,
                height=height,
                num_inference_steps=25,
                guidance_scale=7.0
            )

            image = result.images[0].convert("RGBA")

            source_id = str(uuid.uuid4())
            source_path = os.path.join(PUBLIC_BACKUP_FOLDER, f"{source_id}.png")
            image.save(source_path)

            layer_id = str(uuid.uuid4())
            layer_path = os.path.join(PUBLIC_LAYER_FOLDER, f"{layer_id}.png")

            viewport_width = VIEWPORT_CONFIG[0]["width"]
            viewport_height = VIEWPORT_CONFIG[0]["height"]

            original_width, original_height = image.size

            scale_factor = min(
                viewport_width / original_width,
                viewport_height / original_height
            )

            if scale_factor < 1:
                new_width = int(original_width * scale_factor)
                new_height = int(original_height * scale_factor)

                image = image.resize((new_width, new_height), Image.LANCZOS)
                image.save(layer_path)

                translate_x = int((viewport_width - new_width) / 2)
                translate_y = int((viewport_height - new_height) / 2)
            else:
                image.save(layer_path)

                new_width = original_width
                new_height = original_height

                translate_x = int((viewport_width - original_width) / 2)
                translate_y = int((viewport_height - original_height) / 2)

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
                "time": time("unix_ms"),
                "type": layer_type,
                "id": layer_id,
                "name": prompt[:10],
                "width": new_width,
                "height": new_height,
                "url": f"/download/{layer_id}.png",
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

            return {
                "message": "Lokales KI-Bild erfolgreich generiert und Layer hinzugefügt.",
                "layer": layer
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def _get_pipeline(cls, model_key="sd15"):
        model_key = model_key or "default"
        model_key = model_key.lower().strip()

        model_id = cls.MODEL_MAP.get(model_key, cls.MODEL_MAP["default"])

        if cls._pipe is not None and cls._loaded_model_key == model_key:
            return cls._pipe

        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32

        kwargs = {
            "torch_dtype": dtype,
            "use_safetensors": True
        }

        if device == "cuda":
            kwargs["variant"] = "fp16"

        pipe = AutoPipelineForText2Image.from_pretrained(
            model_id,
            **kwargs
        )

        pipe = pipe.to(device)

        try:
            pipe.enable_attention_slicing()
        except Exception:
            pass

        if device == "cuda":
            try:
                pipe.enable_xformers_memory_efficient_attention()
            except Exception:
                pass

        cls._pipe = pipe
        cls._loaded_model_key = model_key

        return cls._pipe

    @staticmethod
    def _parse_size(size):
        if not size:
            return 512, 512

        if isinstance(size, str):
            size = size.lower().replace(" ", "")

            if "x" in size:
                width_raw, height_raw = size.split("x", 1)
                width = int(width_raw)
                height = int(height_raw)
            else:
                width = height = int(size)

        elif isinstance(size, (list, tuple)) and len(size) == 2:
            width = int(size[0])
            height = int(size[1])
        else:
            width, height = 512, 512

        width = int(round(width / 8) * 8)
        height = int(round(height / 8) * 8)

        width = max(256, min(width, 1024))
        height = max(256, min(height, 1024))

        return width, height