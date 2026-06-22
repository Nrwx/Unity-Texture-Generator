import os
import shlex
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, List

from .console import Console


class CLIManager:
    def __init__(self, logger=None, backend=None, config_loader=None):
        self.commands: Dict[str, Dict[str, Any]] = {}
        self.logger = logger
        self.auto_sequence: List[str] = []
        self._lock = threading.RLock()
        self.auto_enabled = False
        self.backend = backend
        self.config_loader = config_loader
        self.cwd = Path.cwd()
        self.history: List[str] = []

        if self.config_loader:
            seq = self.config_loader.get("auto_sequence", [])
            if isinstance(seq, list):
                self.auto_sequence = [str(item) for item in seq]

        self._register_terminal_commands()

    def register_command(self, keyword: str, func: Callable, description: str = ""):
        self.commands[keyword] = {"func": func, "description": description}

    def run_command(self, command_line: str) -> int:
        command_line = (command_line or "").strip()
        if not command_line:
            return 0

        self.history.append(command_line)

        try:
            parts = shlex.split(command_line, posix=False)
        except ValueError as exc:
            Console.print(f"Could not parse input: {exc}", "BACKEND-CLI", "INPUT", None, "error")
            return 2

        if not parts:
            return 0

        keyword = parts[0]
        args = parts[1:]

        if keyword.startswith("!"):
            return self.run_shell(command_line[1:].strip())

        if keyword in self.commands:
            Console.print(f"> {command_line}", "BACKEND-CLI", "RUN", None, "info")
            try:
                result = self.commands[keyword]["func"](*args)
                return int(result or 0)
            except SystemExit as exc:
                return int(exc.code or 0)
            except Exception as exc:
                Console.print(f"Command '{keyword}' failed: {exc}", "BACKEND-CLI", "ERROR", None, "error")
                return 1

        return self.run_shell(command_line)

    def run_shell(self, command_line: str) -> int:
        if not command_line:
            return 0

        Console.print(f"$ {command_line}", "SHELL", "RUN", None, "info")
        try:
            proc = subprocess.run(command_line, cwd=str(self.cwd), shell=True)
            return int(proc.returncode or 0)
        except KeyboardInterrupt:
            Console.print("Command interrupted.", "SHELL", "INTERRUPT", None, "warning")
            return 130
        except Exception as exc:
            Console.print(f"Shell command failed: {exc}", "SHELL", "ERROR", None, "error")
            return 1

    def run_auto_sequence(self) -> int:
        self.auto_enabled = True
        exit_code = 0
        for keyword in self.auto_sequence:
            if not self.auto_enabled:
                Console.print("Auto sequence cancelled.", "BACKEND-CLI", "AUTO", None, "warning")
                break
            if keyword in self.commands:
                code = self.run_command(keyword)
                exit_code = exit_code or code
                time.sleep(0.25)
            else:
                Console.print(f"Command '{keyword}' not found; skipped.", "BACKEND-CLI", "AUTO", None, "warning")
        return exit_code

    def stop_auto(self):
        self.auto_enabled = False

    def start_cli(self) -> None:
        Console.print("Unity Texture Generator Backend Terminal", "BACKEND-CLI", "READY", None, "success")
        Console.print("Type 'help' for commands, 'exit' to quit. Unknown commands run in the shell.", "BACKEND-CLI", "INFO", None, "info")

        while True:
            try:
                choice = input(f"utg-backend {self.cwd}> ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                Console.print("Terminal closed.", "BACKEND-CLI", "EXIT", None, "success")
                break

            if not choice:
                continue

            if choice in ("exit", "quit"):
                Console.print("Terminal closed.", "BACKEND-CLI", "EXIT", None, "success")
                break

            self.run_command(choice)

    def _register_terminal_commands(self) -> None:
        self.register_command("help", self._help, "Show commands and terminal behavior")
        self.register_command("pwd", self._pwd, "Show the current working directory")
        self.register_command("cd", self._cd, "Change the working directory")
        self.register_command("ls", self._ls, "List files in the working directory")
        self.register_command("dir", self._ls, "Alias for ls")
        self.register_command("clear", self._clear, "Clear the console")
        self.register_command("cls", self._clear, "Alias for clear")
        self.register_command("history", self._history, "Show recent CLI input")
        self.register_command("auto", lambda *args: self.run_auto_sequence(), "Run auto_sequence from config.json")

    def _help(self, *args) -> int:
        Console.print("Backend terminal commands:", "BACKEND-CLI", "HELP", None, "info")
        for name in sorted(self.commands):
            desc = self.commands[name].get("description", "")
            Console.print(f"{name:<18} {desc}", "BACKEND-CLI", "CMD", None, "info")
        Console.print("Unknown commands are passed through to the host shell.", "BACKEND-CLI", "HELP", None, "info")
        Console.print("Use '! <command>' to force shell execution.", "BACKEND-CLI", "HELP", None, "info")
        return 0

    def _pwd(self, *args) -> int:
        print(self.cwd)
        return 0

    def _cd(self, *args) -> int:
        target = self._strip_quotes(args[0]) if args else str(Path.home())
        next_path = Path(target)
        if not next_path.is_absolute():
            next_path = self.cwd / next_path
        next_path = next_path.resolve()

        if not next_path.exists() or not next_path.is_dir():
            Console.print(f"Directory not found: {next_path}", "BACKEND-CLI", "CD", None, "error")
            return 1

        self.cwd = next_path
        Console.print(str(self.cwd), "BACKEND-CLI", "PWD", None, "success")
        return 0

    def _ls(self, *args) -> int:
        target = Path(self._strip_quotes(args[0])) if args else self.cwd
        if not target.is_absolute():
            target = self.cwd / target
        target = target.resolve()

        if not target.exists():
            Console.print(f"Path not found: {target}", "BACKEND-CLI", "LS", None, "error")
            return 1

        if target.is_file():
            print(target.name)
            return 0

        for item in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
            suffix = "/" if item.is_dir() else ""
            print(f"{item.name}{suffix}")
        return 0

    def _clear(self, *args) -> int:
        os.system("cls" if os.name == "nt" else "clear")
        return 0

    def _history(self, *args) -> int:
        limit = 30
        for index, item in enumerate(self.history[-limit:], start=max(1, len(self.history) - limit + 1)):
            print(f"{index}: {item}")
        return 0

    def _strip_quotes(self, value: str) -> str:
        return str(value).strip().strip('"').strip("'")
