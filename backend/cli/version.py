from pathlib import Path

from .console import Console


def print_version_info():
    project_root = Path(__file__).resolve().parents[1]
    version_file = project_root / "version.txt"
    patch_file = project_root / "patch.txt"

    if version_file.exists():
        version = version_file.read_text(encoding="utf-8").strip()
        Console.print(f"Backend version: '{version}'", "BACKEND-CLI", "INFO", None, "success")
    else:
        Console.print("Backend version: unknown", "BACKEND-CLI", "WARNING", None, "warning")

    if patch_file.exists():
        Console.print("Backend patch notes:", "BACKEND-CLI", "INFO", None, "success")
        for line in patch_file.read_text(encoding="utf-8").splitlines():
            Console.print(line, "PATCH", "NOTES", None, "info")
    else:
        Console.print("Patch notes not found.", "BACKEND-CLI", "WARNING", None, "warning")
