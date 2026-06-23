# core/base/controller.py
import inspect
import json
from typing import Any, Dict, Optional, Tuple, Callable
from config.api.parameter import PARAMETERS

class BaseController:
    _model: Any = None
    _parser: Any = None
    _log: Optional[Callable[..., Any]] = None
    _method_map: Dict[str, Dict[str, Any]] = {}

    def handle(self, route, form, files=None):
        params = self._parser.parse_parameters(PARAMETERS.get(route), form)

        # Korrektur:
        method_map = getattr(self, "_method_map", {}) or {}
        print(method_map)

        method = params.get("method")

        if method not in method_map:
            return {"error": f"Unbekannte Methode '{method}'"}, 400

        method_info = method_map[method]
        keys = method_info.get("keys", [])
        func_name = method_info.get("function")

        model_class = getattr(self, "_model", None)
        if not model_class:
            return {"error": "Kein Model zugewiesen"}, 500

        func = getattr(model_class, func_name, None)
        if not callable(func):
            return {"error": f"Model-Funktion '{func_name}' nicht gefunden"}, 500

        # 🔹 wie früher: nur die erlaubten Parameter weitergeben
        call_params = {k: params[k] for k in keys if k in params}

        try:
            # Dateien optional mitgeben
            if files:
                return func(files=files, **call_params)
            return func(**call_params)
        except Exception as e:
            try:
                if self._log:
                    self._log(str(e), "CONTROLLER", "ERROR", "!")
            except Exception:
                pass
            return {"error": "Internal server error"}, 500

    def fetch(self):
        try:
            if not hasattr(self, "_model") or self._model is None:
                return {"error": "Kein Model zugewiesen"}, 500

            if hasattr(self._model, "fetch"):
                res = self._model.fetch()
                if isinstance(res, tuple) and len(res) == 2 and isinstance(res[1], int):
                    return res
                return res, 200

            return {"status": "no_fetch_method", "query": params}, 200

        except Exception as e:
            try:
                if self._log:
                    self._log(str(e), "CONTROLLER", "ERROR", "!")
            except Exception:
                pass
            return {"error": "Internal server error"}, 500

        return result, default_status
