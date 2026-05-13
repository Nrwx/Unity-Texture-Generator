import os
import uuid
import json
import torch

from PIL import Image
from model.base.main import BaseModel
from generated.paths import PUBLIC_LAYER_FOLDER, PUBLIC_BACKUP_FOLDER, PUBLIC_PLUGIN_FOLDER
from config.data.constant import VIEWPORT_CONFIG, LAYERS
from utils import time

from diffusers import AutoPipelineForText2Image, StableDiffusionPipeline


class Local_aiModel(BaseModel):
    _pipe = None
    _loaded_model_key = None
    _loaded_model_source = None

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
                "layer": layer,
                "model": {
                    "key": cls._loaded_model_key,
                    "source": cls._loaded_model_source,
                }
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    # -------------------------------------------------------------------------
    # Registry / Execution Device
    # -------------------------------------------------------------------------

    @classmethod
    def _registry(cls):
        """
        Registry aus syslink holen.

        syslink wird bei dir per Dependency Injection bereitgestellt
        und deshalb hier bewusst nicht importiert.
        """
        try:
            return syslink.get("registry")
        except Exception:
            return None

    @classmethod
    def _registry_value(cls, key, default=None):
        """
        Liest Registry-Werte robust.

        Unterstützt beide Formen:

            USE_GPU = True

        sowie:

            USE_GPU = {
                "value": True,
                "type": bool
            }
        """
        try:
            reg = cls._registry()

            if not reg:
                return default

            raw = reg.get(key)

            if isinstance(raw, dict) and "value" in raw:
                return raw.get("value", default)

            if raw is not None:
                return raw

        except Exception:
            pass

        return default

    @classmethod
    def _registry_wants_gpu(cls):
        """
        Entscheidet anhand deiner GPU-Pipeline-Registry,
        ob GPU bevorzugt werden soll.

        Erwartete Registry-Werte:

            USE_GPU
            REGISTER_GPU
            ACTIVE_GPU
            PREFERRED_UNIT

        GPU wird nur bevorzugt, wenn die GPU wirklich registriert wurde.
        """
        use_gpu = bool(cls._registry_value("USE_GPU", False))
        register_gpu = bool(cls._registry_value("REGISTER_GPU", False))
        active_gpu = cls._registry_value("ACTIVE_GPU", None)
        preferred_unit = str(
            cls._registry_value("PREFERRED_UNIT", "CPU") or "CPU"
        ).upper()

        return bool(
            preferred_unit == "GPU"
            and use_gpu
            and register_gpu
            and active_gpu is not None
        )

    @classmethod
    def _resolve_execution_config(cls):
        """
        Registry entscheidet die Präferenz.
        PyTorch entscheidet, ob das Backend wirklich nutzbar ist.

        Beispiel:
            Registry sagt GPU bevorzugt,
            aber torch.cuda.is_available() ist False
            -> sauberer CPU-Fallback.
        """
        wants_gpu = cls._registry_wants_gpu()

        gpu_name = str(cls._registry_value("GPU_NAME", "") or "")
        gpu_name_lower = gpu_name.lower()

        if wants_gpu:
            # NVIDIA CUDA oder AMD ROCm.
            # ROCm erscheint in PyTorch normalerweise ebenfalls über "cuda".
            try:
                if torch.cuda.is_available():
                    return {
                        "device": "cuda",
                        "dtype": torch.float16,
                        "use_gpu": True,
                        "backend": "cuda",
                        "gpu_name": gpu_name,
                        "reason": "Registry bevorzugt GPU und torch.cuda ist verfügbar.",
                    }
            except Exception:
                pass

            # Intel XPU, falls PyTorch/IPEX entsprechend installiert ist.
            try:
                if hasattr(torch, "xpu") and torch.xpu.is_available():
                    return {
                        "device": "xpu",
                        "dtype": torch.float16,
                        "use_gpu": True,
                        "backend": "xpu",
                        "gpu_name": gpu_name,
                        "reason": "Registry bevorzugt GPU und torch.xpu ist verfügbar.",
                    }
            except Exception:
                pass

            cls._log_model_source(
                "Registry bevorzugt GPU, aber kein kompatibles PyTorch-GPU-Backend ist verfügbar. Fallback auf CPU."
            )

        return {
            "device": "cpu",
            "dtype": torch.float32,
            "use_gpu": False,
            "backend": "cpu",
            "gpu_name": gpu_name,
            "reason": "CPU wird verwendet.",
        }

    # -------------------------------------------------------------------------
    # Pipeline
    # -------------------------------------------------------------------------

    @classmethod
    def _get_pipeline(cls, model_key="sd15"):
        model_key = model_key or "default"
        model_key = model_key.lower().strip()

        model_id = cls.MODEL_MAP.get(model_key, cls.MODEL_MAP["default"])

        candidates = cls._resolve_model_candidates(
            model_key=model_key,
            model_id=model_id
        )

        execution = cls._resolve_execution_config()

        device = execution["device"]
        dtype = execution["dtype"]
        use_gpu = execution["use_gpu"]
        backend = execution["backend"]

        cls._log_model_source(
            f"Local AI Execution: device={device}, backend={backend}, use_gpu={use_gpu}. {execution['reason']}"
        )

        base_kwargs = {
            "torch_dtype": dtype,
            "use_safetensors": True,
        }

        last_error = None

        for candidate in candidates:
            source = candidate["source"]
            source_type = candidate["type"]

            cache_key = f"{model_key}:{source_type}:{source}:{device}:{str(dtype)}"

            if cls._pipe is not None and cls._loaded_model_key == cache_key:
                return cls._pipe

            try:
                cls._log_model_source(
                    f"Local AI versucht Kandidat: {source_type}: {source}"
                )

                pipe = cls._load_pipeline_candidate(
                    candidate=candidate,
                    model_id=model_id,
                    kwargs=base_kwargs,
                    device=device,
                    model_key=model_key
                )

                pipe = pipe.to(device)

                try:
                    pipe.enable_attention_slicing()
                except Exception:
                    pass

                if backend == "cuda":
                    try:
                        pipe.enable_xformers_memory_efficient_attention()
                    except Exception:
                        pass

                cls._pipe = pipe
                cls._loaded_model_key = cache_key
                cls._loaded_model_source = source

                cls._log_model_source(
                    f"Local AI Modell geladen: {model_key} aus {source_type}: {source}"
                )

                return cls._pipe

            except Exception as e:
                last_error = e
                cls._log_model_source(
                    f"Local AI Kandidat fehlgeschlagen: {source_type}: {source} -> {e}"
                )

        raise RuntimeError(
            f"Local AI konnte Modell '{model_key}' nicht laden. "
            f"Letzter Fehler: {last_error}"
        )

    @classmethod
    def _load_pipeline_candidate(cls, candidate, model_id, kwargs, device, model_key=None):
        source = candidate["source"]
        source_type = candidate["type"]

        if source_type == "diffusers_dir":
            return cls._load_from_diffusers_dir(
                source=source,
                kwargs=kwargs,
                model_key=model_key
            )

        if source_type == "single_file":
            return cls._load_from_single_file(
                checkpoint_path=source,
                kwargs=kwargs,
                model_key=model_key
            )

        if source_type == "huggingface":
            return cls._load_from_huggingface(
                model_id=model_id,
                cache_dir=candidate.get("cacheDir"),
                kwargs=kwargs,
                device=device,
                model_key=model_key
            )

        raise ValueError(f"Unbekannter Local-AI-Source-Type: {source_type}")

    @classmethod
    def _load_from_diffusers_dir(cls, source, kwargs, model_key=None):
        """
        Lädt lokale Plugin-Daten als Diffusers-Ordner.

        Für SD 1.5 nutzen wir StableDiffusionPipeline direkt,
        weil dein Plugin safety_checker/* und feature_extractor/*
        absichtlich nicht installiert.
        """
        local_kwargs = dict(kwargs)
        local_kwargs.pop("variant", None)

        common_kwargs = {
            "local_files_only": True,
            "safety_checker": None,
            "feature_extractor": None,
            "requires_safety_checker": False,
        }

        attempts = []

        is_sd15 = str(model_key or "").lower() in ("sd15", "default")

        if is_sd15:
            attempts.append((
                StableDiffusionPipeline,
                {
                    **local_kwargs,
                    **common_kwargs,
                }
            ))

            attempts.append((
                StableDiffusionPipeline,
                {
                    **{k: v for k, v in local_kwargs.items() if k != "use_safetensors"},
                    **common_kwargs,
                }
            ))

        attempts.append((
            AutoPipelineForText2Image,
            {
                **local_kwargs,
                **common_kwargs,
            }
        ))

        attempts.append((
            AutoPipelineForText2Image,
            {
                **{k: v for k, v in local_kwargs.items() if k != "use_safetensors"},
                **common_kwargs,
            }
        ))

        last_error = None

        for pipeline_cls, attempt_kwargs in attempts:
            try:
                return pipeline_cls.from_pretrained(
                    source,
                    **attempt_kwargs
                )

            except TypeError as e:
                last_error = e

                fallback_kwargs = dict(attempt_kwargs)
                fallback_kwargs.pop("requires_safety_checker", None)
                fallback_kwargs.pop("feature_extractor", None)

                try:
                    return pipeline_cls.from_pretrained(
                        source,
                        **fallback_kwargs
                    )
                except Exception as fallback_error:
                    last_error = fallback_error

            except Exception as e:
                last_error = e

        raise last_error

    @classmethod
    def _load_from_single_file(cls, checkpoint_path, kwargs, model_key=None):
        """
        Fallback für SD 1.5 Root-Checkpoints:

            v1-5-pruned.safetensors
            v1-5-pruned-emaonly.safetensors

        Hauptweg bleibt aber der Diffusers-Ordner.
        """
        if not hasattr(StableDiffusionPipeline, "from_single_file"):
            raise RuntimeError(
                "Die installierte diffusers-Version unterstützt "
                "StableDiffusionPipeline.from_single_file nicht."
            )

        single_kwargs = dict(kwargs)
        single_kwargs.pop("variant", None)

        common_kwargs = {
            "local_files_only": True,
            "safety_checker": None,
            "feature_extractor": None,
            "requires_safety_checker": False,
        }

        attempts = [
            {
                **single_kwargs,
                **common_kwargs,
            },
            {
                **{k: v for k, v in single_kwargs.items() if k != "use_safetensors"},
                **common_kwargs,
            },
        ]

        last_error = None

        for attempt_kwargs in attempts:
            try:
                return StableDiffusionPipeline.from_single_file(
                    checkpoint_path,
                    **attempt_kwargs
                )

            except TypeError as e:
                last_error = e

                fallback_kwargs = dict(attempt_kwargs)
                fallback_kwargs.pop("requires_safety_checker", None)
                fallback_kwargs.pop("feature_extractor", None)

                try:
                    return StableDiffusionPipeline.from_single_file(
                        checkpoint_path,
                        **fallback_kwargs
                    )
                except Exception as fallback_error:
                    last_error = fallback_error

            except Exception as e:
                last_error = e

        raise last_error

    @classmethod
    def _load_from_huggingface(cls, model_id, cache_dir, kwargs, device, model_key=None):
        """
        Letzter Fallback:

        Wenn weder Additional Path noch public/plugin ein ladbares Modell haben,
        lädt Diffusers neu und cached unter public/plugin/.local_ai_cache.
        """
        os.makedirs(cache_dir, exist_ok=True)

        hf_kwargs = dict(kwargs)

        if device in ("cuda", "xpu"):
            hf_kwargs["variant"] = "fp16"

        common_kwargs = {
            "cache_dir": cache_dir,
            "local_files_only": False,
            "safety_checker": None,
            "feature_extractor": None,
            "requires_safety_checker": False,
        }

        attempts = []

        is_sd15 = str(model_key or "").lower() in ("sd15", "default")

        if is_sd15:
            attempts.append((
                StableDiffusionPipeline,
                {
                    **hf_kwargs,
                    **common_kwargs,
                }
            ))

            attempts.append((
                StableDiffusionPipeline,
                {
                    **{k: v for k, v in hf_kwargs.items() if k != "variant"},
                    **common_kwargs,
                }
            ))

        attempts.append((
            AutoPipelineForText2Image,
            {
                **hf_kwargs,
                **common_kwargs,
            }
        ))

        attempts.append((
            AutoPipelineForText2Image,
            {
                **{k: v for k, v in hf_kwargs.items() if k != "variant"},
                **common_kwargs,
            }
        ))

        attempts.append((
            AutoPipelineForText2Image,
            {
                **{
                    k: v
                    for k, v in hf_kwargs.items()
                    if k not in ("variant", "use_safetensors")
                },
                **common_kwargs,
            }
        ))

        last_error = None

        for pipeline_cls, attempt_kwargs in attempts:
            try:
                return pipeline_cls.from_pretrained(
                    model_id,
                    **attempt_kwargs
                )

            except TypeError as e:
                last_error = e

                fallback_kwargs = dict(attempt_kwargs)
                fallback_kwargs.pop("requires_safety_checker", None)
                fallback_kwargs.pop("feature_extractor", None)

                try:
                    return pipeline_cls.from_pretrained(
                        model_id,
                        **fallback_kwargs
                    )
                except Exception as fallback_error:
                    last_error = fallback_error

            except Exception as e:
                last_error = e

        raise last_error

    # -------------------------------------------------------------------------
    # Plugin Discovery
    # -------------------------------------------------------------------------

    @classmethod
    def _resolve_model_candidates(cls, model_key: str, model_id: str):
        """
        Reihenfolge:

        1. Additional Path / aktiver PLUGIN_PATH
        2. Standardpfad public/plugin
        3. HuggingFace-Fallback
        """
        candidates = []

        active_plugin_path = cls._get_active_plugin_path()
        standard_plugin_path = os.path.abspath(PUBLIC_PLUGIN_FOLDER)

        search_roots = []

        if active_plugin_path:
            search_roots.append(("active", active_plugin_path))

        search_roots.append(("standard", standard_plugin_path))

        seen_roots = set()

        for source_name, root_path in search_roots:
            root_path = os.path.abspath(os.path.expanduser(root_path))

            if root_path in seen_roots:
                continue

            seen_roots.add(root_path)

            local_candidates = cls._find_plugin_model_candidates(
                plugin_root_dir=root_path,
                model_key=model_key,
                model_id=model_id
            )

            for candidate in local_candidates:
                candidate["pluginSource"] = source_name
                candidates.append(candidate)

        fallback_cache = cls._fallback_cache_dir(model_key)

        candidates.append({
            "type": "huggingface",
            "source": model_id,
            "cacheDir": fallback_cache,
            "reason": "fallback_download"
        })

        return candidates

    @classmethod
    def _find_plugin_model_candidates(cls, plugin_root_dir: str, model_key: str, model_id: str):
        if not plugin_root_dir or not os.path.isdir(plugin_root_dir):
            return []

        candidates = []

        for entry in os.listdir(plugin_root_dir):
            plugin_root = os.path.join(plugin_root_dir, entry)

            if not os.path.isdir(plugin_root):
                continue

            manifest_path = os.path.join(plugin_root, "manifest.json")

            if not os.path.isfile(manifest_path):
                continue

            manifest = cls._read_json(manifest_path)

            if not isinstance(manifest, dict):
                continue

            if not cls._manifest_matches_model(
                manifest=manifest,
                model_key=model_key,
                model_id=model_id
            ):
                continue

            data_path = cls._resolve_plugin_data_path(plugin_root, manifest)

            if not os.path.isdir(data_path):
                cls._log_model_source(
                    f"Plugin gefunden, aber Datenpfad fehlt: {data_path}"
                )
                continue

            if not cls._is_manifest_complete_enough(manifest, data_path):
                cls._log_model_source(
                    f"Plugin gefunden, aber nicht vollständig: {plugin_root}"
                )
                continue

            if cls._looks_like_diffusers_model(data_path):
                candidates.append({
                    "type": "diffusers_dir",
                    "source": data_path,
                    "pluginRoot": plugin_root,
                    "manifestPath": manifest_path,
                    "manifest": manifest,
                })

            single_files = cls._find_single_file_checkpoints(data_path)

            for checkpoint_path in single_files:
                candidates.append({
                    "type": "single_file",
                    "source": checkpoint_path,
                    "pluginRoot": plugin_root,
                    "manifestPath": manifest_path,
                    "manifest": manifest,
                })

        return candidates

    @staticmethod
    def _manifest_matches_model(manifest, model_key: str, model_id: str) -> bool:
        plugin_id = str(
            manifest.get("pluginId")
            or manifest.get("id")
            or ""
        ).lower()

        name = str(manifest.get("name") or "").lower()
        plugin_type = str(manifest.get("type") or "").lower()

        model_key = str(model_key or "").lower()
        model_id = str(model_id or "").lower()

        config = manifest.get("config", {}) or {}

        repo_id = str(config.get("repoId") or "").lower()
        config_model_key = str(
            config.get("modelKey")
            or config.get("localAiModel")
            or config.get("local_ai_model")
            or ""
        ).lower()

        pipeline = str(config.get("pipeline") or "").lower()

        if repo_id and repo_id == model_id:
            return True

        if config_model_key and config_model_key == model_key:
            return True

        if plugin_id == model_key:
            return True

        if model_key in plugin_id or model_key in name:
            return True

        if plugin_type in ("diffusers", "model") and model_key in plugin_id:
            return True

        if pipeline and model_key in pipeline:
            return True

        return False

    @classmethod
    def _is_manifest_complete_enough(cls, manifest, data_path: str) -> bool:
        """
        Manifest muss vollständig sein und Dateien müssen wirklich existieren.

        Falls expectedFiles vorhanden sind, werden sie exakt geprüft.
        """
        if not data_path or not os.path.isdir(data_path):
            return False

        status = manifest.get("status", {}) or {}

        missing_count = int(status.get("missingFileCount") or 0)
        partial_count = int(status.get("partialFileCount") or 0)

        if missing_count > 0 or partial_count > 0:
            return False

        expected_files = status.get("expectedFiles") or []

        if isinstance(expected_files, list) and expected_files:
            for item in expected_files:
                if not isinstance(item, dict):
                    continue

                rel_path = item.get("path")
                expected_size = int(item.get("size") or 0)

                if not rel_path:
                    continue

                file_path = os.path.join(data_path, rel_path)

                if not os.path.isfile(file_path):
                    return False

                if expected_size > 0:
                    try:
                        actual_size = os.path.getsize(file_path)
                    except OSError:
                        return False

                    if actual_size != expected_size:
                        return False

            return True

        installed = status.get("installed") is True
        saved = status.get("saved") is True

        if not installed or not saved:
            return False

        return (
            cls._looks_like_diffusers_model(data_path)
            or bool(cls._find_single_file_checkpoints(data_path))
        )

    @staticmethod
    def _looks_like_diffusers_model(data_path: str) -> bool:
        if not data_path or not os.path.isdir(data_path):
            return False

        model_index = os.path.join(data_path, "model_index.json")

        if not os.path.isfile(model_index):
            return False

        important_entries = [
            "scheduler",
            "tokenizer",
            "text_encoder",
            "unet",
            "vae",
        ]

        existing = [
            name for name in important_entries
            if os.path.isdir(os.path.join(data_path, name))
        ]

        return len(existing) >= 3

    @staticmethod
    def _find_single_file_checkpoints(data_path: str):
        if not data_path or not os.path.isdir(data_path):
            return []

        preferred_names = [
            "v1-5-pruned.safetensors",
            "v1-5-pruned-emaonly.safetensors",
            "sd-v1-5.safetensors",
            "model.safetensors",
        ]

        found = []

        for name in preferred_names:
            path = os.path.join(data_path, name)

            if os.path.isfile(path):
                found.append(path)

        try:
            for entry in os.listdir(data_path):
                if not entry.lower().endswith(".safetensors"):
                    continue

                path = os.path.join(data_path, entry)

                if os.path.isfile(path) and path not in found:
                    found.append(path)

        except Exception:
            pass

        return found

    @staticmethod
    def _resolve_plugin_data_path(plugin_root: str, manifest: dict) -> str:
        status = manifest.get("status", {}) or {}
        paths = manifest.get("paths", {}) or {}
        config = manifest.get("config", {}) or {}

        candidate = (
            status.get("path")
            or paths.get("data")
            or config.get("saveDir")
            or "data"
        )

        if os.path.isabs(str(candidate)):
            return os.path.abspath(str(candidate))

        return os.path.abspath(os.path.join(plugin_root, str(candidate)))

    @classmethod
    def _get_active_plugin_path(cls):
        """Holt den aktiven Plugin-Pfad aus der Registry."""
        try:
            reg = syslink.get("registry")

            if not reg:
                return None

            value = reg.get("PLUGIN_PATH")

            if isinstance(value, dict) and "value" in value:
                value = value.get("value")

            if value:
                return os.path.abspath(os.path.expanduser(str(value)))

        except Exception:
            pass

        return None

    @staticmethod
    def _fallback_cache_dir(model_key: str) -> str:
        return os.path.abspath(
            os.path.join(
                PUBLIC_PLUGIN_FOLDER,
                ".local_ai_cache",
                str(model_key or "default").strip().lower()
            )
        )

    @staticmethod
    def _read_json(path: str):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    @classmethod
    def _log_model_source(cls, message: str):
        """
        Loggt robust, falls ein globaler log-Callback injiziert wurde.

        Kein Import nötig.
        """
        try:
            log(message, "SYSTEM", "LOCAL_AI", "🧠")
        except Exception:
            pass

    # -------------------------------------------------------------------------
    # Utils
    # -------------------------------------------------------------------------

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