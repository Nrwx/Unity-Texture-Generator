import platform
import subprocess
import threading
import time
from pathlib import Path
from typing import Optional

from .console import Console
from .flask_config import FlaskConfig
from .logger import Logger


class BackendApp:
    def __init__(self, flask_config: FlaskConfig, logger: Logger):
        self.flask_config = flask_config
        self.logger = logger
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def _run_flask(self):
        self.logger.log(
            f"Flask app starting in '{self.flask_config.mode}' mode.",
            "BACKEND",
            "FLASK",
            None,
            "success"
        )
        try:
            from app import APP, main  # noqa: E402

            self.flask_config.apply(APP)
            main(development=self.flask_config.mode != "production", log_level=3)
        except Exception as exc:
            self.logger.log(
                f"Failed to start Flask app: {exc}",
                "BACKEND",
                "FLASK",
                None,
                "error"
            )

    def start(self, wait: bool = False, external: bool = False):
        if external:
            self._start_external(wait=wait)
            return

        if self._thread and self._thread.is_alive():
            self.logger.log("Flask app is already running.", "BACKEND", "FLASK", None, "warning")
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_flask, daemon=True)
        self._thread.start()
        self.logger.log("Flask app started in the background.", "BACKEND", "FLASK", None, "success")

        if wait:
            self.logger.log("Waiting for Flask thread. Press Ctrl+C to stop.", "BACKEND", "FLASK", None, "info")
            self._thread.join()

    def _start_external(self, wait: bool = False):
        os_name = platform.system().lower()
        command = ["python", "app.py"]

        try:
            if "windows" in os_name:
                if wait:
                    subprocess.call(["cmd", "/k", "python", "app.py"])
                else:
                    subprocess.Popen(["cmd", "/c", "start", "python", "app.py"], shell=True)
            elif "linux" in os_name or "darwin" in os_name:
                for term in ("x-terminal-emulator", "gnome-terminal", "konsole", "xterm"):
                    if Path(f"/usr/bin/{term}").exists():
                        subprocess.Popen([term, "-e", "python3 app.py"])
                        break
                else:
                    subprocess.Popen(command)
            else:
                subprocess.Popen(command)

            self.logger.log(f"Flask app started externally ({os_name}, wait={wait}).", "BACKEND", "FLASK", None, "success")
            if wait and "windows" not in os_name:
                Console.print("Waiting for external terminal to close.", "BACKEND", "FLASK", None, "info")
                subprocess.call(command)
        except Exception as exc:
            self.logger.log(f"Failed to start external terminal: {exc}", "BACKEND", "FLASK", None, "error")

    def stop(self):
        if self._thread and self._thread.is_alive():
            self._stop_event.set()
            self.logger.log("Stop event set. Flask may still need Ctrl+C.", "BACKEND", "FLASK", None, "info")
            try:
                self._thread.join(timeout=2.0)
            except Exception:
                pass
        else:
            self.logger.log("No active Flask process found.", "BACKEND", "FLASK", None, "warning")

    def restart(self, wait: bool = False, external: bool = False):
        self.logger.log("Restarting backend.", "BACKEND", "SYSTEM", None, "info")
        self.stop()
        time.sleep(0.6)
        self.start(wait=wait, external=external)
