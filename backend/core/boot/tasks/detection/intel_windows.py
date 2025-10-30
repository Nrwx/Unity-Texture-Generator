from typing import Callable, Optional
import os
import subprocess


def intel_windows(log):
    """
    Intel GPU-Erkennung unter Windows über dxdiag oder WMIC.
    """
    try:
        try:
            import chardet
        except ImportError:
            chardet = None
        if not chardet:
            log("Das Modul 'chardet' ist nicht installiert. Bitte führe 'pip install chardet' aus.", "PROCESS", "WARNING", "⚠️")
            return False, "chardet not installed", 0

        import tempfile

        # --- Erkennung via dxdiag ---
        with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as temp_file:
            temp_path = temp_file.name

        result = subprocess.run(["dxdiag", "/t", temp_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        if result.returncode == 0 and os.path.exists(temp_path):
            with open(temp_path, 'rb') as raw_file:
                raw_data = raw_file.read()
                detected = chardet.detect(raw_data)
                encoding = detected['encoding'] or 'utf-8'
                text = raw_data.decode(encoding, errors="ignore")

            os.remove(temp_path)

            gpu_name = None
            gpu_memory_mb = 0

            for line in text.splitlines():
                if "Card name" in line and "Intel" in line:
                    gpu_name = line.split(":", 1)[1].strip()
                if "Display Memory" in line and "MB" in line:
                    mem_str = ''.join(filter(str.isdigit, line))
                    if mem_str.isdigit():
                        gpu_memory_mb = int(mem_str)

            if gpu_name:
                msg = f"Intel-GPU erkannt über dxdiag: {gpu_name}"
                if gpu_memory_mb > 0:
                    msg += f" ({gpu_memory_mb} MB VRAM)"
                else:
                    msg += " (VRAM konnte nicht ermittelt werden)"
                log(msg, "PROCESS", "INFO", "🔔")
                return True, gpu_name, gpu_memory_mb

        log("Intel-GPU konnte über dxdiag nicht erkannt werden. Führe Fallback über WMIC aus...", "PROCESS", "WARNING", "⚠️")

        # --- Alternative: Erkennung via WMIC ---
        result = subprocess.run(
            ["wmic", "path", "win32_videocontroller", "get", "name,adapterram"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        gpu_name = None
        gpu_memory_mb = 0

        for line in result.stdout.splitlines():
            if "Intel" in line:
                parts = line.strip().split()
                if len(parts) >= 2:
                    # letzte Spalte = Speicher in Bytes
                    try:
                        gpu_memory_bytes = int(parts[-1])
                        gpu_memory_mb = gpu_memory_bytes // (1024 ** 2)
                        gpu_name = " ".join(parts[:-1]).strip()
                    except ValueError:
                        gpu_name = line.strip()
                    break

        if gpu_name:
            msg = f"Intel-GPU erkannt über WMIC: {gpu_name}"
            if gpu_memory_mb > 0:
                msg += f" ({gpu_memory_mb} MB VRAM)"
            else:
                msg += " (VRAM konnte nicht ermittelt werden)"
            log(msg, "PROCESS", "INFO", "🔔")
            return True, gpu_name, gpu_memory_mb

        log("Keine Intel-GPU über dxdiag oder WMIC gefunden.", "PROCESS", "WARNING", "⚠️")
        return False, "No Intel GPU Available", 0

    except Exception as e:
        log(f"Während der Intel-GPU-Erkennung unter Windows ist ein Fehler aufgetreten: {e}", "PROCESS", "ERROR", "📛")
        return False, "Error", 0


def main(log:Callable[[str, str, str, Optional[str]], None]):
    return intel_windows(log)
