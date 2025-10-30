from flask import Flask
from pathlib import Path
from typing import Dict, Any
from core.config.main import Config
from core.boot.main import Boot
from core.registry.main import Registry
from core.task.main import TaskManager
from core.syslink.main import SystemLink
from core.router.main import Router
from core.parser.main import Parser
from core.api.main import Api
from core.key.main import Key
from core.treasure.main import Treasure
from core.generate.main import Generate

class Core:
    """
    Zentraler Container für das gesamte Backend-Subsystem.
    """
    def __init__(self, base_dir: Path, log, development: bool, log_level: int, app: Flask, config: Dict[str, Any]):
        self.base_dir = base_dir
        self.log = log
        self.development = development
        self.log_level = log_level
        self.app = app
        self.config = config

        # Secure Settings aus Config
        secure = Config(log=self.log, config_dict=self.config, base_dir=base_dir)
        secure_cfg = secure.get_secure_settings()

        # Treasure initialisieren mit Key-Pfaden und Keyring-Option
        self.treasure = Treasure(
           key=Key,
           log=log,
           project_name=secure_cfg["project_name"],
           service_name=secure_cfg["service_name"],
           account_name=secure_cfg["account_name"],
           storage_path=secure_cfg["storage_path"],
           key_path=secure_cfg["key_path"],
           use_keyring=secure_cfg["use_keyring"]
        )

        # Grundkomponenten
        self.registry = Registry(treasure=self.treasure)
        self.syslink = SystemLink(log=self.log)

        # Link Core-Objekte in syslink
        self.syslink.link("registry", self.registry, object)
        self.syslink.link("create_registry", Registry, expected_type=type)

        cfg = Config(registry=self.registry, syslink=self.syslink)
        boot_cfg = cfg.create_boot_config()

        # Task Manager
        self.task_manager = TaskManager(
            registry=self.registry,
            log=self.log,
            development=self.development,
            log_level=self.log_level,
            tasks_dir=self.base_dir / "core" / "boot" / "tasks",
            actions=boot_cfg["boot_actions"],
            params=boot_cfg["boot_params"],
            threads=boot_cfg["boot_threads"]
        )

        self.syslink.link("task_manager", self.task_manager, object)

        # Bootloader
        self.boot = Boot(
            registry=self.registry,
            task_manager=self.task_manager,
            log=self.log,
            development=self.development,
            log_level=self.log_level,
            base_dir=self.base_dir,
            sequence=boot_cfg["boot_sequence"],
            actions=boot_cfg["boot_actions"],
            params=boot_cfg["boot_params"],
            threads=boot_cfg["boot_threads"]
        )

        self.parser = Parser(log=log)

        self.api = Api(
            resource_map={
                "syslink": self.syslink,
                "log": self.log
            },
            log=self.log
        )

        self.generate = Generate(
            config=self.config,
            base_dir=self.base_dir
        )


        self.router = Router(
            app=self.app,
            parser=self.parser,
            config=self.config,
            api=self.api
        )

    def start(self):
        self.log("Starte Core-Initialisierung...", "CORE", "INFO", "🚀")
        self.boot.init_setup()
        self.generate.init_setup(overwrite=True)
        self.router.init_setup()
        self.log("Core erfolgreich gestartet.", "CORE", "INFO", "✅")
