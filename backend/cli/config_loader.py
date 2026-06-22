import json
from pathlib import Path
from typing import Any, Dict, Optional

from .console import Console


class ConfigLoader:
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = Path(config_path) if config_path else Path.cwd() / "build.json"
        self.data: Dict[str, Any] = {}
        if self.config_path.exists():
            self.load(str(self.config_path))

    def load(self, path: str):
        try:
            with open(path, "r", encoding="utf-8") as f:
                self.data = json.load(f)
        except Exception as exc:
            Console.print(f"Failed to load config: {exc}.", "LOADER", "CONFIG", None, "error")
            self.data = {}

    def get(self, key: str, default=None):
        return self.data.get(key, default)

    def save(self, data: Dict[str, Any]):
        try:
            self.data = data
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=4)
            Console.print(f"Config saved to {self.config_path}", "LOADER", "CONFIG", None, "success")
        except Exception as exc:
            Console.print(f"Failed to save config: {exc}.", "LOADER", "CONFIG", None, "error")
