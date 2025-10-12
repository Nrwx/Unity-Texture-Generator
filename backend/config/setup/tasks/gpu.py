import os
import logging
import importlib.util
# === Logging / Setup ===
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# Verzeichnisse
CURRENT_PATH = os.path.abspath(os.path.dirname(__file__))
DETECTION_PATH = os.path.join(CURRENT_PATH, "detection")

# === Dynamisches Laden aller .py Dateien im /detection-Ordner ===
DETECT_FUNCS = {}

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
                DETECT_FUNCS[module_name] = func
                logging.info(f"🧩 Detection geladen: {module_name}() aus {filename}")
            else:
                logging.warning(f"⚠️ {module_name} in {filename} ist nicht callable.")
        else:
            logging.warning(f"⚠️ Keine Funktion {module_name}() in {filename} gefunden.")
else:
    logging.warning(f"⚠️ Detection-Verzeichnis nicht gefunden: {DETECTION_PATH}")

# === GPU Detection basierend auf Plattform ===
def detect_gpu(os_type, ms_build_tools):
    detection_methods = []

    if os_type == "windows":
        detection_methods.extend([
            DETECT_FUNCS.get("intel_windows"),
            DETECT_FUNCS.get("dxdiag"),
            DETECT_FUNCS.get("nvidia_smi"),
            DETECT_FUNCS.get("pytorch"),
            DETECT_FUNCS.get("pycuda"),
        ])
        if ms_build_tools is True:
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

    # Nur callable Methoden behalten
    detection_methods = [m for m in detection_methods if callable(m)]

    if not detection_methods:
        logging.warning("⚠️ Keine GPU-Detection-Methoden verfügbar.")
        return False, "No GPU Detection Methods Available", 0

    # Alle Methoden der Reihe nach ausführen
    for method in detection_methods:
        try:
            gpu_available, gpu_name, gpu_memory_mb = method()
            if gpu_available:
                logging.info(f"✅ GPU erkannt durch {method.__name__}: {gpu_name} ({gpu_memory_mb} MB)")
                return True, gpu_name, gpu_memory_mb
        except Exception as e:
            logging.error(f"❌ Fehler in {method.__name__}: {e}")

    logging.info("⚠️ Keine GPU erkannt.")
    return False, "No GPU Available", 0


# === Hauptfunktion ===
def gpu(os_type, ms_build_tools):
    gpu_available, gpu_name, gpu_memory_mb = detect_gpu(os_type, ms_build_tools)

    preferred_unit = "GPU" if gpu_available else "CPU"

    print("=== GPU Detection Initialisiert ===")
    print(f"USE_GPU        : {gpu_available}")
    print(f"GPU_NAME       : {gpu_name}")
    print(f"GPU_MEMORY_MB  : {gpu_memory_mb}")
    print(f"PREFERRED_UNIT : {preferred_unit}")
    print("===================================")

    return {
        "USE_GPU": {"value": gpu_available, "type": bool},
        "GPU_NAME": {"value": gpu_name, "type": str},
        "GPU_MEMORY_MB": {"value": gpu_memory_mb, "type": int},
        "PREFERRED_UNIT": {"value": preferred_unit, "type": str}
    }


def main(os_type, ms_build_tools):
    return gpu(os_type, ms_build_tools)
