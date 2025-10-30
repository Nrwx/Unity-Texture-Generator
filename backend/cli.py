#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""cli.py - Modular CLI manager (loads cli package)
Run: python cli.py
"""

import os
from pathlib import Path

# CLI package imports (utilities and modules live in cli/)
from cli.console import Console
from cli.logger import Logger
from cli.flask_config import FlaskConfig
from cli.backend_app import BackendApp
from cli.config_loader import ConfigLoader
from cli.cli_manager import CLIManager

# CLI command modules
from cli.setup import register_setup
from cli.backend import register_backend_commands
from cli.config import register_config
from cli.version import print_version_info

BASE_DIR = Path(__file__).resolve().parent

def main():
    Console.print("erfolgreich gestartet", "BACKEND-CLI", "MANAGER", "🛡️", "success")

    # load optional config.json from project root
    config_path = BASE_DIR / "config.json"
    if config_path.exists():
        Console.print("Konfigurationsdatei entdeckt: 'config.json'", "BACKEND-CLI", "INFO", "🔔", "success")
    config_loader = ConfigLoader(str(config_path))

    # create logger (uses log_file from config if provided)
    log_file = config_loader.get("log_file", "cli.log")
    logger = Logger(log_file)

    # flask config
    flask_mode = config_loader.get("flask_mode", "development")
    flask_config_dict = config_loader.get("flask_config", {})
    flask_config = FlaskConfig()
    # apply mode then override with any dict
    flask_config.set_mode(flask_mode)
    flask_config.config.update(flask_config_dict)

    # backend app
    backend = BackendApp(flask_config, logger)

    # CLI Manager
    manager = CLIManager(logger=logger, backend=backend, config_loader=config_loader)

    # register CLI submodules (they will add commands to manager)
    register_setup(manager)
    register_backend_commands(manager, backend)
    register_config(manager, backend, config_loader, logger)

    # default auto sequence if none present
    if not manager.auto_sequence:
        manager.auto_sequence = ["build-backend", "start-backend"]

    # show version / patch
    print_version_info()

    # start interactive CLI
    manager.start_cli()


if __name__ == "__main__":
    main()
