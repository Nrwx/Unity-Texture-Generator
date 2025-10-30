from typing import Callable, Optional

def pycuda(log):
    """
    GPU-Erkennung über PyCUDA.
    """
    try:
        import pycuda.driver as cuda
        cuda.init()

        if cuda.Device.count() == 0:
            log("Keine GPU über Nvidia PyCUDA gefunden!", "PROCESS", "WARNING", "⚠️")
            return False, "No GPU Available", 0

        device = cuda.Device(0)
        gpu_name = device.name()
        gpu_memory_mb = device.total_memory() // (1024 ** 2)

        msg = f"GPU erfolgreich über Nvidia PyCUDA erkannt: {gpu_name} ({gpu_memory_mb} MB VRAM)"
        log(msg, "PROCESS", "INFO", "🔔")
        return True, gpu_name, gpu_memory_mb

    except ImportError:
        log("Nvidia PyCUDA ist nicht installiert!", "PROCESS", "WARNING", "⚠️")
        return False, "PyCUDA not installed", 0

    except Exception as e:
        log(f"Während der GPU-Erkennung über Nvidia PyCUDA ist ein Fehler aufgetreten: {e}", "PROCESS", "ERROR", "📛")
        return False, "Error", 0


def main(log: Callable[[str, str, str, Optional[str]], None]):
    return pycuda(log)
