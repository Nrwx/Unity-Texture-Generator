def convert_value(value, expected_type):
    if expected_type == list:
        return value.split(',')
    if expected_type == bool:
        return str(value).lower() == 'true'
    return expected_type(value)

def parse_parameters(params_section: dict, form_data: dict) -> dict:
    """
    Parsed Formulardaten anhand einer Parametertabelle mit Typen, Required-Flags und Defaults.

    :param params_section: Dict mit Parameternamen und Typ-Konfiguration
    :param form_data: Eingehende Form-Daten (z.B. request.form)
    :return: Dict mit getypten Parametern
    :raises ValueError: Wenn ein erforderlicher Parameter fehlt oder Typumwandlung fehlschlägt
    """
    parsed_params = {}

    for key, config in params_section.items():
        raw_value = form_data.get(key)

        if raw_value is None:
            if config.get("required", False):
                raise ValueError(f"Parameter '{key}' is required")
            parsed_params[key] = config.get("default")
        else:
            try:
                parsed_params[key] = convert_value(raw_value, config["type"])
            except Exception:
                raise ValueError(f"Parameter '{key}' must be of type {config['type'].__name__}")

    return parsed_params
