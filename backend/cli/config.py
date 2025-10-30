import os
from typing import Dict, Any
from .console import Console


def register_config(manager, backend, config_loader, logger):
    """
    Fügt dem Manager den Befehl 'config' hinzu.
    Ermöglicht interaktives Bearbeiten von:
      - auto_sequence
      - flask_config keys
      - log_file
    mit Speichern, Reset oder Abbrechen.
    """

    def config_command():
        Console.print("Interaktiver Konfigurationseditor gestartet...", "CONFIG", "EDITOR", "🚀", "success")

        # Arbeitskopie der aktuellen Konfiguration
        cfg: Dict[str, Any] = config_loader.data.copy() if config_loader and config_loader.data else {}
        if "flask_config" not in cfg:
            cfg["flask_config"] = {}
        if "auto_sequence" not in cfg:
            cfg["auto_sequence"] = manager.auto_sequence.copy()

        while True:
            Console.print(" Verfügbare Optionen:", "CONFIG", "MENU", "📜", "info")
            Console.print("'1' → Boot-Reihenfolge (auto_sequence) bearbeiten", "CONFIG", "MENU", "⚙️", "info")
            Console.print("'2' → Flask-Konfiguration bearbeiten", "CONFIG", "MENU", "🔥", "info")
            Console.print("'3' → Logger-Datei ändern", "CONFIG", "MENU", "🧾", "info")
            Console.print("'4' → Speichern und Anwenden", "CONFIG", "MENU", "💾", "info")
            Console.print("'5' → Reset auf Defaults", "CONFIG", "MENU", "♻️", "info")
            Console.print("'6' → Abbrechen", "CONFIG", "MENU", "❌️", "error")

            Console.print(" Adminstrative Einstellungen sollten immer von einem Experten gewartet werden", "CONFIG", "MENU", "🔓", "info")
            choice = input("▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█  Eingabe: ").strip()

            if choice == "1":
                edit_auto_sequence_interactive(cfg, manager)

            elif choice == "2":
                edit_flask_config_interactive(cfg, backend)

            elif choice == "3":

                Console.print(f" Aktueller Log-File ({logger.log_file})", "CONFIG", "LOGGER", "🧾", "info")
                Console.print(" Neuen Pfad eingeben, mit (Enter) bestätigen...", "CONFIG", "LOGGER", "📂", "info")
                new_log = input(f"▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█  Eingabe: ").strip()
                if new_log:
                    cfg["log_file"] = new_log
                    logger.log_file = new_log
                    Console.print(f" Logger-Datei geändert: {new_log}", "CONFIG", "LOGGER", "🧾", "success")

            elif choice == "4":
                # Anwenden und speichern
                manager.auto_sequence = cfg.get("auto_sequence", manager.auto_sequence)
                if backend and "flask_config" in cfg:
                    backend.flask_config.config.update(cfg["flask_config"])
                if "log_file" in cfg:
                    logger.log_file = cfg["log_file"]
                if config_loader:
                    config_loader.save(cfg)
                Console.print(" Konfiguration angewendet und gespeichert.", "CONFIG", "SAVE", "🔔️", "success")

            elif choice == "5":
                # Reset
                cfg = {
                    "auto_sequence": ["setup", "start-backend"],
                    "flask_config": {},
                    "log_file": "cli.log"
                }
                manager.auto_sequence = cfg["auto_sequence"]
                if backend:
                    backend.flask_config.set_mode("development")
                logger.log_file = cfg["log_file"]
                if config_loader:
                    config_loader.save(cfg)
                Console.print(" Konfiguration auf Defaults zurückgesetzt.", "CONFIG", "RESET", "♻️", "success")

            elif choice == "6":
                Console.print(" Abbruch – keine Änderungen gespeichert.", "CONFIG", "ABORT", "🚫", "warning")
                break

            else:
                Console.print("Ungültige Auswahl – bitte erneut versuchen.", "CONFIG", "INPUT", "⚠️", "warning")

    manager.register_command("config", config_command, "Interaktiven Konfigurationseditor starten")

