import os
import json
from typing import Optional, Dict, Any
from .console import Console
from pathlib import Path

class ConfigLoader:
    def __init__(self, config_path: Optional[str] = None):
        # normalize path: if None, point to default in project root
        self.config_path = Path(config_path) if config_path else Path.cwd() / "config.json"
        self.data: Dict[str, Any] = {}
        if self.config_path.exists():
            self.load(str(self.config_path))
        else:
            Console.print(f"Keine Konfiguration geladen unter: {self.config_path}, verwende Defaults.", "LOADER", "CONFIG", "⚠️️", "warning")

    def load(self, path: str):
        try:
            with open(path, "r", encoding="utf-8") as f:
                self.data = json.load(f)
            Console.print(f"Konfiguration geladen von {path}", "LOADER", "CONFIG", "⚙️", "info")
        except Exception as e:
            Console.print(f"Fehler beim Laden der Konfiguration: {e}.", "LOADER", "CONFIG", "❌️", "error")
            self.data = {}

    def get(self, key: str, default=None):
        return self.data.get(key, default)

    def save(self, data: Dict[str, Any]):
        try:
            self.data = data
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=4)
            Console.print(f"Konfiguration gespeichert nach {self.config_path}", "LOADER", "CONFIG", "✔️", "success")
        except Exception as e:
            Console.print(f"Fehler beim Speichern der Konfiguration: {e}.", "LOADER", "CONFIG", "❌️", "error")
