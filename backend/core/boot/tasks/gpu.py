import os
import importlib.util
from datetime import datetime
from typing import Callable, Dict, Optional

# Verzeichnisse
CURRENT_PATH = os.path.abspath(os.path.dirname(__file__))
DETECTION_PATH = os.path.join(CURRENT_PATH, "detection")
REGISTER_PATH = os.path.join(CURRENT_PATH, "register")

# === Dynamisches Laden aller .py Dateien im /detection-Ordner ===
DETECT_FUNCS = {}

# === GPU Detection basierend auf Plattform ===
def detect_gpu(os_type, ms_build_tools, task_manager, log):
    detection_methods = []

    if os_type == "windows":
        detection_methods.extend([
            DETECT_FUNCS.get("intel_windows"),
            DETECT_FUNCS.get("dxdiag"),
            DETECT_FUNCS.get("nvidia_smi"),
            DETECT_FUNCS.get("pytorch"),
            DETECT_FUNCS.get("pycuda"),
        ])
        if ms_build_tools:
            detection_methods.append(DETECT_FUNCS.get("pycuda"))
    elif os_type == "linux":
        detection_methods.extend([
            DETECT_FUNCS.get("intel_linux"),
            DETECT_FUNCS.get("rocm_smi"),
            DETECT_FUNCS.get("nvidia_smi"),
            DETECT_FUNCS.get("pytorch"),
        ])
    else:
        detection_methods.extend([
            DETECT_FUNCS.get("nvidia_smi"),
            DETECT_FUNCS.get("pytorch"),
        ])

    detection_methods = [m for m in detection_methods if callable(m)]
    if not detection_methods:
        log(f"keine Methoden verfügbar!", "GPU", "WARNING", "⚠️")
        return False, "No GPU Detection Methods Available", 0

    # --- Wenn TaskManager vorhanden: parallel laufen lassen ---
    if task_manager is not None:
        detectionCount = len(detection_methods)
        log(f"Starte {detectionCount}/{detectionCount} parallele GPU lokalisierungen...", "GPU", "TASK-REQUEST", "🕒")

        tasks = [m.__name__ for m in detection_methods]

        # Arbeitsverzeichnis setzen
        task_manager.set_working_dir(new_dir=DETECTION_PATH, restore=False)

        # ⬇️ Hier ist die entscheidende Änderung
        success, winner, _ = task_manager.run_parallel_tasks_until_true(
            module_names=tasks,
            timeout=5.0
        )

        # Arbeitsverzeichnis zurücksetzen
        task_manager.set_working_dir(new_dir=None, restore=True)

        if success and winner:
            method = next((m for m in detection_methods if m.__name__ == winner), None)
            if method:
                gpu_available, gpu_name, gpu_memory_mb = method(log)
                if gpu_available:
                    log(f"GPU lokalisierung erfolgreich.", "PROCESS", "INFO", "🔔")
                    log(f"device: {gpu_name} | memory: ({gpu_memory_mb} MB)", "GPU", method.__name__, "🧩")
                return gpu_available, gpu_name, gpu_memory_mb

        log(f"Alle {detectCount}/{detectCount} GPU lokalisierungs Versuche sind fehlgeschlagen!", "PROCESS", "WARNING", "⚠️")
        detectCount = len(detection_methods)
        log("es konnte keine Grafikarte erkannt werden.", "GPU", "ERROR", "📛")
        return False, "No GPU Detected", 0

    # --- Fallback: sequentiell ---
    for method in detection_methods:
        try:
            gpu_available, gpu_name, gpu_memory_mb = method()
            if gpu_available:
                log(f"GPU lokalisierung erfolgreich.", "SYSTEM", "INFO", "🔔")
                log(f"Grafikkarte: {gpu_name} | Gesamtspeicher: ({gpu_memory_mb} MB)", "GPU", method.__name__, "🧩")

                return True, gpu_name, gpu_memory_mb
        except Exception as e:
            log(f"es ist ein Fehler in {method.__name__}: {e} aufgetreten!", "GPU", "ERROR", "📛")

    log("es konnte keine Grafikkarte (sequentiell) erkannt werden.", "GPU", "ERROR", "📛")
    return False, "No GPU Available", 0

