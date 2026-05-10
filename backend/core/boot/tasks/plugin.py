import os
from typing import Optional, Dict, Any

def plugin(
    backend_path: str,
    plugin_path: Optional[str] = None,
    project_name: Optional[str] = None
) -> Dict[str, Dict[str, Any]]:
    #Initialisiert nur den Plugin-Pfad und gibt ihn im Registry-Set-Format zurück.

    if not backend_path:
        raise ValueError("backend_path fehlt")

    backend_path = os.path.abspath(os.path.expanduser(backend_path))

    safe_project_name = str(project_name or "app").strip().replace(" ", "_")

    public_plugin_path = os.path.join(backend_path, "public", "plugin")
    asset_plugin_path = os.path.join(backend_path, "assets", "plugin")

    if plugin_path:
        base_plugin_path = os.path.abspath(os.path.expanduser(plugin_path))
        active_plugin_path = os.path.join(base_plugin_path, f".{safe_project_name}")
    else:
        active_plugin_path = public_plugin_path

    os.makedirs(active_plugin_path, exist_ok=True)

    return {
        "PLUGIN_PATH": {
            "value": active_plugin_path,
            "type": str
        }
    }


def main(
    backend_path: str,
    plugin_path: Optional[str] = None,
    project_name: Optional[str] = None
):
    return plugin(
        backend_path=backend_path,
        plugin_path=plugin_path,
        project_name=project_name
    )