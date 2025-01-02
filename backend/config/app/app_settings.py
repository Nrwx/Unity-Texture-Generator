import os
import json

def get_gpu_info():
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            gpu_memory_mb = torch.cuda.get_device_properties(0).total_memory // (1024 ** 2)  # In MB
            return True, gpu_name, gpu_memory_mb
        else:
            return False, "None", 0
    except ImportError:
        return False, "None", 0
    except Exception as e:
        print(f"Fehler bei der Erkennung der GPU: {e}")
        return False, "None", 0

CPU_THREADS = os.cpu_count()

DEFAULT_ANIMATION_SETTINGS = {
    "use_gpu": False,
    "gpu_name": "None",
    "gpu_memory_mb": 0,
    "cpu_threads": CPU_THREADS,
    "preferred_unit": "CPU",
}

SETTINGS_FILE_PATH = 'config/app/app_settings.json'

def load_app_settings():
    """Lädt die gespeicherten Einstellungen aus einer JSON-Datei oder gibt die Standardwerte zurück."""
    if os.path.exists(SETTINGS_FILE_PATH):
        with open(SETTINGS_FILE_PATH, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                print("Ungültige JSON-Datei. Verwende Standardwerte.")
    return DEFAULT_ANIMATION_SETTINGS.copy()

def save_app_settings(updated_settings):
    os.makedirs(os.path.dirname(SETTINGS_FILE_PATH), exist_ok=True)
    with open(SETTINGS_FILE_PATH, 'w') as f:
        json.dump(updated_settings, f, indent=4)

def update_settings_if_changed():
    global ANIMATION_SETTINGS

    GPU_AVAILABLE, GPU_NAME, GPU_MEMORY_MB = get_gpu_info()

    current_settings = load_app_settings()

    updated_settings = {
        "use_gpu": GPU_AVAILABLE,
        "gpu_name": GPU_NAME,
        "gpu_memory_mb": GPU_MEMORY_MB,
        "cpu_threads": CPU_THREADS,
        "preferred_unit": "GPU" if GPU_AVAILABLE else "CPU",
    }

    if current_settings != updated_settings:
        save_app_settings(updated_settings)

    ANIMATION_SETTINGS = updated_settings

ANIMATION_SETTINGS = load_app_settings()
update_settings_if_changed()

def get_app_settings():
    GPU_AVAILABLE, GPU_NAME, GPU_MEMORY_MB = get_gpu_info()
    current_settings = load_app_settings()
    current_settings.update({
        "use_gpu": GPU_AVAILABLE,
        "gpu_name": GPU_NAME,
        "gpu_memory_mb": GPU_MEMORY_MB,
        "preferred_unit": "GPU" if GPU_AVAILABLE else "CPU",
    })
    save_app_settings(current_settings)
    return current_settings
