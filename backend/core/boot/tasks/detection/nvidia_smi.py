from typing import Callable, Optional
import subprocess


def nvidia_smi(log):
    """
    NVIDIA GPU-Erkennung über nvidia-smi.
    """
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        if result.returncode == 0 and result.stdout.strip():
            first_line = result.stdout.strip().splitlines()[0]
            parts = [p.strip() for p in first_line.split(",")]

            if len(parts) >= 2:
                gpu_name = parts[0]
                try:
                    gpu_memory_mb = int(parts[1])
                except ValueError:
                    gpu_memory_mb = 0

                msg = f"NVIDIA-GPU erkannt über nvidia-smi: {gpu_name}"
                if gpu_memory_mb > 0:
                    msg += f" ({gpu_memory_mb} MB VRAM)"
                else:
                    msg += " (VRAM konnte nicht ermittelt werden)"
                log(msg, "PROCESS", "INFO", "🔔")
                return True, gpu_name, gpu_memory_mb

        log("Keine NVIDIA-GPU über nvidia-smi gefunden!", "PROCESS", "WARNING", "⚠️")
        return False, "No NVIDIA GPU Available", 0

    except FileNotFoundError:
        log("'nvidia-smi' konnte nicht gefunden werden!", "PROCESS", "ERROR", "📛")
        return False, "nvidia-smi not found", 0

    except Exception as e:
        log(f"Während der NVIDIA-GPU-Erkennung über nvidia-smi ist ein Fehler aufgetreten: {e}", "PROCESS", "ERROR", "📛")
        return False, "Error", 0


def main(log: Callable[[str, str, str, Optional[str]], None]):
    return nvidia_smi(log)
