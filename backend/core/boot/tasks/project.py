import os

def project():
    """
    Dynamisch den Projekt-Root und den /backend-Ordner bestimmen.
    Liefert BACKEND_PATH im Set-Format zurück.
    """
    # Startpunkt: aktuelles Arbeitsverzeichnis
    current_path = os.getcwd()

    # 1️⃣ Projekt-Root finden (nimmt den obersten Ordner mit .git, pyproject.toml oder setup.py)
    project_root = None
    while True:
        if any(os.path.exists(os.path.join(current_path, marker)) for marker in [".git", "pyproject.toml", "setup.py"]):
            project_root = current_path
            break
        parent = os.path.dirname(current_path)
        if parent == current_path:
            raise RuntimeError("❌ Projekt-Root konnte nicht gefunden werden.")
        current_path = parent

    # 2️⃣ /backend-Ordner relativ zum Projekt-Root
    BACKEND_PATH = os.path.join(project_root, "backend")
    if not os.path.exists(BACKEND_PATH):
        raise RuntimeError("❌ 'backend'-Ordner konnte im Projekt-Root nicht gefunden werden.")

    # Set-Format
    config_set = {
        "PROJECT_ROOT": {"value": project_root, "type": str},
        "BACKEND_PATH": {"value": BACKEND_PATH, "type": str}
    }

    return config_set


def main():
    return project()
