import os
import shutil
from utils.api.time import time
from model.base.main import BaseModel
from typing import Dict, Any, Optional, Iterable, Callable

class SettingsModel(BaseModel):
    """
    SettingsModel: verwaltet System-, GPU-, CPU- und Performance-Einstellungen.
    """

    @classmethod
    def _registry(cls):
        return syslink.get("registry")

    @classmethod
    def fetch(cls):
        try:
            r = cls._registry()
            settings_data = {
                "os_type": r.get("OS_TYPE"),
                "os_arch": r.get("OS_ARCH"),
                "os_memory_gb": r.get("OS_MEMORY"),
                "use_gpu": r.get("USE_GPU"),
                "gpu_name": r.get("GPU_NAME"),
                "gpu_memory_mb": r.get("GPU_MEMORY_MB"),
                "preferred_unit": r.get("PREFERRED_UNIT"),
                "cpu_name": r.get("OS_CPU"),
                "cpu_threads": r.get("OS_THREADS"),
                "system_score": r.get("SYSTEM_SCORE"),
                "system_rating": r.get("SYSTEM_RATING"),
                "recommended_ram_gb": r.get("RECOMMENDED_RAM_GB"),
                "recommended_cpu_threads": r.get("RECOMMENDED_CPU_THREADS"),
                "recommended_gpu_gb": r.get("RECOMMENDED_GPU_GB"),
                "cache_files": r.get("CACHE_FILES"),
                "session_files": r.get("SESSION_FILES"),
                "asset_files": r.get("ASSET_FILES"),
                "total_files": r.get("TOTAL_FILES"),
                "meta": None
            }
            settings_meta = {
                "last_update_unix_ms": time("unix_ms"),
                "data_version": 1.1,
                "settings_count": len(settings_data)
            }
            settings_data["meta"] = settings_meta

            return settings_data, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def update(cls, **kwargs):
        try:
            r = cls._registry()
            for key, val_type in [
                ("OS_TYPE", str), ("OS_ARCH", str), ("OS_CPU", str), ("OS_MEMORY", float),
                ("USE_GPU", bool), ("GPU_NAME", str), ("GPU_MEMORY_MB", int),
                ("PREFERRED_UNIT", str), ("CPU_THREADS", int),
                ("SYSTEM_SCORE", float), ("SYSTEM_RATING", str),
                ("RECOMMENDED_RAM_GB", float), ("RECOMMENDED_CPU_THREADS", int),
                ("RECOMMENDED_GPU_GB", float)
            ]:
                if kwargs.get(key.lower()) is not None:
                    r.set(key, kwargs[key.lower()], val_type)

            # META
            r.set("LAST_UPDATE", time("unix_ms"), int)
            return cls.fetch()
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def clear(cls, id: str):
        try:
            r = cls._registry()
            cache_base = r.get("CACHE_PATH")
            if not cache_base:
                return {"error": "CACHE_PATH not set in registry"}, 400

            for path in cache_base:
                if os.path.exists(path):
                    if os.path.isdir(path):
                        shutil.rmtree(path)
                    else:
                        os.remove(path)

                os.makedirs(path, exist_ok=True)
                print(f"Cache cleared for project {id}, path: {path}")
            return {"message": f"Cache cleared for project {id}"}, 200
        except Exception as e:
            return cls.handle_error(e)
