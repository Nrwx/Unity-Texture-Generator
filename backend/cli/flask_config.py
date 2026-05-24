import os
from typing import Dict, Any
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
            "PREFERRED_URL_SCHEME": "http"
        }

    # ------------------------------------------
    # Flask Mode
    # ------------------------------------------
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

        Console.print(f"App-Modus festgelegt: '{self.mode}'", "FLASK", "INFO", "🔔", "success")

    # ------------------------------------------
    # Anwenden + Logging
    # ------------------------------------------
    def apply(self, app: Flask):
        app.config.update(self.config)
        Console.print(f"App-Konfiguration erfolgreich angewendet", "FLASK", "CONFIG", "⚙️", "info")
        Console.print(f"Administrative Einstellungen wurden geändert", "FLASK", "WARNING", "⚠️", "warning")
        self._log_active_config()

    # ------------------------------------------
    # Key Logger
    # ------------------------------------------
    def _log_active_config(self):
        """
        Gibt alle aktiven Config-Keys und deren Werte aus.
        Sensible Werte (z. B. SECRET_KEY) werden maskiert.
        """
        Console.print(f"Datensätze initialisieren", "FLASK", "REGISTERY", "🔒️", "warning")

        for key, value in self.config.items():
            # Maskiere sensible Werte
            if "SECRET" in key.upper() or "PASSWORD" in key.upper() or "TOKEN" in key.upper():
                display_value = "***MASKIERT***"
            else:
                display_value = value

            Console.print(f"{key}: {display_value}", "FLASK", "KEY", "🗝️", "warning")

        Console.print(f"App-Modus: {self.mode}", "FLASK", "CONFIG", "⚙️", "info")
        Console.print(f"App-Debug-Modus: {self.debug}", "FLASK", "CONFIG", "⚙️", "info")
