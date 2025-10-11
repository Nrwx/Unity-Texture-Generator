import importlib.util
import sys
import os
import shutil
from pathlib import Path
from config.app.manager.global_manager import GlobalManager
from datetime import datetime

SETUP_DIR = Path(__file__).parent
TASKS_DIR = SETUP_DIR / "tasks"

GLOBAL_MANAGER = GlobalManager()  # Singleton

SETUP_MODULES = [
    "sudo.py",
    "system.py",
    "project.py",
    "path.py"
]

# Modul-spezifische Pre-Actions
PRE_ACTIONS = {
    "generate_paths": lambda name, path: (
        shutil.rmtree("generated") if os.path.exists("generated") else None
     )
}

# Modul-spezifische Parameter für main(**kwargs)
MODULE_PARAMS = {
    "sudo": lambda: {
        "development": True,
        "log_level": 3
    },
    "system": lambda: {
        "development": GLOBAL_MANAGER.get("DEVELOPMENT"),
        "log_level": GLOBAL_MANAGER.get("LOG_LEVEL")
    },
    "path": lambda: {
        "backend_path": GLOBAL_MANAGER.get("BACKEND_PATH")
    }
}

# Helper für Zeitstempel
def now_iso():
    return datetime.now().isoformat(sep=" ", timespec="seconds")

def run_module(file_path: Path):
    module_name = file_path.stem
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None:
        print(f"[{now_iso()}][WARN] Konnte Modul {module_name} nicht laden.")
        return

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module

    if module_name in PRE_ACTIONS and callable(PRE_ACTIONS[module_name]):
        PRE_ACTIONS[module_name](module_name, file_path)
        print(f"[{now_iso()}][PRE-ACTION] Modul '{module_name}' vorbereitet.")

    try:
        print(f"[{now_iso()}][START] Modul '{module_name}' wird ausgeführt...")
        spec.loader.exec_module(module)

        # Falls das Modul eine main()-Funktion hat
        result = None
        if hasattr(module, "main") and callable(module.main) and module_name in MODULE_PARAMS:
            params = MODULE_PARAMS[module_name]()
            result = module.main(**params)
        elif hasattr(module, "main") and callable(module.main):
            # erlaubt Module ohne definierte Parameterliste
            result = module.main()

        # Optional warten auf Threads
        if hasattr(module, "wait_for_completion") and callable(module.wait_for_completion):
            module.wait_for_completion()

        GLOBAL_MANAGER.set(f"{module_name}_completed", True, bool)

        # 1️⃣ Prüfen auf GLOBAL_RETURN
        if hasattr(module, "GLOBAL_RETURN"):
            ret = module.GLOBAL_RETURN
        # 2️⃣ Falls kein GLOBAL_RETURN, prüfen ob Funktions-Return vorhanden
        elif isinstance(result, dict):
            ret = result
        else:
            ret = None

        # 3️⃣ Wenn RETURN im Set-Format, im GlobalManager speichern
        if isinstance(ret, dict) and all(
            isinstance(v, dict) and "value" in v and "type" in v for v in ret.values()
        ):
            for key, val in ret.items():
                GLOBAL_MANAGER.set(key, val["value"], val["type"])
            print(f"[{now_iso()}][OK] Modul '{module_name}' abgeschlossen. RETURN im Set-Format gespeichert.")
        else:
            print(f"[{now_iso()}][OK] Modul '{module_name}' abgeschlossen. (kein RETURN oder kein Set-Format)")

    except Exception as e:
        GLOBAL_MANAGER.set(f"{module_name}_completed", False, bool)
        print(f"[{now_iso()}][FEHLER] Modul '{module_name}' konnte nicht ausgeführt werden: {e}")

def init_setup():
    total_modules = len(SETUP_MODULES)
    print(f"[{now_iso()}] === Starte Setup Wrapper ===")

    for idx, file_name in enumerate(SETUP_MODULES, start=1):
        file_path = TASKS_DIR / file_name
        progress_percent = int((idx - 1) / total_modules * 100)  # Fortschritt vor Ausführung
        print(f"[{now_iso()}] Fortschritt: {progress_percent}% ({idx-1}/{total_modules} Module abgeschlossen)")

        if file_path.exists():
            run_module(file_path)
        else:
            print(f"[{now_iso()}][SKIPPED] Datei '{file_name}' nicht gefunden.")

    print(f"[{now_iso()}] Fortschritt: 100% ({total_modules}/{total_modules} Module abgeschlossen)")
    print(f"[{now_iso()}] === Setup Wrapper abgeschlossen ===")
