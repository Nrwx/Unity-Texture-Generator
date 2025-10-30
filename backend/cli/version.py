from pathlib import Path
from .console import Console

def print_version_info():
    # project root is one level up from cli folder
    project_root = Path(__file__).resolve().parents[1]
    version_file = project_root / "version.txt"
    patch_file = project_root / "patch.txt"
    if version_file.exists():
        ver = version_file.read_text(encoding="utf-8").strip()
        Console.print(f"Backend-Version: '{ver}'", "BACKEND-CLI", "INFO", "🔔", "success")
    else:
        Console.print(f"Backend-Version: 'unbekannt'", "BACKEND-CLI", "WARNING", "⚠️", "warning")
    if patch_file.exists():
        Console.print(f"Backend Patch Notes:", "BACKEND-CLI", "INFO", "🔔", "success")
        for line in patch_file.read_text(encoding="utf-8").splitlines():
            Console.print(f"{line}", "PATCH", "NOTES", "🔔", "info")
    else:
        Console.print(f"Patch Notes nicht gefunden...", "BACKEND-CLI", "WARNING", "⚠️", "warning")
