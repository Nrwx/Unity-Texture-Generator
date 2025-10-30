# core/api/api.py
import importlib
from typing import Dict, Any, List, Optional

class Api:
    """
    Resource provider: hält eine resource_map und injiziert nur die in der
    Route geforderten libs in Zielobjekte (Blueprint, Controller-Klasse, Model-Klasse).
    resource_map: z.B. {"syslink": syslink_obj, "log": log_callable, "task_manager": tm}
    """

    def __init__(self, resource_map: Dict[str, Any], log=None):
        self.resource_map = resource_map or {}
        self.log = log

    def inject(self, target: object, libs: List[str]):
        """
        Injiziert die angegebenen libs (Namen) als Attribute in target.
        target kann eine Klasse (Controller/Model) oder ein Blueprint-Objekt sein.
        """
        if not libs:
            return

        for lib_name in libs:
            if lib_name in self.resource_map:
                try:
                    setattr(target, lib_name, self.resource_map[lib_name])
                    self.log(f"Injektiere '{lib_name}' in {getattr(target, '__name__', getattr(target, 'name', str(target)))}", "API" "INJECT", "🔗")
                except Exception as e:
                    self.log(f"Fehler beim Injizieren '{lib_name}' in {target}: {e}", "ERROR", "📛")
            else:
                self.log(f"Ressource '{lib_name}' nicht in resource_map vorhanden, überspringe", "WARN", "⚠️")

    def has(self, name: str) -> bool:
        return name in self.resource_map
