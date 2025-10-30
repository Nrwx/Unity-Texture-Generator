def check_cairosvg(log):
    """Prüft, ob CairoSVG korrekt funktioniert und SVG in PNG konvertieren kann."""
    try:
        log("Software lokalisierung eingeleitet...", "DRIVER", "cairosvg", "🔍")
        import cairosvg
        import os

        log("CairoSVG erfolgreich erkannt!", "DRIVER", "INFO", "🔔")

        test_svg = b"""
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
            <rect width="100" height="100" fill="red"/>
        </svg>
        """

        output_file = "test_cairo.png"
        log("Starte SVG Testkonvertierung...", "DRIVER", "INFO", "🔔")

        cairosvg.svg2png(bytestring=test_svg, write_to=output_file)

        if os.path.exists(output_file):
            os.remove(output_file)
            log("CairoSVG-Test erfolgreich!", "DRIVER", "INFO", "🔔")
            return True
        else:
            log("CairoSVG-Test fehlgeschlagen!", "DRIVER", "ERROR", "📛")
            return False

    except ModuleNotFoundError:
        log("CairoSVG-Modul nicht installiert!", "DRIVER", "ERROR", "📛")
        return False
    except OSError as e:
        log(f"CairoSVG konnte nicht ausgeführt werden: {e}", "DRIVER", "ERROR", "⚠️")
        return False
    except Exception as e:
        log(f"Unerwarteter Fehler bei CairoSVG-Test: {e}", "DRIVER", "ERROR", "📛")
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
