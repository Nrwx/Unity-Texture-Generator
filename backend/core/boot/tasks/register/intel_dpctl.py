from typing import Callable, Optional

def get_intel_dpctl_gpu(log):
    """
    Erstellt ein Intel GPU Objekt über dpctl (SYCL)
    und gibt es im standardisierten Schema zurück.
    """
    log("Starte Intel (dpctl) - (1/1) Registrierungs-Anläufen", "SYSTEM", "INFO", "🔔")
    try:
        import dpctl
        device = dpctl.select_default_device()
        gpu_name = device.name
        gpu_memory_mb = int(device.global_mem_size // (1024 * 1024))

        log(f"Intel Grafikkarte (dpctl): '{gpu_name}' erfolgreich aktiviert!", "SYSTEM", "INFO", "🔔")

        return {
            "GPU_NAME": {"value": gpu_name, "type": str},
            "GPU_MEMORY_MB": {"value": gpu_memory_mb, "type": int},
            "ACTIVE_GPU": {"value": device, "type": object}
        }

    except Exception as e:
        log(f"Alle Versuche sind fehlgeschlagen: {e}", "PROCESS", "ERROR", "📛")
        log(f"Es konnte keine Intel-Grafikkarte registriert werden!", "PROCESS", "WARNING", "⚠️")
        return {
            "GPU_NAME": {"value": "No Intel GPU", "type": str},
            "GPU_MEMORY_MB": {"value": 0, "type": int},
            "ACTIVE_GPU": {"value": None, "type": object}
        }

def main(log: Callable[[str, str, str, Optional[str]], None]):
    return get_intel_dpctl_gpu(log)