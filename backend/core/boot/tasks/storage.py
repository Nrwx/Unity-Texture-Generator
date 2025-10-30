import os
from pathlib import Path
from typing import Dict, Any, List


# --- Konfiguration ---
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
    "__DRIVER": {}
}

CACHE_CLEAR = ["temp", "__DRIVER"]
CURRENT_SESSION = ["layer", "public/font", "static", "backup", "public/path"]
ASSET_FILES = ["assets"]


# --- Hilfsfunktionen ---
def get_directory_size(path: Path) -> tuple[int, int]:
    total_size = 0
    file_count = 0
    for root, _, files in os.walk(path):
        for f in files:
            try:
                fp = Path(root) / f
                total_size += fp.stat().st_size
                file_count += 1
            except FileNotFoundError:
                continue
    return file_count, total_size


def find_folder_path(base: Path, folder_name: str) -> List[Path]:
    """
    Durchsucht FOLDER_STRUCTURE UND reale Unterordner nach einem bestimmten Namen.
    """
    found_paths = []

    # 1️⃣ – Suche in FOLDER_STRUCTURE
    def _recurse(base_path: Path, struct: Dict[str, Any]):
        for key, value in struct.items():
            current = base_path / key
            if key == folder_name:
                found_paths.append(current)
            if isinstance(value, dict):
                _recurse(current, value)
            elif isinstance(value, list):
                for sub in value:
                    if sub == folder_name:
                        found_paths.append(current / sub)

    _recurse(base, FOLDER_STRUCTURE)

    # 2️⃣ – Suche in realen Unterordnern (z. B. public/*, assets/*)
    for root, dirs, _ in os.walk(base):
        for d in dirs:
            if d == folder_name:
                found_paths.append(Path(root) / d)

    return list(set(found_paths))  # Duplikate vermeiden


# --- Hauptanalyse ---
def storage(path: str, development: bool = True, log_level: int = 2) -> Dict[str, Any]:
    base = Path(path)
    categories = {
        "CACHE_FILES": CACHE_CLEAR,
        "SESSION_FILES": CURRENT_SESSION,
        "ASSET_FILES": ASSET_FILES
    }

    total_size = 0
    total_files = 0
    category_summaries = {}
    path_categories = {}

    for category, folders in categories.items():
        cat_size = 0
        cat_files = 0
        all_paths = []

        for folder in folders:
            if "/" in folder or "\\" in folder:
                p = base / folder
                if p.exists():
                    fcount, fsize = get_directory_size(p)
                    cat_size += fsize
                    cat_files += fcount
                    all_paths.append(str(p.resolve()))
            else:
                paths = find_folder_path(base, folder)
                for p in paths:
                    if p.exists():
                        fcount, fsize = get_directory_size(p)
                        cat_size += fsize
                        cat_files += fcount
                        all_paths.append(str(p.resolve()))

        category_summaries[category] = {
            "files": cat_files,
            "size_bytes": cat_size,
            "size_mb": round(cat_size / (1024 * 1024), 2),
            "percent": 0
        }

        path_key = category.replace("_FILES", "_PATH")
        path_categories[path_key] = {"value": all_paths, "type": list}

        total_size += cat_size
        total_files += cat_files

    for cat, data in category_summaries.items():
        data["percent"] = round((data["size_bytes"] / total_size) * 100, 2) if total_size > 0 else 0

    category_summaries["TOTAL_FILES"] = {
        "files": total_files,
        "size_bytes": total_size,
        "size_mb": round(total_size / (1024 * 1024), 2),
        "percent": 100.0
    }

    info_index = {cat: {"value": data, "type": dict} for cat, data in category_summaries.items()}
    info_index.update(path_categories)

    return info_index


def main(path: str, development: bool, log_level: int):
    return storage(path, development, log_level)
