import os
import subprocess
import json
import logging

logging.basicConfig(level=logging.INFO)

def find_vswhere():
    """Sucht vswhere.exe auf dem System."""
    candidates = [
        r"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe",
        r"C:\Program Files\Microsoft Visual Studio\Installer\vswhere.exe",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def detect_vsbtools_2022():
    """
    Prüft, ob Visual Studio Build Tools 2022 installiert sind.
    Gibt True zurück, wenn Build Tools 2022 gefunden wurden.
    """
    build_tools_root = r"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"
    if not os.path.exists(build_tools_root):
        logging.warning(f"⚠️ Build Tools Pfad nicht gefunden: {build_tools_root}")
        return False

    vswhere_path = find_vswhere()
    if not vswhere_path:
        logging.warning("❌ vswhere.exe nicht gefunden")
        return False

    try:
        result = subprocess.run(
            [
                vswhere_path,
                "-products", "*",
                "-format", "json",
                "-all"
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",  # <-- robust gegen Unicode
            errors="ignore",   # <-- ignoriert unlesbare Zeichen
            check=True
        )

        if not result.stdout:
            logging.warning("⚠️ Keine VS-Installationen über vswhere gefunden")
            return False

        data = json.loads(result.stdout)
        for item in data:
            path = item.get("installationPath", "")
            version = item.get("installationVersion", "")
            name = item.get("displayName", "")

            if ("BuildTools" in path or "Build Tools" in name) and version.startswith("17."):
                logging.info(f"✅ VS Build Tools 2022 erkannt: {name} | {version} | {path}")
                return True

        logging.warning("⚠️ Keine VS 2022 Build Tools erkannt")
        return False

    except subprocess.CalledProcessError as e:
        logging.error(f"❌ Fehler beim Aufruf von vswhere.exe: {e}")
        return False
    except json.JSONDecodeError:
        logging.error("❌ Fehler beim Lesen des JSON-Ausgabeformats von vswhere.exe")
        return False
    except Exception as e:
        logging.error(f"❌ Unerwarteter Fehler: {e}")
        return False



def plan_vsbtools():
    """
    Definiert den Installationsplan für Visual Studio Build Tools 2022.
    Nutzt detect_vsbtools_2022 als Prüffunktion.
    """
    return {
        "id": "MS_BUILD_TOOLS",
        "installer_name": "vs_BuildTools_2022",
        "action": "install",
        "check": detect_vsbtools_2022,
        "installers": {
            "windows": ["vs_BuildTools.zip"],
            "linux": [],
            "arch": []
        },
        "watch": [
            r"C:\Program Files (x86)\Microsoft Visual Studio\Installer\Setup.exe",
            r"C:\Program Files\Microsoft Visual Studio\Installer\Setup.exe"
        ],
        "env_vars": None
    }
