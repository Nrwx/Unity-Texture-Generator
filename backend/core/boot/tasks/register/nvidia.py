from typing import Callable, Optional

def get_nvidia_gpu(log):
    """
    Gibt ein echtes NVIDIA GPU Objekt zurück (NVML oder Torch CUDA device)
    """
    log(f"Starte Nvidia (pynvml) - (1/2) Registrierungs-Anläufen", "SYSTEM", "INFO", "🔔")
    try:
        import pynvml
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        name = pynvml.nvmlDeviceGetName(handle).decode()
        memory_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        gpu_memory_mb = int(memory_info.total // (1024 * 1024))

        log(f"NVIDIA Grafikkarte (pynvml): '{name}' erfolgreich aktiviert!", "SYSTEM", "INFO", "🔔")
        return {
            "GPU_NAME": name,
            "GPU_MEMORY_MB": gpu_memory_mb,
            "ACTIVE_GPU": {"value": handle, "type": object}
        }

    except Exception as e:
        log(f"Erster Versuch fehlgeschlagen: {e}", "PROCESS", "WARNING", "⚠️")
        log(f"Starte Nvidia (Torch, CUDA) - (2/2) Registrierungs-Anläufen", "SYSTEM", "INFO", "🔔")
        try:
            import torch
            if torch.cuda.is_available():
                device = torch.device("cuda:0")
                name = torch.cuda.get_device_name(0)
                memory_mb = int(torch.cuda.get_device_properties(0).total_memory / (1024 * 1024))
                return {
                    "GPU_NAME": name,
                    "GPU_MEMORY_MB": memory_mb,
                    "ACTIVE_GPU": {"value": device, "type": object}
                }
                log(f"NVIDIA Grafikkarte (Torch, CUDA): '{name}' erfolgreich aktiviert!", "SYSTEM", "INFO", "🔔")
        except Exception as err:
            log(f"Alle Versuche sind fehlgeschlagen: {err}", "PROCESS", "ERROR", "📛")
            log(f"Es konnte keine Nvidia-Grafikkarte registriert werden!", "PROCESS", "WARNING", "⚠️")
    return {"GPU_NAME": "No NVIDIA GPU", "GPU_MEMORY_MB": 0, "ACTIVE_GPU": {"value": None, "type": object}}

def main(log: Callable[[str, str, str, Optional[str]], None]):
    return get_nvidia_gpu(log)