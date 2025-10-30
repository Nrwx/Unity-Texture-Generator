# core/base/model.py
from typing import Dict, Any, Optional, Iterable, Callable

class BaseModel:
    """
    Basisklasse für Models.
      - `logic`: Klasse/Modul/Instanz mit Hilfsmethoden
      - `_parser`: optional: parser.parse_parameters(files, form)
      - `_log`: optional logger
    Ziel: Modelle geben die tatsächlichen payload/daten zurück (nicht nur 'status'),
          oder (payload, status) wenn sie Status-Codes wünschen.
    """
    _parser: Optional[Any] = None
    _log: Optional[Callable[..., Any]] = None

    @classmethod
    def handle_error(cls, exc: Exception):
        msg = str(exc)
        try:
            if cls._log:
                cls._log(msg, "MODEL", "ERROR", "⚠️")
        except Exception:
            pass
        return {"error": msg}, 500