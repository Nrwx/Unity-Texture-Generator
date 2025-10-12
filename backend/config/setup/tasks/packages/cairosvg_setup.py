import os

def check_cairosvg():
    """Prüft, ob CairoSVG korrekt funktioniert."""
    try:
        import cairosvg
        import os

        test_svg = b"""
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
            <rect width="100" height="100" fill="red"/>
        </svg>
        """
        output_file = "test_cairo.png"
        cairosvg.svg2png(bytestring=test_svg, write_to=output_file)
        if os.path.exists(output_file):
            os.remove(output_file)
        return True
    except Exception:
        return False


def plan_cairosvg():
    return {
        "id": "CAIROSVG",
        "installer_name": "cairosvg",
        "action": "install",
        "check": check_cairosvg,
        "installers": {
            "windows": ["gtk3-runtime-3.24.31-2022-01-04-ts-win64.zip"],
            "linux": [],
            "arch": []
        },
        "env_vars": {
            "windows": {
                "PATH": [
                    r"C:\Program Files\GTK3-Runtime Win64\bin",
                    r"C:\Program Files\GTK3-Runtime Win64\lib"
                ]
            },
            "linux": {},
            "arch": {}
        }
    }
