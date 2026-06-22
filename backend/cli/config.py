from typing import Any, Dict

from .console import Console


def register_config(manager, backend, config_loader, logger):
    def config_command(*args):
        cfg: Dict[str, Any] = dict(config_loader.data) if config_loader and config_loader.data else {}
        cfg.setdefault("auto_sequence", list(manager.auto_sequence))
        cfg.setdefault("flask_mode", "development")
        cfg.setdefault("log_file", logger.log_file or "cli.log")

        Console.print("Interactive config editor started.", "CONFIG", "EDITOR", None, "success")

        while True:
            Console.print("Available options:", "CONFIG", "MENU", None, "info")
            Console.print("1 - Edit auto_sequence", "CONFIG", "MENU", None, "info")
            Console.print("2 - Change Flask mode", "CONFIG", "MENU", None, "info")
            Console.print("3 - Change log file", "CONFIG", "MENU", None, "info")
            Console.print("4 - Save and apply", "CONFIG", "MENU", None, "info")
            Console.print("5 - Reset runtime defaults", "CONFIG", "MENU", None, "info")
            Console.print("6 - Cancel", "CONFIG", "MENU", None, "info")

            choice = input("config> ").strip()

            if choice == "1":
                edit_auto_sequence_interactive(cfg, manager)
            elif choice == "2":
                edit_flask_mode_interactive(cfg, backend)
            elif choice == "3":
                Console.print(f"Current log file: {logger.log_file}", "CONFIG", "LOGGER", None, "info")
                new_log = input("New log file: ").strip()
                if new_log:
                    cfg["log_file"] = new_log
                    logger.log_file = new_log
                    Console.print(f"Log file changed: {new_log}", "CONFIG", "LOGGER", None, "success")
            elif choice == "4":
                manager.auto_sequence = cfg.get("auto_sequence", manager.auto_sequence)
                if backend:
                    backend.flask_config.set_mode(cfg.get("mode", cfg.get("flask_mode", "development")))
                if "log_file" in cfg:
                    logger.log_file = cfg["log_file"]
                if config_loader:
                    config_loader.save(cfg)
                Console.print("Config saved and applied.", "CONFIG", "SAVE", None, "success")
            elif choice == "5":
                cfg["auto_sequence"] = []
                cfg["flask_mode"] = "development"
                cfg.pop("mode", None)
                cfg["log_file"] = "cli.log"
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


def edit_flask_mode_interactive(cfg: dict, backend):
    current = cfg.get("mode", cfg.get("flask_mode", "development"))
    Console.print(f"Current Flask mode: {current}", "CONFIG", "FLASK", None, "info")
    Console.print("Allowed values: development, production", "CONFIG", "FLASK", None, "info")
    mode = input("flask_mode> ").strip().lower()

    if mode not in ("development", "production"):
        Console.print("Invalid mode. Keeping current value.", "CONFIG", "FLASK", None, "warning")
        return

    cfg["flask_mode"] = mode
    cfg.pop("mode", None)
    if backend:
        backend.flask_config.set_mode(mode)
        Console.print("Flask mode applied for this session.", "CONFIG", "FLASK", None, "info")
