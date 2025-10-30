import threading
import json
import traceback
from datetime import datetime
from typing import Any, Optional

class Logger:
    """Thread-sicherer Logger, der alles genau so protokolliert, wie Child-Funktionen es liefern."""
    def __init__(self, export_path: str = "debug_log.txt", file_format: str = "txt", log_level: str = "INFO"):
        self.export_path = export_path
        self.file_format = file_format.lower()
        self.log_level = log_level.upper()
        self._lock = threading.RLock()
        self._buffer = []

    def log(self, function_name: str, params: Any = None, return_value: Any = None, exception: Optional[Exception] = None):
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "function": function_name,
            "thread": threading.current_thread().name,
            "params": params,
            "return": return_value,
            "exception": repr(exception) if exception else None,
            "stack_trace": "".join(traceback.format_stack())
        }
        with self._lock:
            self._buffer.append(entry)
            # Sofort printen
            print(f"[{entry['timestamp']}] [{entry['thread']}] {function_name} | params={params} return={return_value} exception={exception}")
            print(entry["stack_trace"])

    def export(self, path: Optional[str] = None, file_format: Optional[str] = None):
        path = path or self.export_path
        fmt = (file_format or self.file_format).lower()
        with self._lock:
            if fmt == "txt":
                with open(path, "w", encoding="utf-8") as f:
                    for e in self._buffer:
                        f.write(f"[{e['timestamp']}] [{e['thread']}] {e['function']} | params={e['params']} return={e['return']} exception={e['exception']}\n")
                        f.write(e['stack_trace'] + "\n\n")
            elif fmt == "json":
                with open(path, "w", encoding="utf-8") as f:
                    for e in self._buffer:
                        f.write(json.dumps(e, default=str) + "\n")
