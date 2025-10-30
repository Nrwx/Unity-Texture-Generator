import os
import subprocess
import json

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


def detect_vsbtools_2022(log):
    """
    Prüft, ob Visual Studio Build Tools 2022 installiert sind.
    Gibt True zurück, wenn Build Tools 2022 gefunden wurden.
    """
    log("Software lokalisierung eingeleitet...", "DRIVER", "vsbtools", "🔍")
    build_tools_root = r"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"
    if not os.path.exists(build_tools_root):
        log(f"Microsoft Build Tools Pfad nicht gefunden: '{build_tools_root}'!", "DRIVER", "WARNING", "⚠️")
        return False

    vswhere_path = find_vswhere()
    if not vswhere_path:
        log(f"Microsoft Build Tools 'vswhere.exe' nicht gefunden: {build_tools_root}!", "DRIVER", "ERROR", "📛")
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
            log("Keine Microsoft Visual Studio-Installationen über 'vswhere.exe' gefunden!", "DRIVER", "WARNING", "⚠️")
            return False

        data = json.loads(result.stdout)
        for item in data:
            path = item.get("installationPath", "")
            version = item.get("installationVersion", "")
            name = item.get("displayName", "")

            if ("BuildTools" in path or "Build Tools" in name) and version.startswith("17."):
                log(f"Microsoft Visual StudioIBuild Tools 2022 erkannt: {name} | {version}", "DRIVER", "INFO", "🔔")
                return True

        log("Keine Microsoft Visual Studio-Build Tools erkannt!", "DRIVER", "WARNING", "⚠️")
        return False

    except subprocess.CalledProcessError as e:
        log(f"Fehler beim Aufruf von vswhere.exe: {e}", "DRIVER", "ERROR", "📛")
        return False
    except json.JSONDecodeError as e:
        log(f"Fehler beim Lesen des JSON-Ausgabeformats von vswhere.exe: {e}", "DRIVER", "ERROR", "📛")
        return False
    except Exception as e:
        log(f"Unerwarteter Fehler: {e}", "DRIVER", "ERROR", "📛")
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
