import os
import platform
import shutil
from config.data.constant import set_nvcompress

def detect_nvcompress():
    """Versucht nvcompress zu finden: zuerst PATH, dann bekannte Pfade."""
    # 1. Prüfe über PATH
    path = shutil.which("nvcompress")
    if path:
        return os.path.abspath(path)

    # 2. Bekannte Orte prüfen
    system = platform.system().lower()
    possible_paths = []
    if system == "windows":
        possible_paths = [
            os.path.expandvars(r"%ProgramFiles%\NVIDIA Corporation\NVIDIA Texture Tools\nvcompress.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\NVIDIA Corporation\NVIDIA Texture Tools\nvcompress.exe"),
            os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "nvcompress.exe"),
        ]
    else:
        possible_paths = [
            "/usr/bin/nvcompress",
            "/usr/local/bin/nvcompress",
            "/opt/nvidia/nvcompress",
            os.path.expanduser("~/.local/bin/nvcompress"),
        ]

    for path in possible_paths:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return os.path.abspath(path)

    return None


def check_nvcompress():
    """Prüft, ob nvcompress verfügbar ist und setzt den Pfad."""
    path = detect_nvcompress()
    if path:
        set_nvcompress(path)
        return True
    return False


def plan_nvcompress():
    """Definiert den Installationsplan für nvcompress."""
    return {
        "id": "NVCOMPRESS",
        "installer_name": "nvcompress",
        "action": "install",
        "check": check_nvcompress,
        "installers": {
            "windows": ["NVIDIA_Texture_Tools_2024.1.1.zip"],
            "linux": ["NVIDIA_Texture_Tools_Linux_x86_64_3.2.5.zip"],
            "arch": ["NVIDIA_Texture_Tools_aarch64_3.2.5.zip"]
        },
        "env_vars": None
    }
