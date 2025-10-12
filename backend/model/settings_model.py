from utils.api.time import time
from config.app.manager.global_manager import GlobalManager

GLOBAL_MANAGER = GlobalManager()

class SettingsModel:
    @staticmethod
    def get_settings():
        """
        Gibt die aktuellen Einstellungen aus dem GlobalManager zurück.
        Alle relevanten Keys werden direkt abgefragt.
        """
        return {
            "use_gpu": GLOBAL_MANAGER.get("USE_GPU"),
            "gpu_name": GLOBAL_MANAGER.get("GPU_NAME"),
            "gpu_memory_mb": GLOBAL_MANAGER.get("GPU_MEMORY_MB"),
            "cpu_threads": GLOBAL_MANAGER.get("OS_THREADS"),
            "preferred_unit": GLOBAL_MANAGER.get("PREFERRED_UNIT"),
            "time": time("unix_ms"),
        }, 200

    @staticmethod
    def update_settings(use_gpu=None, gpu_name=None, gpu_memory_mb=None, cpu_threads=None, preferred_unit=None):

        if use_gpu is not None:
            GLOBAL_MANAGER.set("USE_GPU", use_gpu, bool)

        if gpu_name is not None:
            GLOBAL_MANAGER.set("GPU_NAME", gpu_name, str)

        if gpu_memory_mb is not None:
            GLOBAL_MANAGER.set("GPU_MEMORY_MB", gpu_memory_mb, int)

        if cpu_threads is not None:
            GLOBAL_MANAGER.set("CPU_THREADS", cpu_threads, int)

        if preferred_unit is not None:
            GLOBAL_MANAGER.set("PREFERRED_UNIT", preferred_unit, str)

        return SettingsModel.get_settings()
