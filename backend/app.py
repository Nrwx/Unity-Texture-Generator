from flask import Flask, request
from pathlib import Path
from datetime import datetime
import os
# --------------------------------- #
# START Initialising - DONT CHANGE  #
# --------------------------------- #
from core.main import Core
from core.config.main import Config
from core.library.main import LibraryManager

APP = None
BASE_DIR = None
CONFIG_PATH = None
CONFIG = None

def _bootstrap():
    global APP
    global BASE_DIR
    global CONFIG_PATH
    global CONFIG

    BASE_DIR = Path(__file__).parent
    CONFIG_PATH = os.path.join(BASE_DIR, "build.json")
    CONFIG = _load_config(CONFIG_PATH)

    _integrity_check()

    APP = _create_app()

def _now_iso():
    return datetime.now().isoformat(sep=" ", timespec="seconds")

def _log(msg: str, instance:str, level:str, icon:str=None):
    instance = instance.upper()
    if icon != None:
        print(f"[{_now_iso()}]-{icon} -[{instance}]-[{level}] {msg}")
    else:
        print(f"[{_now_iso()}]-[{instance}]-[{level}] {msg}")

def _load_config(config=None):
    import json
    with open(config, "r") as f:
        cfg = json.load(f)
        return cfg

def _create_core(development, log_level, base_dir=None, app=None, config=None) -> Core:
    if not base_dir:
        print("FATAL ERROR, PFAD MUSS INITIALISIERT WERDEN")
    return Core(base_dir=base_dir, log=_log, development=development, log_level=log_level, app=app, config=config)

def _integrity_check():
        # Config Klasse
        cfg = Config(log=_log, config_dict=CONFIG, base_dir=BASE_DIR)
        # Library Control (im Core.__init__)
        library = LibraryManager(log=_log, config=cfg, base_path=BASE_DIR)
        report = library.init_and_sync()
        if report:
            _log(f"Library build sync completed → {report['status']}", "CORE", "INFO", "📦")

def _create_app():
    from dotenv import load_dotenv
    load_dotenv()

    app = Flask(__name__)
    return app

def _is_development_mode(config=None):
    cfg = config or CONFIG or {}
    mode = str(cfg.get("mode") or cfg.get("flask_mode") or "development").lower()
    return mode != "production"

_bootstrap()

def main(development, log_level):
    # Initialising
    core = _create_core(development, log_level, BASE_DIR, APP, CONFIG)
    core.start()

    if core.development:
        APP.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
    else:
        _log("Flask-Server läuft extern (Production).", "APP", "INFO", "🛰️")

# --------------------------------- #
#  END Initialising - DONT CHANGE   #
# --------------------------------- #

# --------------------------------- #
#  Request-Rewrite - DONT CHANGE    #
# --------------------------------- #
@APP.before_request
def queue_all_requests():
    from generated.controller.queue_controller import QueueController
    if request.method not in ["POST", "GET", "PUT", "DELETE"]:
        return None

    if request.path in ["/queue"]:
        return None

    try:
        adapter = APP.url_map.bind_to_environ(request.environ)
        endpoint, values = adapter.match()
        view_func = APP.view_functions.get(endpoint)
        if not view_func:
            return None

        kwargs = {}

        # JSON-Daten übernehmen
        json_data = request.get_json(silent=True)
        if isinstance(json_data, dict):
            kwargs.update(json_data)

        # Formulardaten
        kwargs.update(request.form.to_dict())

        # Query-Parameter
        kwargs.update(request.args.to_dict())

        # Dateien
        for file_key in request.files:
            kwargs[file_key] = request.files[file_key]

        # Queue-Aufruf mit Blockierung auf Ergebnis
        return QueueController.enqueue_request(
            func=view_func,
            args=(),
            kwargs=kwargs,
            info={
                "endpoint": endpoint,
                "path": request.path,
                "method": request.method,
                "content_type": request.content_type or "",
                "has_files": bool(request.files),
            }
        )

    except Exception as e:
        print(f"[Queue Intercept Error] {e}")
        return None


if __name__ == "__main__":
    development = _is_development_mode(CONFIG)
    log_level = 3
    main(development, log_level)
