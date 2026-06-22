from typing import Any, Dict

from .console import Console


def register_config(manager, backend, config_loader, logger):
    def config_command(*args):
        cfg: Dict[str, Any] = dict(config_loader.data) if config_loader and config_loader.data else {}
        cfg.setdefault("flask_config", {})
        cfg.setdefault("auto_sequence", list(manager.auto_sequence))

        Console.print("Interactive config editor started.", "CONFIG", "EDITOR", None, "success")

        while True:
            Console.print("Available options:", "CONFIG", "MENU", None, "info")
            Console.print("1 - Edit auto_sequence", "CONFIG", "MENU", None, "info")
            Console.print("2 - Edit Flask config", "CONFIG", "MENU", None, "info")
            Console.print("3 - Change log file", "CONFIG", "MENU", None, "info")
            Console.print("4 - Save and apply", "CONFIG", "MENU", None, "info")
            Console.print("5 - Reset to defaults", "CONFIG", "MENU", None, "info")
            Console.print("6 - Cancel", "CONFIG", "MENU", None, "info")

            choice = input("config> ").strip()

            if choice == "1":
                edit_auto_sequence_interactive(cfg, manager)
            elif choice == "2":
                edit_flask_config_interactive(cfg, backend)
            elif choice == "3":
                Console.print(f"Current log file: {logger.log_file}", "CONFIG", "LOGGER", None, "info")
                new_log = input("New log file: ").strip()
                if new_log:
                    cfg["log_file"] = new_log
                    logger.log_file = new_log
                    Console.print(f"Log file changed: {new_log}", "CONFIG", "LOGGER", None, "success")
            elif choice == "4":
                manager.auto_sequence = cfg.get("auto_sequence", manager.auto_sequence)
                if backend and "flask_config" in cfg:
                    backend.flask_config.config.update(cfg["flask_config"])
                if "log_file" in cfg:
                    logger.log_file = cfg["log_file"]
                if config_loader:
                    config_loader.save(cfg)
                Console.print("Config saved and applied.", "CONFIG", "SAVE", None, "success")
            elif choice == "5":
                cfg = {
                    "auto_sequence": [],
                    "flask_config": {},
                    "log_file": "cli.log",
                }
                manager.auto_sequence = cfg["auto_sequence"]
                if backend:
                    backend.flask_config.set_mode("development")
                logger.log_file = cfg["log_file"]
                if config_loader:
                    config_loader.save(cfg)
                Console.print("Config reset to defaults.", "CONFIG", "RESET", None, "success")
            elif choice == "6":
                Console.print("Cancelled. No changes saved.", "CONFIG", "ABORT", None, "warning")
                break
            else:
                Console.print("Invalid choice. Try again.", "CONFIG", "INPUT", None, "warning")

        return 0

    manager.register_command("config", config_command, "Open the interactive config editor")


def edit_auto_sequence_interactive(cfg: dict, manager):
    cfg.setdefault("auto_sequence", list(manager.auto_sequence))
    seq = cfg["auto_sequence"]

    while True:
        Console.print("Current auto_sequence:", "CONFIG", "AUTOSEQ", None, "info")
        for i, value in enumerate(seq, 1):
            Console.print(f"{i}. {value}", "CONFIG", "AUTOSEQ", None, "info")

        Console.print("Commands: add <name>, remove <number>, move <from> <to>, done", "CONFIG", "AUTOSEQ", None, "info")
        inp = input("auto_sequence> ").strip()

        if inp.lower() == "done":
            break

        parts = inp.split()
        if not parts:
            continue

        cmd = parts[0].lower()

        if cmd == "add":
            if len(parts) < 2:
                Console.print("Usage: add <command>", "CONFIG", "AUTOSEQ", None, "warning")
                continue
            command = parts[1].lower()
            if hasattr(manager, "commands") and command in manager.commands:
                seq.append(command)
                Console.print(f"Added: {command}", "CONFIG", "AUTOSEQ", None, "success")
            else:
                Console.print(f"Unknown command: {command}", "CONFIG", "AUTOSEQ", None, "warning")
        elif cmd == "remove" and len(parts) == 2:
            try:
                removed = seq.pop(int(parts[1]) - 1)
                Console.print(f"Removed: {removed}", "CONFIG", "AUTOSEQ", None, "success")
            except Exception:
                Console.print("Invalid index.", "CONFIG", "AUTOSEQ", None, "warning")
        elif cmd == "move" and len(parts) == 3:
            try:
                src = int(parts[1]) - 1
                dst = int(parts[2]) - 1
                seq.insert(dst, seq.pop(src))
                Console.print(f"Moved {parts[1]} to {parts[2]}", "CONFIG", "AUTOSEQ", None, "success")
            except Exception:
                Console.print("Move failed.", "CONFIG", "AUTOSEQ", None, "warning")
        else:
            Console.print("Invalid command.", "CONFIG", "AUTOSEQ", None, "warning")

    cfg["auto_sequence"] = seq
    Console.print(f"New auto_sequence: {cfg['auto_sequence']}", "CONFIG", "AUTOSEQ", None, "success")


def edit_flask_config_interactive(cfg: dict, backend):
    flask_cfg = cfg.get("flask_config", {})

    while True:
        Console.print("Current Flask config:", "CONFIG", "FLASK", None, "info")
        for key, value in flask_cfg.items():
            Console.print(f"{key}: {value}", "CONFIG", "FLASK", None, "info")

        Console.print("Commands: set <key> <value>, remove <key>, done", "CONFIG", "FLASK", None, "info")
        inp = input("flask_config> ").strip()

        if inp.lower() == "done":
            break

        parts = inp.split(maxsplit=2)
        if not parts:
            continue

        cmd = parts[0].lower()
        if cmd == "set" and len(parts) == 3:
            key, value = parts[1], _parse_value(parts[2])
            flask_cfg[key] = value
            Console.print(f"Updated: {key} = {value}", "CONFIG", "FLASK", None, "success")
        elif cmd == "remove" and len(parts) == 2:
            key = parts[1]
            flask_cfg.pop(key, None)
            Console.print(f"Removed: {key}", "CONFIG", "FLASK", None, "success")
        else:
            Console.print("Invalid command.", "CONFIG", "FLASK", None, "warning")

    cfg["flask_config"] = flask_cfg
    if backend:
        backend.flask_config.config.update(flask_cfg)
        Console.print("Flask config applied for this session.", "CONFIG", "FLASK", None, "info")


def _parse_value(value: str):
    try:
        if value.isdigit():
            return int(value)
        return float(value)
    except Exception:
        lowered = value.lower()
        if lowered in ("true", "false"):
            return lowered == "true"
        return value
