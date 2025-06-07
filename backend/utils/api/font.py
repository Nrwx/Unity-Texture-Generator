import re

def get_font_family(raw_font_family: str) -> str:
    """
    Extrahiert den tatsächlichen Fontnamen aus CSS-ähnlichem String.
    Beispiele:
        "'Roboto', sans-serif"       -> Roboto
        "\"Open Sans\", Arial"       -> Open Sans
        "Arial, sans-serif"          -> Arial
    """
    if not raw_font_family:
        return ""

    match = re.search(r"[\"']([^\"']+)[\"']", raw_font_family)
    if match:
        return match.group(1)
    return raw_font_family.split(",")[0].strip()
