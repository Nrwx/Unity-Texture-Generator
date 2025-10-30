import json
from typing import Any, Dict, Tuple

class Parser:
    """
    Parser-Klasse, implementiert die vorhandenen Utility-Funktionen
    (convert_value, try_parse_json, parse_parameters, parse_response)

    Verhalten identisch zu deinem bisherigen Funktionssatz.
    Optional kann ein log-callable übergeben werden, das die Signatur
    log(msg, module, level, icon) hat.
    """

    def __init__(self, log=None):
        self.log = log

    def convert_value(self, value: Any, expected_type: type) -> Any:
        if isinstance(value, str) and value.lower() == "null":
            return None

        if expected_type == bool:
            return str(value).lower() == 'true'

        return expected_type(value)

    def try_parse_json(self, value: Any) -> Any:
        if isinstance(value, str) and value.strip().startswith(('{', '[')):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                pass

        if isinstance(value, str) and value.lower() == "null":
            return None
        return value

    def parse_parameters(self, params_section: Dict[str, Dict[str, Any]], form_data: Dict[str, Any]) -> Dict[str, Any]:
        parsed_params: Dict[str, Any] = {}

        for key, config in params_section.items():
            expected_type = config.get("type", str)
            required = config.get("required", False)
            default = config.get("default")

            raw_value = form_data.get(key)

            if raw_value is None:
                if required:
                    raise ValueError(f"Parameter '{key}' is required")
                parsed_params[key] = default
                continue

            value = self.try_parse_json(raw_value)

            if expected_type in [int, float, str, bool]:
                try:
                    value = self.convert_value(value, expected_type)
                except Exception:
                    raise ValueError(f"Parameter '{key}' must be of type {expected_type.__name__}")

            if not isinstance(value, expected_type) and value is not None:
                raise ValueError(f"Parameter '{key}' must be of type {expected_type.__name__}")

            parsed_params[key] = value

        if self.log:
            try:
                self.log(f"{len(parsed_params)} Parameter erfolgreich geparst", "PARSER", "INFO", "✅")
            except Exception:
                pass

        return parsed_params

    # --- GET/Fetch Parser ---
    def parse_fetch_parameters(
        self,
        param_definitions: Dict[str, Dict[str, Any]],
        query_params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Parst nur tatsächlich übergebene URL-Query-Parameter (GET-Requests).
        Beispiel: ?meta=true&id=123
        """
        parsed = {}

        if not query_params:
            if self.log:
                try:
                    self.log("Keine Fetch-Parameter übergeben", "PARSER", "INFO", "🌐")
                except Exception:
                    pass
            return parsed

        for key, raw in query_params.items():
            cfg = (param_definitions or {}).get(key, {})
            expected_type = cfg.get("type", str)
            default = cfg.get("default")

            val = self.try_parse_json(raw)
            if expected_type in [int, float, str, bool]:
                try:
                    val = self.convert_value(val, expected_type)
                except Exception:
                    raise ValueError(
                        f"Parameter '{key}' muss vom Typ {expected_type.__name__} sein"
                    )

            if val is None and default is not None:
                val = default

            parsed[key] = val

        if self.log:
            try:
                self.log(f"{len(parsed)} Fetch-Parameter geparst", "PARSER", "INFO", "🌐")
            except Exception:
                pass

        return parsed

    def parse_response(self, result: Any, default_status: int = 200) -> Tuple[Any, int]:
        if isinstance(result, tuple) and len(result) == 2:
            data, status = result
            return data, int(status)