def register_gpu(gpu_available, gpu_name, log):
    """
    Lädt das passende GPU-Registermodul (intel_dpctl, nvidia, rocm, cpu)
    und gibt nur gpu_available + ACTIVE_GPU zurück.
    """

    # Default-Rückgabe
    result = {
        "USE_GPU": {"value": gpu_available, "type": bool},
        "ACTIVE_GPU": {"value": None, "type": object}
    }

    # Wenn keine GPU erkannt → CPU-Modul laden
    if not gpu_available or not gpu_name:
        gpu_type = "cpu"
    else:
        gpu_name_lower = gpu_name.lower()
        if "intel" in gpu_name_lower:
            gpu_type = "intel_dpctl"
        elif "nvidia" in gpu_name_lower or "geforce" in gpu_name_lower:
            gpu_type = "nvidia"
        elif "amd" in gpu_name_lower or "radeon" in gpu_name_lower:
            gpu_type = "rocm"
        else:
            gpu_type = "cpu"

    register_file = os.path.join(REGISTER_PATH, f"{gpu_type}.py")

    if not os.path.exists(register_file):
        log(f"es konnte kein Registermodul für GPU-Typ '{gpu_type}' gefunden werden!", "PROCESS", "WARNING", "⚠️")
        return result

    try:
        spec = importlib.util.spec_from_file_location(f"register_{gpu_type}", register_file)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        func_name = f"get_{gpu_type}_gpu"
        if hasattr(module, func_name):
            func = getattr(module, func_name)
            gpu_data = func(log)

            if isinstance(gpu_data, dict) and "ACTIVE_GPU" in gpu_data:
                result["ACTIVE_GPU"] = gpu_data["ACTIVE_GPU"]
                log("GPU-Schnittstelle erfolgreich registriert!", "GPU", "INFO", "🔔")
        else:
            log(f"'{func_name}' konnte nicht ausgeführt werden!", "GPU", "WARNING", "⚠️")
    except Exception as e:
        log(f"verarbeiten von '{gpu_type}' fehlgeschlagen: {e}", "GPU", "ERROR", "📛")

    return result

def setup_path(log):
    if os.path.exists(DETECTION_PATH):
        for filename in os.listdir(DETECTION_PATH):
            if not filename.endswith(".py") or filename.startswith("__"):
                continue

            module_name = filename[:-3]
            module_path = os.path.join(DETECTION_PATH, filename)

            spec = importlib.util.spec_from_file_location(module_name, module_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            # Funktion mit gleichem Namen wie Datei laden
            if hasattr(module, module_name):
                func = getattr(module, module_name)
                if callable(func):
                    log(f"Hardware lokalisierung eingeleitet...", "PROCESS", module_name, "🔍️")
                    DETECT_FUNCS[module_name] = func
                else:
                    log(f"{module_name} konnte nicht ausgeführt werden!", "PROCESS", "WARNING", "⚠️")
            else:
                log(f"{module_name} konnte nicht gefunden werden!", "PROCESS", "WARNING", "⚠️")
    else:
        log(f"angegebener Pfad konnte nicht aufgelöst werden: {DETECTION_PATH}", "PROCESS", "WARNING", "⚠️")

# === Hauptfunktion ===
def gpu(os_type, ms_build_tools, task_manager, log):
    setup_path(log)
    gpu_available, gpu_name, gpu_memory_mb = detect_gpu(os_type, ms_build_tools, task_manager, log)

    gpu_data = register_gpu(gpu_available, gpu_name, log)

    preferred_unit = "GPU" if gpu_data["ACTIVE_GPU"] else "CPU"
    gpu_register = bool(gpu_data["ACTIVE_GPU"]["value"])

    return {
        "GPU_NAME": {"value": gpu_name, "type": str},
        "GPU_MEMORY_MB": {"value": gpu_memory_mb, "type": int},
        "PREFERRED_UNIT": {"value": preferred_unit, "type": str},
        "USE_GPU": {"value": gpu_available, "type": bool},
        "ACTIVE_GPU": {"value": gpu_data["ACTIVE_GPU"], "type": object},
        "REGISTER_GPU": {"value": gpu_register, "type": bool}
    }


def main(os_type:str, ms_build_tools:bool, task_manager:object, log:Callable[[str, str, str, Optional[str]], None]):
    return gpu(os_type, ms_build_tools, task_manager, log)
