import threading
import time
from typing import Optional
import subprocess
import platform
from pathlib import Path
import importlib

from .console import Console
from .flask_config import FlaskConfig
from .logger import Logger


class BackendApp:
    def __init__(self, flask_config: FlaskConfig, logger: Logger):
        self.flask_config = flask_config
        self.logger = logger
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._build_lock = threading.RLock()

    # -----------------------------------------------------------
    # 🔥 FLASK SERVER CONTROL
    # -----------------------------------------------------------
    def _run_flask(self):
        self.logger.log(
            f"Flask-App startet im Modus: '{self.flask_config.mode}'",
            "BACKEND",
            "FLASK",
            "🚀",
            "success"
        )
        try:
            # top-level app import (expects `app` variable)
            from app import app  # noqa: E402
            self.flask_config.apply(app)
            app.run(debug=self.flask_config.debug, use_reloader=False)
        except Exception as e:
            self.logger.log(
                f"Fehler beim Starten der Flask-App: {e}",
                "BACKEND",
                "FLASK",
                "❌️",
                "error"
            )

    def start(self, wait: bool = False, external: bool = False):
        """
        Startet den Flask-Server.
        - wait=True: blockiert CLI, bis Server beendet.
        - external=True: öffnet neuen OS-Terminalprozess mit `python app.py`.
        """
        if external:
            self._start_external(wait=wait)
            return

        if self._thread and self._thread.is_alive():
            self.logger.log(
                "Flask-App läuft bereits.",
                "BACKEND",
                "FLASK",
                "⚠️",
                "warning"
            )
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_flask, daemon=True)
        self._thread.start()
        self.logger.log(
            "Flask-App erfolgreich im Hintergrund gestartet.",
            "BACKEND",
            "FLASK",
            "✅",
            "success"
        )

        if wait:
            self.logger.log(
                "Warte auf Flask-Thread (Ctrl+C zum Abbrechen)...",
                "BACKEND",
                "FLASK",
                "⏳",
                "info"
            )
            self._thread.join()

    def _start_external(self, wait: bool = False):
        """
        Startet Flask im separaten Terminal (plattformabhängig).
        """
        os_name = platform.system().lower()
        command = ["python", "app.py"]

        try:
            if "windows" in os_name:
                cmd = ["cmd", "/c", "start"]
                if wait:
                    cmd = ["cmd", "/k"]  # blockierend im gleichen Fenster
                subprocess.Popen(cmd + ["python", "app.py"], shell=True)
            elif "linux" in os_name or "darwin" in os_name:
                # Suche ein passendes Terminal
                for term in ["x-terminal-emulator", "gnome-terminal", "konsole", "xterm"]:
                    if Path(f"/usr/bin/{term}").exists():
                        subprocess.Popen([term, "-e", "python3 app.py"])
                        break
                else:
                    self.logger.log(
                        "Kein Terminal gefunden. Starte im aktuellen Prozess.",
                        "BACKEND",
                        "FLASK",
                        "⚠️",
                        "warning"
                    )
                    subprocess.Popen(command)
            else:
                self.logger.log(
                    f"Unbekanntes OS: {os_name}. Starte im aktuellen Prozess.",
                    "BACKEND",
                    "FLASK",
                    "⚙️",
                    "warning"
                )
                subprocess.Popen(command)

            self.logger.log(
                f"Flask-App extern gestartet ({os_name}, wait={wait})",
                "BACKEND",
                "FLASK",
                "🪟",
                "success"
            )

            if wait:
                Console.print("Warte bis externes Terminal geschlossen wird...", "BACKEND", "FLASK", "⏳", "info")
                subprocess.call(command)

        except Exception as e:
            self.logger.log(
                f"Fehler beim Starten im externen Terminal: {e}",
                "BACKEND",
                "FLASK",
                "💥",
                "error"
            )

    def stop(self):
        if self._thread and self._thread.is_alive():
            self._stop_event.set()
            self.logger.log(
                "Stop-Event gesetzt. Flask muss ggf. manuell beendet werden (CTRL+C).",
                "BACKEND",
                "FLASK",
                "🛑",
                "info"
            )
            try:
                self._thread.join(timeout=2.0)
            except Exception:
                pass
        else:
            self.logger.log(
                "Kein aktiver Flask-Prozess gefunden.",
                "BACKEND",
                "FLASK",
                "⚙️",
                "warning"
            )

    def restart(self, wait: bool = False, external: bool = False):
        self.logger.log(
            "Backend wird neu gestartet...",
            "BACKEND",
            "SYSTEM",
            "🔄",
            "info"
        )
        self.stop()
        time.sleep(0.6)
        self.start(wait=wait, external=external)

    # -----------------------------------------------------------
    # 🏗️ BUILD SYSTEM
    # -----------------------------------------------------------
    def build(self, config_path: Optional[str] = None, log: Optional[callable] = None) -> int:
        """
        Ruft cli.build.build_project auf.
        Nutzt automatisch das aktuelle Verzeichnis + '/core' als Ziel.
        Gibt die Anzahl initialisierter Module zurück.
        """
        with self._build_lock:
            base_path = Path.cwd()
            core_path = base_path / "core"

            if not core_path.exists():
                self.logger.log(
                    f"Core-Verzeichnis nicht gefunden: {core_path}",
                    "BACKEND",
                    "BUILD",
                    "❌️",
                    "error"
                )
                return 0

            try:
                build_mod = importlib.import_module("cli.build")
            except Exception as e:
                self.logger.log(
                    f"Konnte Build-Modul nicht importieren: {e}",
                    "BACKEND",
                    "BUILD",
                    "🚫",
                    "error"
                )
                return 0

            try:
                modules_count = build_mod.build_project(
                    config_path=config_path or "build.json",
                    log=log or (lambda m: self.logger.log(m, "BACKEND", "BUILD", "📦", "info"))
                )
                self.logger.log(
                    f"Build erfolgreich abgeschlossen — {modules_count} Module initialisiert.",
                    "BACKEND",
                    "BUILD",
                    "✅",
                    "success"
                )
                return modules_count

            except Exception as e:
                self.logger.log(
                    f"Build-Fehler: {e}",
                    "BACKEND",
                    "BUILD",
                    "💥",
                    "error"
                )
                return 0
