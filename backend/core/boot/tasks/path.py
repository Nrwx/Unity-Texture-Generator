import os
import shutil
from typing import Any, Dict, Callable, Optional
import time

FOLDER_STRUCTURE = {
    "public": {
        "temp": ["upload", "channel", "mask", "cursor", "render"],
        "layer": None,
        "font": None,
        "shader": None,
        "brush": None,
        "static": None,
        "backup": None,
        "path": None
    },
    "assets": {
        "brush": None,
        "font": None,
        "path": None,
        "shader": None,
        "driver": ["windows", "linux", "aarch64"],
    },
    "__DRIVER": None
}

FOLDERS_TO_RESET = ["public", "__DRIVER"]

ROOT_PATH = None
OUTPUT_DIR = None
OUTPUT_MODULE = None

def set_paths(backend_path, log):
    global ROOT_PATH, OUTPUT_DIR, OUTPUT_MODULE
    ROOT_PATH = os.path.abspath(backend_path)
    OUTPUT_DIR = os.path.join(ROOT_PATH, "generated")
    OUTPUT_MODULE = os.path.join(OUTPUT_DIR, "paths.py")
    log(f"Arbeitsverzeichnis initialisiert unter: '{ROOT_PATH}'", "SYSTEM", "PATH", "📂")

def clean_folders(folders, log):
    global ROOT_PATH

    total = len(folders)
    cleaned = 0

    log(f"intialisiere Bereinigung von {total} Datein...", "SYSTEM", "CLEAN", "🔔")

    for folder in folders:
        abs_path = os.path.join(ROOT_PATH, folder)
        start_time = time.time()

        if os.path.exists(abs_path):
            shutil.rmtree(abs_path)
            log(f"löschen der Datei: '{folder}' erfolgreich... ", "SYSTEM", "CLEAN", "🧹")

        os.makedirs(abs_path, exist_ok=True)
        if "generated" in folder:
            create_init(abs_path)

        cleaned += 1
        elapsed = time.time() - start_time
        progress = (cleaned / total) * 100

        log(f"Bereinigung zu [{cleaned}/{total}] {progress:.1f}% abgeschlossen ({elapsed:.2f}s)",
            "SYSTEM", "CLEAN", "🕒")

    log(f"Bereinigung abgeschlossen: {cleaned}/{total} erfolgreich entfernt!",
        "SYSTEM", "CLEAN", "🔔")


def create_init(folder_path: str):
    init_file = os.path.join(folder_path, '__init__.py')
    if not os.path.exists(init_file):
        with open(init_file, 'w', encoding='utf-8'):
            pass

def create_structure(base_paths: Dict[str, Any], log) -> Dict[str, str]:
    created_paths = {}

    # 🧮 Hilfsfunktion zum Zählen aller zu erstellenden Pfade
    def count_total(structure) -> int:
        if not structure:
            return 0
        if isinstance(structure, dict):
            count = len(structure)
            for v in structure.values():
                count += count_total(v)
            return count
        elif isinstance(structure, list):
            return len(structure)
        return 0

    total = sum(count_total(v) + 1 for v in base_paths.values())
    created = 0

    log(f"Starte Pfad-Strukturaufbau ({total} Verzeichnisse geplant)...", "SYSTEM", "PATH", "🗂️")

    def recurse(base, structure):
        nonlocal created

        if structure is None:
            return
        if not isinstance(structure, (dict, list)):
            log(f"Ungültige Pfad Struktur: '{type(structure).__name__}'!", "SYSTEM", "WARN", "⚠️")
            return

        if isinstance(structure, dict):
            for key, val in structure.items():
                path = os.path.join(base, key)
                os.makedirs(path, exist_ok=True)

                created += 1
                progress = (created / total) * 100
                log(f"[{created}/{total}] {progress:.1f}% erstellt...", "SYSTEM", "PATH", "📁")

                # ⚙️ __init__.py nur für Unterordner innerhalb von OUTPUT_DIR
                if "generated" in path and path != OUTPUT_DIR:
                    create_init(path)
                    log(f"Init-Datei erzeugt für generierten Pfad...", "SYSTEM", "PATH", "🔗")

                rel_path = os.path.relpath(path, ROOT_PATH).replace("\\", "/")
                rel_parts = rel_path.split("/")
                const_name = '_'.join(part.upper() for part in rel_parts)
                created_paths[const_name] = rel_path

                recurse(path, val)

        elif isinstance(structure, list):
            for sub in structure:
                if not isinstance(sub, str):
                    log(f"Ungültiger Pfad Listeneintrag!", "SYSTEM", "WARN", "⚠️")
                    continue

                sub_path = os.path.join(base, sub)
                os.makedirs(sub_path, exist_ok=True)
                created += 1
                progress = (created / total) * 100
                log(f"[{created}/{total}] {progress:.1f}% erstellt...", "SYSTEM", "PATH", "📂")

                if "generated" in sub_path and sub_path != OUTPUT_DIR:
                    create_init(sub_path)
                    log(f"Init-Datei erzeugt für generierten Unterpfad...", "SYSTEM", "PATH", "🔗")

                sub_rel_path = os.path.relpath(sub_path, ROOT_PATH).replace("\\", "/")
                sub_rel_parts = sub_rel_path.split("/")
                sub_const = '_'.join(part.upper() for part in sub_rel_parts)
                created_paths[sub_const] = sub_rel_path

    for root, structure in base_paths.items():
        abs_root = os.path.join(ROOT_PATH, root)
        os.makedirs(abs_root, exist_ok=True)

        created += 1
        progress = (created / total) * 100
        log(f"[{created}/{total}] {progress:.1f}% erstellt...", "SYSTEM", "PATH", "🗂️")

        # ⚙️ OUTPUT_DIR selbst nicht als generierten Unterordner behandeln
        if "generated" in abs_root and abs_root != OUTPUT_DIR:
            create_init(abs_root)
            log(f"Init-Datei erzeugt für generierten Hauptpfad...", "SYSTEM", "PATH", "🔗")

        created_paths[root.upper()] = root

        if structure:
            recurse(abs_root, structure)

    log(f"Pfad-Strukturaufbau: {created}/{total} Verzeichnisse erfolgreich erstellt.", "SYSTEM", "INFO", "🔔")

    return created_paths


def write_paths_module(paths: Dict[str, str], log):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    create_init(OUTPUT_DIR)  # Nur hier wird __init__.py erstellt

    lines = [
        '# Dieses Modul wird automatisch generiert\n',
        'import os\n\n'
    ]
    for const, rel_path in sorted(paths.items()):
        lines.append(f'{const}_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", r"{rel_path}"))\n')

    with open(OUTPUT_MODULE, "w", encoding="utf-8") as f:
        f.writelines(lines)
    log("Pfadmodul erfolgreich generiert...", "PROCESS", "INFO", "🧩")

def init_paths(backend_path, log):
    set_paths(backend_path, log)
    clean_folders(FOLDERS_TO_RESET, log)
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    created = create_structure(FOLDER_STRUCTURE, log)
    write_paths_module(created, log)

def main(backend_path:str, log:Callable[[str, str, str, Optional[str]], None]):
    init_paths(backend_path, log)
