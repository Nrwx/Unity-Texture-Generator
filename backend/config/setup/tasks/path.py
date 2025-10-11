import os
import shutil
from typing import Any, Dict

FOLDER_STRUCTURE = {
    "public": {
        "temp": ["upload", "channel", "mask", "cursor", "render"],
        "layer": None,
        "font": None,
        "brush": None,
        "static": None,
        "backup": None,
        "path": None
    },
    "assets": {
        "brush": None,
        "font": None,
        "path": None,
        "driver": ["windows", "linux", "aarch64"],
    },
    "__DRIVER": {
    }
}

FOLDERS_TO_RESET = ["public", "__DRIVER"]

ROOT_PATH = None
OUTPUT_DIR = None
OUTPUT_MODULE = None

def set_paths(backend_path):
    global ROOT_PATH, OUTPUT_DIR, OUTPUT_MODULE
    ROOT_PATH = os.path.abspath(backend_path)
    OUTPUT_DIR = os.path.join(ROOT_PATH, "generated")
    OUTPUT_MODULE = os.path.join(OUTPUT_DIR, "paths.py")


def clean_folders(folders):
    global ROOT_PATH
    for folder in folders:
        abs_path = os.path.join(ROOT_PATH, folder)
        if os.path.exists(abs_path):
            shutil.rmtree(abs_path)
        os.makedirs(abs_path, exist_ok=True)
        if "generated" in folder:
            create_init(abs_path)

def create_init(folder_path: str):
    init_file = os.path.join(folder_path, '__init__.py')
    if not os.path.exists(init_file):
        with open(init_file, 'w', encoding='utf-8'):
            pass

def create_structure(base_paths: Dict[str, Any]) -> Dict[str, str]:
    created_paths = {}

    def recurse(base, structure):
        for key, val in structure.items():
            path = os.path.join(base, key)
            os.makedirs(path, exist_ok=True)
            if "generated" in path:
                create_init(path)

            rel_path = os.path.relpath(path, ROOT_PATH).replace("\\", "/")
            rel_parts = rel_path.split("/")
            const_name = '_'.join(part.upper() for part in rel_parts)
            created_paths[const_name] = rel_path

            if isinstance(val, dict):
                recurse(path, val)
            elif isinstance(val, list):
                for sub in val:
                    sub_path = os.path.join(path, sub)
                    os.makedirs(sub_path, exist_ok=True)
                    if "generated" in sub_path:
                        create_init(sub_path)
                    sub_rel_path = os.path.relpath(sub_path, ROOT_PATH).replace("\\", "/")
                    sub_rel_parts = sub_rel_path.split("/")
                    sub_const = '_'.join(part.upper() for part in sub_rel_parts)
                    created_paths[sub_const] = sub_rel_path

    for root, structure in base_paths.items():
        abs_root = os.path.join(ROOT_PATH, root)
        os.makedirs(abs_root, exist_ok=True)
        if "generated" in abs_root:
            create_init(abs_root)
        created_paths[root.upper()] = root
        if structure:
            recurse(abs_root, structure)

    return created_paths

def write_paths_module(paths: Dict[str, str]):
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
    print(f"✅ Pfadmodul geschrieben: {OUTPUT_MODULE}")

def init_paths(backend_path):
    set_paths(backend_path)
    clean_folders(FOLDERS_TO_RESET)
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    created = create_structure(FOLDER_STRUCTURE)
    write_paths_module(created)

def main(backend_path):
    init_paths(backend_path)
