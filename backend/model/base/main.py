# core/base/model.py
import logging
from typing import Any, Callable, Dict, Iterable, Optional


class BaseModel:
    """
    Basisklasse fuer Models.
      - `logic`: Klasse/Modul/Instanz mit Hilfsmethoden
      - `_parser`: optional: parser.parse_parameters(files, form)
      - `_log`: optional logger
    Ziel: Modelle geben die tatsaechlichen payload/daten zurueck,
          oder (payload, status) wenn sie Status-Codes wuenschen.
    """

    _parser: Optional[Any] = None
    _log: Optional[Callable[..., Any]] = None

    @classmethod
    def handle_error(cls, exc: Exception):
        try:
            if cls._log:
                cls._log(str(exc), "MODEL", "ERROR", "!")
            else:
                logging.getLogger(__name__).exception("Unhandled model error")
        except Exception:
            pass
        return {"error": "Internal server error"}, 500