def edit_auto_sequence_interactive(cfg: dict, manager):
    # Stelle sicher, dass cfg["auto_sequence"] existiert
    if "auto_sequence" not in cfg:
        cfg["auto_sequence"] = manager.auto_sequence.copy()

    seq = cfg["auto_sequence"]  # <- direkte Referenz, keine Kopie!

    while True:
        Console.print(" Aktuelle Auto-Setup Reihenfolge:", "CONFIG", "AUTOSEQ", "🔔️", "success")
        for i, v in enumerate(seq, 1):
            Console.print(f" {i}. {v}", "CONFIG", "AUTOSEQ", "🧩", "info")

        Console.print(" Befehle: add <name>, remove <nr>, move <from> <to>, done", "CONFIG", "AUTOSEQ", "⚙️", "info")
        inp = input("▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊  Eingabe: ").strip()

        if inp.lower() == "done":
            break

        parts = inp.split()
        if not parts:
            continue

        cmd = parts[0].lower()

        if cmd == "add":
            if len(parts) < 2:
                Console.print(" Bitte gib einen Befehl an, z. B.: add install_driver", "CONFIG", "AUTOSEQ", "⚠️", "warning")
                continue

            command = parts[1].lower()
            if hasattr(manager, "commands") and command in manager.commands:
                seq.append(command)
                Console.print(f" Hinzugefügt: {command}", "CONFIG", "AUTOSEQ", "➕", "success")
            else:
                Console.print(f" Unbekannter Befehl: {command}", "CONFIG", "AUTOSEQ", "⚠️", "warning")

        elif cmd == "remove" and len(parts) == 2:
            try:
                removed = seq.pop(int(parts[1]) - 1)
                Console.print(f" Entfernt: {removed}", "CONFIG", "AUTOSEQ", "➖", "success")
            except Exception:
                Console.print(" Ungültiger Index!", "CONFIG", "AUTOSEQ", "⚠️", "warning")

        elif cmd == "move" and len(parts) == 3:
            try:
                i1 = int(parts[1]) - 1
                i2 = int(parts[2]) - 1
                seq.insert(i2, seq.pop(i1))
                Console.print(f" Verschoben {parts[1]} → {parts[2]}", "CONFIG", "AUTOSEQ", "🔀", "success")
            except Exception:
                Console.print(" Move fehlgeschlagen!", "CONFIG", "AUTOSEQ", "⚠️", "warning")

    # Änderungen bleiben in cfg erhalten, da seq eine Referenz ist
    cfg["auto_sequence"] = seq
    Console.print(f" Neue Reihenfolge gespeichert: {cfg['auto_sequence']}", "CONFIG", "AUTOSEQ", "🔔", "success")

def edit_flask_config_interactive(cfg: dict, backend):
    fc = cfg.get("flask_config", {})

    while True:
        Console.print(" Aktuelle Flask-Konfiguration:", "CONFIG", "FLASK", "🔔️", "success")
        for k, v in fc.items():
            Console.print(f" {k}: {v}", "CONFIG", "FLASK", "🧩", "info")

        Console.print(" Optionen: set <key> <value>, remove <key>, done", "CONFIG", "FLASK", "⚙️", "info")
        inp = input("▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊  Eingabe: ").strip()

        if inp.lower() == "done":
            break

        parts = inp.split(maxsplit=2)
        if not parts:
            continue

        cmd = parts[0].lower()

        if cmd == "set" and len(parts) == 3:
            key, val = parts[1], parts[2]
            # automatische Typkonvertierung
            try:
                if val.isdigit():
                    val = int(val)
                else:
                    val = float(val)
            except Exception:
                l = val.lower()
                if l in ("true", "false"):
                    val = l == "true"
            fc[key] = val
            Console.print(f" Datensatz aktualisiert: {key} = {val}", "CONFIG", "FLASK", "🧩", "success")

        elif cmd == "remove" and len(parts) == 2:
            key = parts[1]
            fc.pop(key, None)
            Console.print(f" Datensatz entfernt: {key}", "CONFIG", "FLASK", "🗑️", "success")

        else:
            Console.print(" Ungültige Eingabe", "CONFIG", "FLASK", "⚠️", "warning")

    cfg["flask_config"] = fc
    if backend:
        backend.flask_config.config.update(fc)
        Console.print(" Flask-Konfiguration temporär angewendet.", "CONFIG", "FLASK", "🔔️", "info")
