#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Backend terminal entrypoint.

Run:
  python cli.py
  python cli.py doctor
  python cli.py echo hello
"""

import sys
from pathlib import Path

from dotenv import load_dotenv
from cli.backend import register_backend_commands
from cli.backend_app import BackendApp
from cli.cli_manager import CLIManager
from cli.config import register_config
from cli.config_loader import ConfigLoader
from cli.console import Console
from cli.doctor import register_doctor
from cli.flask_config import FlaskConfig
from cli.logger import Logger
from cli.version import print_version_info


BASE_DIR = Path(__file__).resolve().parent


def main():
    interactive = len(sys.argv) == 1
    load_dotenv(dotenv_path=BASE_DIR / ".env")

    config_loader = ConfigLoader(str(BASE_DIR / "build.json"))
    logger = Logger(config_loader.get("log_file", "cli.log"))

    flask_config = FlaskConfig()
    flask_config.set_mode(config_loader.get("mode", config_loader.get("flask_mode", "development")))

    backend = BackendApp(flask_config, logger)
    manager = CLIManager(logger=logger, backend=backend, config_loader=config_loader)

    register_backend_commands(manager, backend)
    register_config(manager, backend, config_loader, logger)
    register_doctor(manager)
    manager.register_command("version", lambda *args: print_version_info() or 0, "Show backend version and patch notes")

    if not interactive:
        raise SystemExit(manager.run_command(" ".join(sys.argv[1:])))

    Console.print("Unity Texture Generator backend terminal started.", "BACKEND-CLI", "READY", None, "success")
    manager.start_cli()


if __name__ == "__main__":
    main()
