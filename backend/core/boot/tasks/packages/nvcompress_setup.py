import os
import platform
import shutil

NVCOMPRESS_PATH = {
    "id": "NVCOMPRESS_PATH",
    "value": None,
    "type": str,
}

def detect_nvcompress(log):
    """Versucht nvcompress zu finden: zuerst PATH, dann bekannte Pfade."""
    log("Software lokalisierung eingeleitet...", "DRIVER", "nvcompress", "🔍")

    # 1. Prüfe über PATH
    path = shutil.which("nvcompress")
    if path:
        abs_path = os.path.abspath(path)
        log(f"'nvcompress' gefunden über Umgebungsvariabeln!", "DRIVER", "INFO", "🔔")
        return abs_path
    else:
        log("'nvcompress' nicht über Installationspfad gefunden.", "DRIVER", "WARNING", "⚠️")

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

    for p in possible_paths:
        if os.path.isfile(p) and os.access(p, os.X_OK):
            abs_path = os.path.abspath(p)
            log(f"'nvcompress' gefunden unter Installationspfad!'", "DRIVER", "INFO", "🔔")
            return abs_path
        else:
            log(f"'nvcompress' Installationspfad nicht vorhanden oder ausführbar: '{p}'", "DRIVER", "WARNING", "⚠️")

    log("'nvcompress' konnte nicht gefunden werden.", "DRIVER", "ERROR", "📛")
    return None

def set_nvcompress(path, log):
    NVCOMPRESS_PATH["value"] = path
    log(f"'nvcompress'-Pfad gesetzt: {path}", "SYSTEM", "LINK", "🔗")

def check_nvcompress(log):
    """Prüft, ob nvcompress verfügbar ist und setzt den Pfad."""
    path = detect_nvcompress(log)
    if path:
        set_nvcompress(path, log)
        log("'nvcompress' ist verfügbar!", "SYSTEM", "INFO", "🔔")
        return True
    else:
        log("'nvcompress' ist nicht verfügbar!", "SYSTEM", "WARNING", "⚠️")
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
        "env_vars": None,
        "return": NVCOMPRESS_PATH
    }
