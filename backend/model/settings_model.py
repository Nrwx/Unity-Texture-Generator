from utils.api.time import time
from config.app.manager.global_manager import GlobalManager

GLOBAL_MANAGER = GlobalManager()

class SettingsModel:
    @staticmethod
    def get_settings():
        settings_data = {
            "system": {
                "os_type": GLOBAL_MANAGER.get("OS_TYPE"),
                "os_arch": GLOBAL_MANAGER.get("OS_ARCH"),
                "os_memory_gb": GLOBAL_MANAGER.get("OS_MEMORY"),
            },
            "gpu": {
                "use_gpu": GLOBAL_MANAGER.get("USE_GPU"),
                "gpu_name": GLOBAL_MANAGER.get("GPU_NAME"),
                "gpu_memory_mb": GLOBAL_MANAGER.get("GPU_MEMORY_MB"),
                "preferred_unit": GLOBAL_MANAGER.get("PREFERRED_UNIT"),
            },
            "cpu": {
                "cpu_name": GLOBAL_MANAGER.get("OS_CPU"),
                "cpu_threads": GLOBAL_MANAGER.get("OS_THREADS"),
            },
            "performance": {
                "system_score": GLOBAL_MANAGER.get("SYSTEM_SCORE"),
                "system_rating": GLOBAL_MANAGER.get("SYSTEM_RATING"),
                "recommended_ram_gb": GLOBAL_MANAGER.get("RECOMMENDED_RAM_GB"),
                "recommended_cpu_threads": GLOBAL_MANAGER.get("RECOMMENDED_CPU_THREADS"),
                "recommended_gpu_gb": GLOBAL_MANAGER.get("RECOMMENDED_GPU_GB"),
            },
            "meta": {
                "last_update_unix_ms": time("unix_ms"),
                "data_version": 1.0,
            },
        }

        return settings_data, 200

    @staticmethod
    def update_settings(
        use_gpu=None,
        gpu_name=None,
        gpu_memory_mb=None,
        cpu_threads=None,
        preferred_unit=None,
        os_type=None,
        os_arch=None,
        os_cpu=None,
        os_memory=None,
        system_score=None,
        system_rating=None,
        recommended_ram_gb=None,
        recommended_cpu_threads=None,
        recommended_gpu_gb=None,
    ):

        # === SYSTEM ===
        if os_type is not None:
            GLOBAL_MANAGER.set("OS_TYPE", os_type, str)
        if os_arch is not None:
            GLOBAL_MANAGER.set("OS_ARCH", os_arch, str)
        if os_cpu is not None:
            GLOBAL_MANAGER.set("OS_CPU", os_cpu, str)
        if os_memory is not None:
            GLOBAL_MANAGER.set("OS_MEMORY", os_memory, float)

        # === GPU ===
        if use_gpu is not None:
            GLOBAL_MANAGER.set("USE_GPU", use_gpu, bool)
        if gpu_name is not None:
            GLOBAL_MANAGER.set("GPU_NAME", gpu_name, str)
        if gpu_memory_mb is not None:
            GLOBAL_MANAGER.set("GPU_MEMORY_MB", gpu_memory_mb, int)
        if preferred_unit is not None:
            GLOBAL_MANAGER.set("PREFERRED_UNIT", preferred_unit, str)

        # === CPU ===
        if cpu_threads is not None:
            GLOBAL_MANAGER.set("CPU_THREADS", cpu_threads, int)
        # === PERFORMANCE ===
        if system_score is not None:
            GLOBAL_MANAGER.set("SYSTEM_SCORE", system_score, float)

        if system_rating is not None:
            GLOBAL_MANAGER.set("SYSTEM_RATING", system_rating, str)
        if recommended_ram_gb is not None:
            GLOBAL_MANAGER.set("RECOMMENDED_RAM_GB", recommended_ram_gb, float)
        if recommended_cpu_threads is not None:
            GLOBAL_MANAGER.set("RECOMMENDED_CPU_THREADS", recommended_cpu_threads, int)
        if recommended_gpu_gb is not None:
            GLOBAL_MANAGER.set("RECOMMENDED_GPU_GB", recommended_gpu_gb, float)

        # === META ===
        GLOBAL_MANAGER.set("LAST_UPDATE", time("unix_ms"), int)

        return SettingsModel.get_settings()
