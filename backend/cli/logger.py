import threading
from datetime import datetime

from .console import Console


class Logger:
    def __init__(self, log_file: str = "cli.log"):
        self.log_file = log_file
        self._lock = threading.RLock()

    def log(self, msg: str, instance: str, level: str, icon: str = None, style: str = None):
        with self._lock:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            line = f"[{timestamp}]-{icon} -[{instance}]-[{level}] {msg}"
            Console.print(msg, instance, level, icon, style)
            try:
                with open(self.log_file, "a", encoding="utf-8") as f:
                    f.write(line + "\n")
            except Exception:
                Console.print(f"Failed to write log file: {self.log_file}", "LOGGER", "WARNING", None, "warning")
