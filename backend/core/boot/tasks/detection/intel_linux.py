from typing import Callable, Optional
import subprocess
import re

def intel_linux(log):
    """
    Intel GPU-Erkennung unter Linux über lspci.
    Installiere 'pciutils'
    Liest Name und (falls verfügbar) VRAM aus.
    """
    try:
        # Hauptscan – GPU finden
        result = subprocess.run(["lspci"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        intel_device_line = None
        for line in result.stdout.splitlines():
            if "VGA compatible controller" in line and "Intel" in line:
                intel_device_line = line
                break

        if not intel_device_line:
            log("Keine Intel-GPU über lspci gefunden!", "PROCESS", "WARNING", "⚠️")
            return False, "No Intel GPU Available", 0

        # GPU-Name ermitteln
        gpu_name = intel_device_line.split(":")[2].strip() if ":" in intel_device_line else "Unbekannte Intel GPU"

        # Detaillierte Infos zum Gerät abfragen (VRAM, falls vorhanden)
        bus_id = intel_device_line.split()[0]  # z. B. "00:02.0"
        detail_result = subprocess.run(["lspci", "-v", "-s", bus_id], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        gpu_memory_mb = 0
        for dline in detail_result.stdout.splitlines():
            # Beispiel: "Memory at d0000000 (64-bit, non-prefetchable) [size=256M]"
            match = re.search(r"\[size=(\d+)([KMG])\]", dline)
            if match:
                size_value = int(match.group(1))
                unit = match.group(2)
                if unit == "G":
                    gpu_memory_mb = size_value * 1024
                elif unit == "M":
                    gpu_memory_mb = size_value
                elif unit == "K":
                    gpu_memory_mb = size_value // 1024
                break

        if gpu_memory_mb > 0:
            log(f"Intel-GPU erkannt: {gpu_name} ({gpu_memory_mb} MB VRAM)", "PROCESS", "INFO", "🔔")
        else:
            log(f"Intel-GPU erkannt: {gpu_name}", "PROCESS", "INFO", "🔔")

        return True, gpu_name, gpu_memory_mb

    except FileNotFoundError:
        log("Dienstprogramm 'lspci' wurde nicht gefunden!", "PROCESS", "WARNING", "⚠️")
        return False, "lspci not found", 0

    except Exception as e:
        log(f"Während der Intel-GPU-Erkennung über lspci ist ein Fehler aufgetreten: {e}", "PROCESS", "ERROR", "📛")
        return False, "Error", 0


def main(log: Callable[[str, str, str, Optional[str]], None]):
    return intel_linux(log)
