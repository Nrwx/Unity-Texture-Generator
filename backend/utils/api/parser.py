import json

def convert_value(value, expected_type):
    # Wenn value der String "null" ist, zu None mappen
    if isinstance(value, str) and value.lower() == "null":
        return None

    if expected_type == bool:
        return str(value).lower() == 'true'

    return expected_type(value)

def try_parse_json(value):
    if isinstance(value, str) and value.strip().startswith(('{', '[')):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            pass
    # Auch bei "null" als String in JSON-Formaten wird json.loads schon None zurückgeben,
    # aber falls raw_value = "null" als String kommt, hier abfangen:
    if isinstance(value, str) and value.lower() == "null":
        return None
    return value

def parse_parameters(params_section: dict, form_data: dict) -> dict:
    parsed_params = {}

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

        value = try_parse_json(raw_value)

        if expected_type in [int, float, str, bool]:
            try:
                value = convert_value(value, expected_type)
            except Exception:
                raise ValueError(f"Parameter '{key}' must be of type {expected_type.__name__}")

        if not isinstance(value, expected_type) and value is not None:
            raise ValueError(f"Parameter '{key}' must be of type {expected_type.__name__}")

        parsed_params[key] = value

    return parsed_params

def parse_response(result, default_status=200):
    if isinstance(result, tuple) and len(result) == 2:
        return result
    return result, default_status
