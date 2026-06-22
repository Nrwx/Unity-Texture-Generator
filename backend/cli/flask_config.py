import os
from typing import Any, Dict

from flask import Flask

from .console import Console


class FlaskConfig:
    def __init__(self):
        self.mode = "development"
        self.debug = True
        self.config: Dict[str, Any] = {
            "DEBUG": True,
            "TESTING": False,
            "SECRET_KEY": os.environ.get("SECRET_KEY", "defaultsecret"),
            "SESSION_COOKIE_HTTPONLY": True,
            "SESSION_COOKIE_SECURE": False,
            "PERMANENT_SESSION_LIFETIME": 3600,
            "UPLOAD_FOLDER": "./uploads",
            "MAX_CONTENT_LENGTH": 64 * 1024 * 1024,
            "JSONIFY_PRETTYPRINT_REGULAR": True,
            "JSON_SORT_KEYS": False,
            "PREFERRED_URL_SCHEME": "http",
        }

    def set_mode(self, mode: str):
        if mode and mode.lower() == "production":
            self.mode = "production"
            self.debug = False
            self.config["DEBUG"] = False
            self.config["SESSION_COOKIE_SECURE"] = True
            self.config["PREFERRED_URL_SCHEME"] = "https"
        else:
            self.mode = "development"
            self.debug = True
            self.config["DEBUG"] = True
            self.config["SESSION_COOKIE_SECURE"] = False
            self.config["PREFERRED_URL_SCHEME"] = "http"

    def apply(self, app: Flask):
        app.config.update(self.config)
        Console.print("App config applied.", "FLASK", "CONFIG", None, "info")
        self._log_active_config()

    def _log_active_config(self):
        for key, value in self.config.items():
            if "SECRET" in key.upper() or "PASSWORD" in key.upper() or "TOKEN" in key.upper():
                display_value = "***MASKED***"
            else:
                display_value = value
            Console.print(f"{key}: {display_value}", "FLASK", "KEY", None, "info")

        Console.print(f"App mode: {self.mode}", "FLASK", "CONFIG", None, "info")
        Console.print(f"App debug mode: {self.debug}", "FLASK", "CONFIG", None, "info")
