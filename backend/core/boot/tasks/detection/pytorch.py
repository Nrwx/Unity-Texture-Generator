from typing import Callable, Optional

def pytorch(log):
    """
    GPU Detection via PyTorch (CUDA-Verfügbarkeit prüfen).
    """
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            gpu_memory_mb = torch.cuda.get_device_properties(0).total_memory // (1024 ** 2)
            log(f"Nvdia-GPU mit PyTorch erfolgreich lokalisiert: {gpu_name} ({gpu_memory_mb} MB)", "PROCESS", "INFO", "🔔")
            return True, gpu_name, gpu_memory_mb
        else:
            log("Nvdia-GPU konnte nicht mit PyTorch lokalisiert werden", "PROCESS", "WARNING", "⚠️")
            return False, "No GPU Available", 0
    except ImportError:
        log("Nvdia PyTorch ist nicht installiert!", "PROCESS", "WARNING", "⚠️")
        return False, "PyTorch not installed", 0
    except Exception as e:
        log(f"Während der Nvidia PyTorch-GPU lokalisierung ist ein fehler aufgetreten: {e}", "PROCESS", "ERROR", "📛")
        return False, "Error", 0

def main(log:Callable[[str, str, str, Optional[str]], None]):
    return pytorch(log)