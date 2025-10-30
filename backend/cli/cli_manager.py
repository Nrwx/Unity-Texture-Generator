import threading
import time
from typing import Callable, Optional, Dict, Any
from .console import Console

class CLIManager:
    def __init__(self, logger=None, backend=None, config_loader=None):
        self.commands: Dict[str, Dict[str, Any]] = {}
        self.logger = logger
        self.auto_sequence = []
        self._lock = threading.RLock()
        self.auto_enabled = False
        self.backend = backend
        self.config_loader = config_loader
        if self.config_loader:
            seq = self.config_loader.get("auto_sequence", [])
            if seq:
                self.auto_sequence = seq

    def register_command(self, keyword: str, func: Callable, description: str = ""):
        self.commands[keyword] = {"func": func, "description": description}

    def run_command(self, command_line: str):
        """
        Führt einen registrierten CLI-Befehl mit optionalen Argumenten aus.
        Beispiel:
          'start-backend -w' -> keyword='start-backend', args=['-w']
          'restart-backend --external' -> keyword='restart-backend', args=['--external']
        """
        parts = command_line.strip().split()
        if not parts:
            return

        keyword = parts[0]
        args = parts[1:]

        if keyword not in self.commands:
            Console.print(f"Unbekannter Befehl: {command_line}", "BACKEND-CLI", "MANAGER", "⚠️", "warning")
            return

        func = self.commands[keyword]["func"]
        Console.print(f"Manager startet Befehl: {command_line}", "BACKEND-CLI", "INFO", "🔔️", "success")

        try:
            func(*args)  # ✅ übergibt Flags wie -w oder --external
        except Exception as e:
            Console.print(f"Fehler in Befehl '{keyword}': {e}", "BACKEND-CLI", "MANAGER", "❌️", "error")

    def run_auto_sequence(self):
        self.auto_enabled = True
        for keyword in self.auto_sequence:
            if not self.auto_enabled:
                Console.print("Auto-Setup abgebrochen.", "BACKEND-CLI", "MANAGER", "⚠️", "warning")
                break
            if keyword in self.commands:
                self.run_command(keyword)
                time.sleep(0.25)
            else:
                Console.print(f"Befehl '{keyword}' nicht gefunden, übersprungen.", "BACKEND-CLI", "MANAGER", "⚠️", "warning")

    def stop_auto(self):
        self.auto_enabled = False

    def start_cli(self):
        Console.print("erfolgreich gestartet...", "BACKEND-CLI", "MANAGER", "🚀", "success")
        while True:
            Console.print("Verfügbare Befehle:", "BACKEND-CLI", "MANAGER", "🔒", "warning")
            for k, v in self.commands.items():
                Console.print(f"'{k}' -> {v['description']}", "BACKEND-CLI", "CMD", "🧩", "info")
            Console.print("'auto' -> Auto-Setup ausführen", "BACKEND-CLI", "CMD", "🧩", "info")
            Console.print("'exit' -> Beenden", "BACKEND-CLI", "CMD", "🧩", "info")

            choice = input("▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█▊█  Eingabe: ").strip()

            if not choice:
                continue

            if choice == "exit":
                Console.print("erfolgreich beendet...", "BACKEND-CLI", "MANAGER", "🛡️", "success")
                break
            elif choice == "auto":
                self.run_auto_sequence()
            elif choice == "config":
                if "config" in self.commands:
                    self.run_command("config")
                else:
                    Console.print("Keine verfügbaren Befehle registriert:", "BACKEND-CLI", "MANAGER", "🧩", "warning")
            else:
                # ⚡️ Hauptänderung: Übergibt vollständige Eingabe (inkl. Flags)
                self.run_command(choice)