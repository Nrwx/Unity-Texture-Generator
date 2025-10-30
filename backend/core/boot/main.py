# boot.py
# Dynamischer Bootloader — arbeitet ausschließlich mit übergebenen Parametern.
from __future__ import annotations
from pathlib import Path
from datetime import datetime
from typing import Callable, Optional, Dict, Any, List
import threading

# Typdefinition für das Log-System
LOG_TYPE = Callable[[str, str, str, Optional[str]], None]


class Boot:
    """
    Dynamischer Bootloader, der alle Komponenten ausschließlich über Parameter injiziert.

    Parameter:
      - registry: Registry-Instanz (muss get/set bereitstellen)
      - task_manager: TaskManager-Instanz (muss run_task bereitstellen)
      - log: Callable(msg, instance, level, icon)
      - sequence: Liste von Modulnamen (Reihenfolge)
      - actions: Dict[module_name -> Callable(name, path)]
      - params: Dict[module_name -> Callable[[], dict]]
      - threads: Dict[module_name -> Callable[[], dict]]
      - base_dir: Basisverzeichnis (Path)
      - development: bool
      - log_level: int
    """

    def __init__(
        self,
        *,
        registry: Any,
        task_manager: Any,
        log: LOG_TYPE,
        sequence: List[str],
        actions: Dict[str, Callable[[str, Path], Any]],
        params: Dict[str, Callable[[], Dict[str, Any]]],
        threads: Dict[str, Callable[[], Dict[str, Any]]],
        base_dir: Path,
        development: bool = False,
        log_level: int = 1
    ):
        self.registry = registry
        self.task_manager = task_manager
        self.log = log
        self.sequence = sequence
        self.actions = actions
        self.params = params
        self.threads = threads
        self.base_dir = base_dir
        self.development = development
        self.log_level = log_level
        self._lock = threading.RLock()

    # -------------------------------------------------------------
    # Modul-Execution
    # -------------------------------------------------------------
    def run_module(self, module_name: str):
        """Führt ein einzelnes Setup-Modul aus."""
        with self._lock:
            self.log(f"Starte Modul: {module_name}", "BOOT", "MODULE", "⚙️")
            try:
                self.task_manager.run_task(module_name)
                self.log(f"Modul '{module_name}' abgeschlossen.", "BOOT", "MODULE", "🧩")
            except KeyError as ke:
                self.log(f"Modul '{module_name}' nicht gefunden: {ke}", "BOOT", "MODULE", "❌")
            except Exception as e:
                self.log(f"Fehler beim Ausführen '{module_name}': {e}", "BOOT", "MODULE", "❌")

    # -------------------------------------------------------------
    # Haupt-Setup-Routine
    # -------------------------------------------------------------
    def init_setup(self) -> int:
        """
        Führt den vollständigen Boot-Prozess aus:
        - registriert zentrale Komponenten
        - führt alle Setup-Module sequentiell aus
        Gibt die Anzahl erfolgreich abgeschlossener Module zurück.
        """
        with self._lock:
            self.log("Bootvorgang gestartet...", "SYSTEM", "INFO", "🔔")

            total_modules = len(self.sequence)
            self.log(f"Erforderliche Module: {total_modules}", "BOOT", "SETUP", "📦")

            success_count = 0
            for idx, module_name in enumerate(self.sequence, start=1):
                progress = int((idx - 1) / total_modules * 100) if total_modules else 100
                self.log(
                    f"{progress}% | ({idx-1}/{total_modules}) abgeschlossen.",
                    "BOOT",
                    "SETUP",
                    "🚀"
                )
                try:
                    self.run_module(module_name)
                    success_count += 1
                except Exception as e:
                    self.log(f"ausführen fehlgeschlagen: {e}", "BOOT", module_name, "❌")

            self.log(f"100% | ({success_count}/{total_modules}) abgeschlossen.", "BOOT", "SETUP", "🚀")
            self.log("Systemkomponenten einsatzbereit.", "SYSTEM", "INFO", "🔔")
            self.log("Bootvorgang abgeschlossen.", "SYSTEM", "INFO", "🔔")

            return success_count
