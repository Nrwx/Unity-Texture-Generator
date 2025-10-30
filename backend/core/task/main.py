import importlib.util
import sys
import os
import shutil
import threading
import time
from datetime import datetime
from pathlib import Path
import multiprocessing
import ctypes

# ==========================================================
# --- Optional libraries (psutil, pynvml, torch) ---
# ==========================================================
try:
    import psutil
    PSUTIL_AVAILABLE = True
except Exception:
    psutil = None
    PSUTIL_AVAILABLE = False

# Try pynvml first, fallback to nvidia_ml_py
PYNVML_AVAILABLE = False
pynvml = None
try:
    import pynvml as _pynvml
    try:
        _pynvml.nvmlInit()
        pynvml = _pynvml
        PYNVML_AVAILABLE = True
    except Exception:
        pynvml = _pynvml
except Exception:
    try:
        import nvidia_ml_py as _pynvml
        try:
            _pynvml.nvmlInit()
            pynvml = _pynvml
            PYNVML_AVAILABLE = True
        except Exception:
            pynvml = _pynvml
    except Exception:
        pass

try:
    import torch
    TORCH_AVAILABLE = True
except Exception:
    torch = None
    TORCH_AVAILABLE = False

# Ensure multiprocessing start method
try:
    multiprocessing.get_start_method()
except RuntimeError:
    try:
        multiprocessing.set_start_method("spawn", force=False)
    except Exception:
        pass


# ==========================================================
# --- TaskManager Definition ---
# ==========================================================
class TaskManager:
    """
    Universeller Task Manager für Setup-, Utility- und Systemmodule.
    Unterstützt:
    - Manuelles und geplantes Ausführen von Tasks
    - Thread-Steuerung basierend auf threads
    - Nutzung optionaler Libs (psutil, pynvml, torch)

    Usage:
        # Erste Initialisierung (erforderlich, sinnvoll mit registry)
        tm = TaskManager(registry, "/pfad/zu/tasks")

        # Später: neue Werte automatisch übernehmen (merge oder replace)
        tm2 = TaskManager(None, None, reconfigure_on_init=True, reconfigure_mode="merge",
                          actions=new_pre_actions)

        # Oder manuell reconfiguren
        tm.reconfigure(actions=new_pre_actions, mode="replace")
    """

    # --- Singleton (Klassenweit) ---
    _instance = None
    _singleton_lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._singleton_lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(self,
                 registry=None,
                 tasks_dir: str | Path | None = None,
                 actions: dict | None = None,
                 params: dict | None = None,
                 threads: dict | None = None,
                 *,
                 reconfigure_on_init: bool = False,
                 reconfigure_mode: str = "merge",
                 log=None,
                 development: bool = False,
                 log_level: int = 1,
                 ):
        """
        Bei Erst-Init: Initialisiert Instanz.
        Bei bereits initialisierter Instanz:
          - wenn reconfigure_on_init=True → führt reconfigure(...) mit übergebenen Werten aus.
          - sonst: kein Re-Init / keine Änderung.

        reconfigure_mode: "merge" (Standard) oder "replace"
        """
        # Wenn noch nicht initialisiert → Initialisierung (läuft einmal)
        if not getattr(self, "_initialized", False):
            # Grund-Initialisierung (sichere Defaults)
            self.registry = registry
            self.tasks_dir = Path(tasks_dir) if tasks_dir is not None else Path(".")
            self.actions = actions or {}
            self.params = params or {}
            self.threads = threads or {}
            self._scheduled_tasks = []
            self._running_threads = {}
            self._lock = threading.Lock()  # Instanz-spezifisch
            self._initialized = True
            self._log = log
            self._development = development
            self._log_level = log_level

            # Ensure directory exists
            try:
                if not self.tasks_dir.exists():
                    self.tasks_dir.mkdir(parents=True, exist_ok=True)
            except Exception:
                pass

            self._log("initialisiert (Singleton).", "TASK-MANAGER", "CONFIG", "🔧")
            return

        # Wenn bereits initialisiert
        if reconfigure_on_init:
            # Baue ein dict mit nur den explizit übergebenen Werten
            updates = {}
            if registry is not None:
                updates["registry"] = registry
            if tasks_dir is not None:
                updates["tasks_dir"] = tasks_dir
            if actions is not None:
                updates["actions"] = actions
            if params is not None:
                updates["params"] = params
            if threads is not None:
                updates["threads"] = threads

            # Führe Reconfigure thread-sicher aus
            try:
                self.reconfigure(**updates, mode=reconfigure_mode)
                self._log("updates angewendet.", "TASK-MANAGER", "UPDATED", "🔁")
            except Exception as e:
                self._log(f"fehler beim updaten: {e}", "TASK-MANAGER", "ERROR", "📛")
        else:
            self._log("bereits initialisiert.", "TASK-MANAGER", "THREAD-LOCK", "🔒")

    # -------------------------------------------------------------
    # Reconfigure API (thread-sicher)
    # -------------------------------------------------------------
    def reconfigure(self,
                    registry=None,
                    tasks_dir: str | Path | None = None,
                    actions: dict | None = None,
                    params: dict | None = None,
                    threads: dict | None = None,
                    *,
                    mode: str = "merge"):
        """
        Reconfigure: Aktualisiert Konfiguration der Singleton-Instanz.

        Args:
            mode: "merge" (nur gegebene Werte updaten / dicts mergen) oder "replace"
                  ("replace" setzt die Felder auf genau die übergebenen Werte; wenn None → leert Feld)
        """
        if mode not in ("merge", "replace"):
            raise ValueError("mode muss 'merge' oder 'replace' sein")

        with self._lock:
            # registry
            if registry is not None:
                self.registry = registry
            elif mode == "replace" and registry is None:
                self.registry = None

            # tasks_dir (handle Path + create)
            if tasks_dir is not None:
                td = Path(tasks_dir)
                try:
                    td.mkdir(parents=True, exist_ok=True)
                except Exception:
                    pass
                self.tasks_dir = td
            elif mode == "replace" and tasks_dir is None:
                self.tasks_dir = Path(".")

            # actions (dict)
            if actions is not None:
                if mode == "merge":
                    # shallow merge: vorhandene keys bleiben, neue keys überschreiben
                    if not isinstance(self.actions, dict):
                        self.actions = {}
                    self.actions.update(actions)
                else:  # replace
                    self.actions = actions or {}
            elif mode == "replace":
                self.actions = {}

            # params (dict)
            if params is not None:
                if mode == "merge":
                    if not isinstance(self.params, dict):
                        self.params = {}
                    self.params.update(params)
                else:
                    self.params = params or {}
            elif mode == "replace":
                self.params = {}

            # threads (dict or callables)
            if threads is not None:
                if mode == "merge":
                    if not isinstance(self.threads, dict):
                        self.threads = {}
                    self.threads.update(threads)
                else:
                    self.threads = threads or {}
            elif mode == "replace":
                self.threads = {}

            self._log("die Konfiguration wurde aktualisiert: (mode=" + mode + ").", "TASK-MANAGER", "RE-CONFIG", "🛠")
            return True

    # -------------------------------------------------------------
    # Arbeitsverzeichnis wechseln (z. B. für temporäre Module)
    # -------------------------------------------------------------
    def set_working_dir(self, new_dir: str | Path, restore: bool = False):
        """
        Ändert das Arbeitsverzeichnis des TaskManagers (tasks_dir).

        Args:
            new_dir (str | Path): Neues Arbeitsverzeichnis oder Original (wenn restore=True)
            restore (bool): Wenn True, wird das vorherige Verzeichnis wiederhergestellt

        Returns:
            Path: Das aktuell gesetzte tasks_dir
        """
        if not hasattr(self, "_original_tasks_dir"):
            # Originalverzeichnis beim ersten Mal sichern
            self._original_tasks_dir = self.tasks_dir

        # Wenn restore=True → altes Verzeichnis wiederherstellen
        if restore:
            self.tasks_dir = self._original_tasks_dir
            self._log(f"Verzeichnis wiederhergestellt: {self.tasks_dir}", "TASK-MANAGER", "PATH", "📁")
            return self.tasks_dir

        # Neues Zielverzeichnis prüfen
        new_dir = Path(new_dir)
        if not new_dir.exists():
            try:
                new_dir.mkdir(parents=True, exist_ok=True)
                self._log(f"Verzeichnis erstellt: {new_dir}", "TASK-MANAGER", "PATH", "📁" )
            except Exception as e:
                self._log(f"Verzeichnis nicht erstellt: {e}", "TASK-MANAGER", "ERROR", "📛")
                return self.tasks_dir

        # Arbeitsverzeichnis ändern
        self.tasks_dir = new_dir
        self._log(f"Verzeichnis gewechselt: {new_dir}", "TASK-MANAGER", "PATH", "📂")
        return self.tasks_dir


    # -------------------------------------------------------------
    # Modul laden
    # -------------------------------------------------------------
    def _load_module(self, module_name: str):
        file_path = self.tasks_dir / f"{module_name}.py"
        if not file_path.exists():
            self._log(f"Modul '{module_name}' nicht gefunden: {file_path}", "TASK-MANAGER", "WARNING", "⚠")
            return None, None

        spec = importlib.util.spec_from_file_location(module_name, file_path)
        if spec is None:
            self._log(f"Modul '{module_name}' nicht ausgeführt", "TASK-MANAGER", "WARNING", "⚠")
            return None, None

        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        return module, spec

        # ---------------------------
        # GPU health probe (best-effort)
        # ---------------------------
        def _probe_gpu_health(self, active_gpu_entry):
            """
            Erwartet entweder:
              - None -> liefert defaults
              - ein dict mit 'value' (device-object) und optionalen keys:
                  'gpu_util','mem_used','mem_total','gpu_name','vendor',...
              - oder direkt ein device-object (handle both)

            Rückgabe-Dict:
                {
                  'gpu_name': str,
                  'vendor': str|None,
                  'gpu_util': float (0-100),
                  'mem_used_mb': float,
                  'mem_total_mb': float,
                  'mem_percent': float,
                  'raw_device': object
                }
            Diese Funktion versucht mehrere bekannte Schlüssel und Attribute/Methode-Namen.
            """

            # defaults
            out = {
                'gpu_name': None,
                'vendor': None,
                'gpu_util': 0.0,
                'mem_used_mb': 0.0,
                'mem_total_mb': 0.0,
                'mem_percent': 0.0,
                'raw_device': None,
            }

            if not active_gpu_entry:
                return out

            # if user stored dict with 'value' and health keys
            device = None
            if isinstance(active_gpu_entry, dict):
                device = active_gpu_entry.get('value', None)
                # prefer explicit provided metrics in the dict
                for k in ('gpu_util', 'utilization', 'util', 'gpu_usage'):
                    if k in active_gpu_entry:
                        try:
                            out['gpu_util'] = float(active_gpu_entry[k])
                            break
                        except Exception:
                            pass
                for k in ('mem_used', 'mem_used_mb', 'vram_used_mb', 'memory_used_mb'):
                    if k in active_gpu_entry:
                        try:
                            out['mem_used_mb'] = float(active_gpu_entry[k])
                            break
                        except Exception:
                            pass
                for k in ('mem_total', 'mem_total_mb', 'vram_total_mb', 'memory_total_mb'):
                    if k in active_gpu_entry:
                        try:
                            out['mem_total_mb'] = float(active_gpu_entry[k])
                            break
                        except Exception:
                            pass
                for k in ('gpu_name', 'name', 'device_name'):
                    if k in active_gpu_entry and active_gpu_entry[k]:
                        out['gpu_name'] = str(active_gpu_entry[k])
                        break
                if 'vendor' in active_gpu_entry:
                    out['vendor'] = active_gpu_entry.get('vendor')

            else:
                # active_gpu_entry might be a device object directly
                device = active_gpu_entry

            out['raw_device'] = device

            # helper to safely call attribute / method and return number or string
            def _call_attr(obj, names):
                for n in names:
                    try:
                        if hasattr(obj, n):
                            val = getattr(obj, n)
                            if callable(val):
                                try:
                                    val = val()
                                except Exception:
                                    # sometimes it's a property object that requires no call
                                    pass
                            return val
                    except Exception:
                        continue
                return None

            # If device is present, try to introspect:
            if device is not None:
                # Name/vendor
                name_val = _call_attr(device, ('name', 'device_name', 'gpu_name', 'get_name', '__str__'))
                if out['gpu_name'] is None and name_val is not None:
                    try:
                        out['gpu_name'] = str(name_val)
                    except Exception:
                        out['gpu_name'] = None

                vendor_val = _call_attr(device, ('vendor', 'backend_type', 'platform', 'get_vendor'))
                if vendor_val and out['vendor'] is None:
                    try:
                        out['vendor'] = str(vendor_val)
                    except Exception:
                        out['vendor'] = None

                # memory total: many devices expose 'global_mem_size' (dpctl), or mem_total attributes
                mem_total_val = _call_attr(device, ('mem_total', 'memory_total', 'vram_total', 'global_mem_size', 'get_total_memory'))
                if mem_total_val is not None:
                    try:
                        # if bytes -> convert
                        if isinstance(mem_total_val, (int, float)) and mem_total_val > 10000:
                            out['mem_total_mb'] = float(mem_total_val) / (1024 ** 2)
                        else:
                            out['mem_total_mb'] = float(mem_total_val)
                    except Exception:
                        pass

                # memory used: check several attr names
                mem_used_val = _call_attr(device, ('mem_used', 'memory_used', 'vram_used', 'get_used_memory'))
                if mem_used_val is not None:
                    try:
                        if isinstance(mem_used_val, (int, float)) and mem_used_val > 10000:
                            out['mem_used_mb'] = float(mem_used_val) / (1024 ** 2)
                        else:
                            out['mem_used_mb'] = float(mem_used_val)
                    except Exception:
                        pass

                # utilization: check common names and nested info structures
                util_val = _call_attr(device, ('gpu_util', 'utilization', 'util', 'usage_percent', 'get_utilization'))
                if util_val is not None:
                    try:
                        out['gpu_util'] = float(util_val)
                    except Exception:
                        pass

                # some NVidia wrappers may expose memory info via method returning tuple/dict
                try:
                    mem_info = _call_attr(device, ('memory_info', 'get_memory_info', 'memory'))
                    if mem_info:
                        # mem_info could be dict-like or object with attributes
                        if isinstance(mem_info, dict):
                            if 'used' in mem_info and 'total' in mem_info:
                                used = mem_info.get('used')
                                total = mem_info.get('total')
                                if isinstance(used, (int, float)) and isinstance(total, (int, float)):
                                    # assume bytes
                                    if used > 10000:
                                        out['mem_used_mb'] = float(used) / (1024 ** 2)
                                    else:
                                        out['mem_used_mb'] = float(used)
                                    if total > 10000:
                                        out['mem_total_mb'] = float(total) / (1024 ** 2)
                                    else:
                                        out['mem_total_mb'] = float(total)
                        else:
                            # object with attributes used/total
                            try:
                                used = getattr(mem_info, 'used', None)
                                total = getattr(mem_info, 'total', None)
                                if used is not None:
                                    if isinstance(used, (int, float)) and used > 10000:
                                        out['mem_used_mb'] = float(used) / (1024 ** 2)
                                    else:
                                        out['mem_used_mb'] = float(used)
                                if total is not None:
                                    if isinstance(total, (int, float)) and total > 10000:
                                        out['mem_total_mb'] = float(total) / (1024 ** 2)
                                    else:
                                        out['mem_total_mb'] = float(total)
                            except Exception:
                                pass
                except Exception:
                    pass

            # Compute mem_percent if possible
            try:
                if out['mem_total_mb'] and out['mem_total_mb'] > 0:
                    out['mem_percent'] = (out['mem_used_mb'] / out['mem_total_mb']) * 100 if out['mem_used_mb'] else 0.0
            except Exception:
                out['mem_percent'] = 0.0

            # final fallbacks
            if out['gpu_name'] is None:
                try:
                    out['gpu_name'] = str(device) if device is not None else "No GPU"
                except Exception:
                    out['gpu_name'] = "No GPU"

            return out

    # ---------------------------
    # GPU health probe (best-effort)
    # ---------------------------
    def _probe_gpu_health(self, active_gpu_entry):
        """
        Erwartet entweder:
          - None -> liefert defaults
          - ein dict mit 'value' (device-object) und optionalen keys:
              'gpu_util','mem_used','mem_total','gpu_name','vendor',...
          - oder direkt ein device-object (handle both)

        Rückgabe-Dict:
            {
              'gpu_name': str,
              'vendor': str|None,
              'gpu_util': float (0-100),
              'mem_used_mb': float,
              'mem_total_mb': float,
              'mem_percent': float,
              'raw_device': object
            }
        Diese Funktion versucht mehrere bekannte Schlüssel und Attribute/Methode-Namen.
        """

        # defaults
        out = {
            'gpu_name': None,
            'vendor': None,
            'gpu_util': 0.0,
            'mem_used_mb': 0.0,
            'mem_total_mb': 0.0,
            'mem_percent': 0.0,
            'raw_device': None,
        }

        if not active_gpu_entry:
            return out

        # if user stored dict with 'value' and health keys
        device = None
        if isinstance(active_gpu_entry, dict):
            device = active_gpu_entry.get('value', None)
            # prefer explicit provided metrics in the dict
            for k in ('gpu_util', 'utilization', 'util', 'gpu_usage'):
                if k in active_gpu_entry:
                    try:
                        out['gpu_util'] = float(active_gpu_entry[k])
                        break
                    except Exception:
                        pass
            for k in ('mem_used', 'mem_used_mb', 'vram_used_mb', 'memory_used_mb'):
                if k in active_gpu_entry:
                    try:
                        out['mem_used_mb'] = float(active_gpu_entry[k])
                        break
                    except Exception:
                        pass
            for k in ('mem_total', 'mem_total_mb', 'vram_total_mb', 'memory_total_mb'):
                if k in active_gpu_entry:
                    try:
                        out['mem_total_mb'] = float(active_gpu_entry[k])
                        break
                    except Exception:
                        pass
            for k in ('gpu_name', 'name', 'device_name'):
                if k in active_gpu_entry and active_gpu_entry[k]:
                    out['gpu_name'] = str(active_gpu_entry[k])
                    break
            if 'vendor' in active_gpu_entry:
                out['vendor'] = active_gpu_entry.get('vendor')

        else:
            # active_gpu_entry might be a device object directly
            device = active_gpu_entry

        out['raw_device'] = device

        # helper to safely call attribute / method and return number or string
        def _call_attr(obj, names):
            for n in names:
                try:
                    if hasattr(obj, n):
                        val = getattr(obj, n)
                        if callable(val):
                            try:
                                val = val()
                            except Exception:
                                # sometimes it's a property object that requires no call
                                pass
                        return val
                except Exception:
                    continue
            return None

        # If device is present, try to introspect:
        if device is not None:
            # Name/vendor
            name_val = _call_attr(device, ('name', 'device_name', 'gpu_name', 'get_name', '__str__'))
            if out['gpu_name'] is None and name_val is not None:
                try:
                    out['gpu_name'] = str(name_val)
                except Exception:
                    out['gpu_name'] = None

            vendor_val = _call_attr(device, ('vendor', 'backend_type', 'platform', 'get_vendor'))
            if vendor_val and out['vendor'] is None:
                try:
                    out['vendor'] = str(vendor_val)
                except Exception:
                    out['vendor'] = None

            # memory total: many devices expose 'global_mem_size' (dpctl), or mem_total attributes
            mem_total_val = _call_attr(device, ('mem_total', 'memory_total', 'vram_total', 'global_mem_size', 'get_total_memory'))
            if mem_total_val is not None:
                try:
                    # if bytes -> convert
                    if isinstance(mem_total_val, (int, float)) and mem_total_val > 10000:
                        out['mem_total_mb'] = float(mem_total_val) / (1024 ** 2)
                    else:
                        out['mem_total_mb'] = float(mem_total_val)
                except Exception:
                    pass

            # memory used: check several attr names
            mem_used_val = _call_attr(device, ('mem_used', 'memory_used', 'vram_used', 'get_used_memory'))
            if mem_used_val is not None:
                try:
                    if isinstance(mem_used_val, (int, float)) and mem_used_val > 10000:
                        out['mem_used_mb'] = float(mem_used_val) / (1024 ** 2)
                    else:
                        out['mem_used_mb'] = float(mem_used_val)
                except Exception:
                    pass

            # utilization: check common names and nested info structures
            util_val = _call_attr(device, ('gpu_util', 'utilization', 'util', 'usage_percent', 'get_utilization'))
            if util_val is not None:
                try:
                    out['gpu_util'] = float(util_val)
                except Exception:
                    pass

            # some NVidia wrappers may expose memory info via method returning tuple/dict
            try:
                mem_info = _call_attr(device, ('memory_info', 'get_memory_info', 'memory'))
                if mem_info:
                    # mem_info could be dict-like or object with attributes
                    if isinstance(mem_info, dict):
                        if 'used' in mem_info and 'total' in mem_info:
                            used = mem_info.get('used')
                            total = mem_info.get('total')
                            if isinstance(used, (int, float)) and isinstance(total, (int, float)):
                                # assume bytes
                                if used > 10000:
                                    out['mem_used_mb'] = float(used) / (1024 ** 2)
                                else:
                                    out['mem_used_mb'] = float(used)
                                if total > 10000:
                                    out['mem_total_mb'] = float(total) / (1024 ** 2)
                                else:
                                    out['mem_total_mb'] = float(total)
                    else:
                        # object with attributes used/total
                        try:
                            used = getattr(mem_info, 'used', None)
                            total = getattr(mem_info, 'total', None)
                            if used is not None:
                                if isinstance(used, (int, float)) and used > 10000:
                                    out['mem_used_mb'] = float(used) / (1024 ** 2)
                                else:
                                    out['mem_used_mb'] = float(used)
                            if total is not None:
                                if isinstance(total, (int, float)) and total > 10000:
                                    out['mem_total_mb'] = float(total) / (1024 ** 2)
                                else:
                                    out['mem_total_mb'] = float(total)
                        except Exception:
                            pass
            except Exception:
                pass

        # Compute mem_percent if possible
        try:
            if out['mem_total_mb'] and out['mem_total_mb'] > 0:
                out['mem_percent'] = (out['mem_used_mb'] / out['mem_total_mb']) * 100 if out['mem_used_mb'] else 0.0
        except Exception:
            out['mem_percent'] = 0.0

        # final fallbacks
        if out['gpu_name'] is None:
            try:
                out['gpu_name'] = str(device) if device is not None else "No GPU"
            except Exception:
                out['gpu_name'] = "No GPU"

        return out

    # ---------------------------
    # Thread-Konfiguration: CPU + ACTIVE_GPU (vollständig)
    # ---------------------------
    def _apply_thread_config(self, module_name):
        cfg = self.threads.get(module_name, lambda: {})()
        cpu_target = cfg.get("cpu", 100)
        gpu_target = cfg.get("gpu", 100)
        log_level = cfg.get("log_level", 1)

        # --- CPU Info & Throttling ---
        if PSUTIL_AVAILABLE:
            try:
                import psutil
                sample_interval = 0.2
                psutil.cpu_percent(interval=None, percpu=True)
                cpu_per_core = psutil.cpu_percent(interval=sample_interval, percpu=True)
                cpu_usage = sum(cpu_per_core) / len(cpu_per_core) if cpu_per_core else 0.0
                mem = psutil.virtual_memory()

                # --- Logging ---
                self._log(f"'{module_name}' wird ausgeführt...", "TASK-MANAGER", "TASK", "📆")

                # CPU-String mappen → z. B. "1:42% 2:65% 3:70% 4:48%"
                cpu_core_str = " ".join(f"{i}:{usage:.0f}%" for i, usage in enumerate(cpu_per_core, start=1))

                # CPU-Gesamtanzeige
                self._log(f"{cpu_usage:.1f}% | CORE: [{cpu_core_str}]", "TASK-MANAGER", "CPU", "🧠")

                # --- RAM ---
                total_gb = mem.total / (1024**3)
                used_gb = mem.used / (1024**3)
                available_gb = mem.available / (1024**3)
                percent = mem.percent

                ram_str = f"{percent:.1f}% | USED: {used_gb:.1f}/{total_gb:.1f} GB | FREE: {available_gb:.1f} GB"
                self._log(ram_str, "TASK-MANAGER", "RAM", "💾")

                # Throttling bei Überschreitung
                if cpu_usage > cpu_target:
                    delay = min((cpu_usage - cpu_target) / 100.0, 1.0)
                    self._log(f"Limit für '{module_name}': {cpu_target}%", "TASK-MANAGER", "CPU", "🧠")
                    self._log(f"Throttle aktiv – usage: {cpu_usage:.1f}%, limit: {cpu_target}%", "TASK-MANAGER", "CPU", "🧠")
                    self._log(f"Warte {delay:.2f}s", "TASK-MANAGER", "CPU", "🧠")
                    time.sleep(delay)

            except Exception as e:
                self._log(f"[{module_name}] psutil Fehler: {e}", "TASK-MANAGER", "WARN")
        else:
            self._log(f"[{module_name}] psutil nicht verfügbar; CPU-Stats werden nicht geliefert.", "TASK-MANAGER", "CPU")

        # --- GPU: immer über ACTIVE_GPU (value) aus GLOBAL_MANAGER ermitteln ---
        try:
            active_gpu_entry = self.registry.get("ACTIVE_GPU")
        except Exception:
            active_gpu_entry = None

        if not active_gpu_entry:
            self._log(f"Konfiguration erfolgreich für: '{module_name}', CPU: {cpu_target}%, LOG: {log_level}", "TASK-MANAGER", "TASK", "📆")
            return

        # Probe GPU health (best-effort)
        try:
            health = self._probe_gpu_health(active_gpu_entry)
            gpu_name = health.get('gpu_name') or "GPU"
            vendor = health.get('vendor')
            gpu_util = float(health.get('gpu_util') or 0.0)
            mem_used_mb = float(health.get('mem_used_mb') or 0.0)
            mem_total_mb = float(health.get('mem_total_mb') or 0.0)
            mem_percent = float(health.get('mem_percent') or 0.0)

            vendor_str = f" ({vendor})" if vendor else ""
            if mem_total_mb:
                mem_summary = f"{mem_used_mb:.0f}/{mem_total_mb:.0f} MB ({mem_percent:.1f}%)"
            else:
                mem_summary = f"{mem_used_mb:.1f} MB (total unknown)"

            self._log(f"{gpu_util:.1f}% | VRAM: {mem_summary}", "TASK-MANAGER", "GPU", "🎮")

            # optional: write back derived values into GLOBAL_MANAGER (best-effort)
            try:
                self.registry.set("GPU_NAME", gpu_name, str)
                self.registry.set("GPU_MEMORY_MB", int(mem_total_mb) if mem_total_mb else 0, int)
                self.registry.set("USE_GPU", True, bool)
            except Exception:
                pass

            # --- GPU Throttling ---
            if gpu_util > gpu_target:
                delay = min((gpu_util - gpu_target) / 200.0, 0.5)
                self._log(f"Limit für '{module_name}' {gpu_target}%", "TASK-MANAGER", "GPU", "🎮")
                self._log(f"Throttle für '{module_name}': usage: {gpu_util:.1f}%, limit: {gpu_target}%", "TASK-MANAGER", "GPU", "🎮")
                self._log(f"Warte {delay:.2f}s", "TASK-MANAGER", "GPU", "🎮")
                time.sleep(delay)

        except Exception as e:
            self._log(f"[{module_name}] Fehler beim Auslesen von ACTIVE_GPU: {e}", "TASK-MANAGER", "WARN")

        self._log(f"Konfiguration erfolgreich für: '{module_name}', CPU: {cpu_target}%, GPU:{gpu_target}%, LOG: {log_level}", "TASK-MANAGER", "TASK", "📆")

    # ---------------------------------------------------------
    # Hilfsmethode: gemeinsames Modul-Handling
    # ---------------------------------------------------------
    def _execute_module(self, module_name, file_path=None, stop_event=None, collect_result=True):
        """
        Führt ein einzelnes Modul aus, inklusive Pre-Actions, Thread-Config,
        Hauptfunktion und Ergebnisbehandlung.
        Wird von run_task() und run_parallel_tasks_until_true() verwendet.
        """
        try:
            if not file_path:
                file_path = self.tasks_dir / f"{module_name}.py"

            module, spec = self._load_module(module_name)
            if spec is None:
                return False

            # --- Pre-Actions ---
            if module_name in self.actions and callable(self.actions[module_name]):
                self.actions[module_name](module_name, file_path)
                if self._log_level >= 1:
                    self._log(f"Aufbereitung für '{module_name}' erfolgreich.", "SYSTEM", "INFO", "🔔")
                    self._log(f"alle Vorbereitungen für: '{module_name}' erfüllt.", "TASK-MANAGER", "TASK", "📆")

            # --- Thread-Konfiguration ---
            self._apply_thread_config(module_name)

            # --- Modul ausführen ---
            if self._log_level >= 1:
                self._log(f"'{module_name}' wird initialisiert.", "TASK-MANAGER", "TASK", "📆")

            spec.loader.exec_module(module)
            result = None
            if hasattr(module, "main") and callable(module.main):
                params = self.params.get(module_name, lambda: {})()

                if self._log_level >= 1:
                    self._log(f"für '{module_name}' gestartet...", "TASK-MANAGER", "THREAD", "⚙️")

                paramsTask = params.get("task_manager")
                if paramsTask:
                    params["task_manager"] = self

                if params:
                    result = module.main(**params)
                else:
                    result = module.main()

            # --- Optional: Wartefunktion ---
            if hasattr(module, "wait_for_completion") and callable(module.wait_for_completion):
                module.wait_for_completion()
                if self._log_level >= 1:
                    self._log(f"{module_name}' meldet Ergebnisse...", "SYSTEM", "INFO", "🔔")
                    self._log(f"Aufgabe erfüllt.", "TASK-MANAGER", "THREAD", "⚙️")

            # --- Ergebnisbehandlung ---
            if result is True:
                self._log(f"{module_name}' meldet Ergebnis...", "SYSTEM", "INFO", "🔔")
                self._log(f"Aufgabe erfüllt.", "TASK-MANAGER", "THREAD", "⚙️")
                if stop_event:
                    stop_event.set()
            elif isinstance(result, tuple) and result and result[0] is True:
                self._log(f"{module_name}' meldet Ergebnisse...", "SYSTEM", "INFO", "🔔")
                self._log(f"Aufgabe erfüllt.", "TASK-MANAGER", "THREAD", "⚙️")
                if stop_event:
                    stop_event.set()

            # --- Globale Registrierung ---
            self.registry.set(f"{module_name}_completed", True, bool)

            # --- Rückgabe-Handling ---
            ret = getattr(module, "GLOBAL_RETURN", None)
            if ret is None and isinstance(result, dict):
                ret = result

            if isinstance(ret, dict) and all(isinstance(v, dict) and "value" in v and "type" in v for v in ret.values()):
                if self._log_level >= 1:
                    dataCount = len(ret.items())
                    self._log(f"{dataCount} Schlüssel registriert", "SYSTEM", "REGISTERY", "🔒")
                for key, val in ret.items():
                    self.registry.set(key, val["value"], val["type"])
                    if self._development and self._log_level == 3:
                        self._log(f"{key}: {val['value']}", "SYSTEM", "KEY", "🗝️")

                if self._log_level >= 1:
                    self._log(f"Es wurden {dataCount} Datensätze aktualisiert...", "SYSTEM", "INFO", "🔔")
                    self._log(f"Modul '{module_name}' abgeschlossen.", "TASK-MANAGER", "TASK", "📆")
            else:
                if self._log_level >= 1:
                    self._log(f"Modul '{module_name}' abgeschlossen.", "TASK-MANAGER", "TASK", "📆")

            return result if collect_result else True

        except Exception as e:
            self.registry.set(f"{module_name}_completed", False, bool)
            self._log(f"Fehler in Modul '{module_name}': {e}", "TASK-MANAGER", "ERROR")
            return False

    # -------------------------------------------------------------
    # Einzelner Task
    # -------------------------------------------------------------
    def run_task(self, module_identifier):
        """
        Startet ein einzelnes Modul (nicht parallel).
        """
        module_name = module_identifier.stem if isinstance(module_identifier, Path) else module_identifier
        file_path = module_identifier if isinstance(module_identifier, Path) else self.tasks_dir / f"{module_name}.py"

        if not file_path.exists():
            self._log(f"Datei für Modul '{module_name}' nicht gefunden ({file_path})", "TASK-MANAGER", "WARN")
            return

        return self._execute_module(module_name, file_path)

    # -------------------------------------------------------------
    # Parallele Module: Stoppe, sobald ein Modul True liefert
    # -------------------------------------------------------------
    def run_parallel_tasks_until_true(self, module_names, timeout=None, time_clamp=None):
        """
        Startet mehrere Module parallel. Stoppt, wenn eines True zurückgibt.
        """
        if not module_names:
            self._log("Keine Module für parallele Ausführung angegeben.", "TASK-MANAGER", "WARN")
            return False, None, None

        stop_event = threading.Event()
        results = {}
        threads = {}

        # --- Timeout-Berechnung ---
        if isinstance(timeout, (int, float)):
            if time_clamp is None and hasattr(self, "registry"):
                try:
                    os_threads = self.registry.get("OS_THREADS")
                    os_memory = self.registry.get("OS_MEMORY")
                    base_timeout = float(timeout)
                    thread_factor = max(1.0, 8 / float(os_threads))
                    mem_factor = max(1.0, 8 / float(os_memory))
                    timeout = round(base_timeout * thread_factor * mem_factor, 1)
                    self._log(
                        f"Geschätzte Bearbeitungszeit: {timeout:.1f}s | (CORE={os_threads}, RAM={os_memory:.1f}GB)",
                        "TASK-MANAGER", "TIMEOUT", "📆"
                    )
                except Exception as e:
                    self._log(f"Timeout konnte nicht berechnen: {e}", "TASK-MANAGER", "WARN", "⚠️")
            elif isinstance(time_clamp, (tuple, list)) and len(time_clamp) == 2:
                timeout = min(max(timeout, time_clamp[0]), time_clamp[1])
                self._log(f"Timeout mit Clamp gesetzt: {timeout:.1f}s (Range {time_clamp})", "TASK-MANAGER", "TIMEOUT", "🕒")
        else:
            self._log("Timeout nicht angegeben – warte unbegrenzt!", "TASK-MANAGER", "TIMEOUT", "♾️")

        # --- Threads starten ---
        def thread_target(name):
            results[name] = self._execute_module(name, stop_event=stop_event)

        for name in module_names:
            t = threading.Thread(target=thread_target, args=(name,), daemon=True)
            threads[name] = t
            t.start()
            self._running_threads[name] = t

        # --- Warten ---
        start = time.time()
        if isinstance(timeout, (int, float)):
            while time.time() - start < timeout:
                if stop_event.is_set():
                    break
                time.sleep(0.05)
        else:
            while not stop_event.is_set():
                if all(not t.is_alive() for t in threads.values()):
                    self._log("Alle Threads beendet, ohne Ergebnis!", "TASK-MANAGER", "TIMEOUT", "⚠️")
                    break
                time.sleep(0.1)

        # --- Threads beenden ---
        for name, thread in threads.items():
            self.terminate_task(module_name=name)

        # --- Gewinner ermitteln ---
        winner = None
        value = None
        for name, res in results.items():
            if res is True or (isinstance(res, tuple) and res and res[0] is True):
                winner = name
                value = res
                break

        return (True if winner else False, winner, value)


    # -------------------------------------------------------------
    # Scheduling / Looping
    # -------------------------------------------------------------
    def schedule_task(self, module_name, delay_seconds):
        def _task():
            time.sleep(delay_seconds)
            time.sleep(delay_seconds)
            self.run_task(module_name)

        t = threading.Thread(target=_task, daemon=True)
        t.start()
        self._scheduled_tasks.append((module_name, t))
        if self._log_level >= 1:
            self._log(f"Task '{module_name}' in {delay_seconds}s geplant.", "TASK-MANAGER", "SCHEDULED")

    def loop_task(self, module_name, interval_seconds):
        def _loop():
            while not self.registry.get(f"{module_name}_terminate", bool, False):
                self.run_task(module_name)
                time.sleep(interval_seconds)

            if self._log_level >= 1:
                self._log(f"Loop-Task '{module_name}' beendet.", "TASK-MANAGER", "TERMINATED")

        t = threading.Thread(target=_loop, daemon=True)
        t.start()
        self._running_threads[module_name] = t

        if self._log_level >= 1:
            self._log(f"Task '{module_name}' läuft alle {interval_seconds}s im Loop.", "TASK-MANAGER", "LOOP")


    def terminate_task(self, module_name: str):
        """
        Markiert einen Task als 'zu beenden' und wartet bis zu 3x darauf,
        dass der zugehörige Thread stoppt. Falls er danach noch lebt,
        wird ein Versuch unternommen, ihn zwangsweise zu beenden.

        ⚠️ Hinweis:
            - Python erlaubt keinen garantierten "Kill" eines Threads.
            - Der Zwangs-Abbruch nutzt ctypes → nur als letzter Ausweg!
            - Empfohlen: Module sollten selbst regelmäßig das Termination-Flag prüfen.
        """
        thread = self._running_threads.get(module_name)
        if not thread:
            self._log(f"Kein laufender Task '{module_name}' gefunden.", "TASK-MANAGER", "INFO", "💡")
            return False

        # --- Termination-Flag setzen ---
        self.registry.set(f"{module_name}_terminate", True, bool)
        self._log(f"Task '{module_name}' zur Terminierung markiert.", "TASK-MANAGER", "TERMINATE", "📍")

        # --- Bis zu 3 Versuche, ob Thread sich selbst beendet ---
        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            time_limit = 5  # Sekunden pro Versuch
            start = time.time()
            while thread.is_alive() and time.time() - start < time_limit:
                time.sleep(0.1)

            if not thread.is_alive():
                self._log(f"Task '{module_name}' beendet (Versuch {attempt}/{max_attempts}).", "TASK-MANAGER", "INFO", "🏴")
                del self._running_threads[module_name]
                return True
            else:
                self._log(f"⏳ Task '{module_name}' läuft noch (Versuch {attempt}/{max_attempts}).", "TASK-MANAGER", "WARN", "🏳️")

        # --- Nach 3 Versuchen immer noch aktiv → Zwangsterminierung versuchen ---
        if thread.is_alive():
            self._log(f"Task '{module_name}' reagiert nicht – versuche Zwangsterminierung...", "TASK-MANAGER", "ERROR", "🚩")

            try:
                # Versuch, den Thread via ctypes zu beenden
                res = ctypes.pythonapi.PyThreadState_SetAsyncExc(
                    ctypes.c_long(thread.ident),
                    ctypes.py_object(SystemExit)
                )
                if res == 1:
                    self._log(f"Task '{module_name}' wurde zwangsweise beendet.", "TASK-MANAGER", "KILL", "💀")
                    del self._running_threads[module_name]
                    return True
                elif res > 1:
                    # Rückgängig machen, falls mehrere Threads betroffen waren
                    ctypes.pythonapi.PyThreadState_SetAsyncExc(ctypes.c_long(thread.ident), None)
                    self._log(f"❌ Thread-Fehler: Mehrere Ziele bei Zwangsterminierung ({res}).", "TASK-MANAGER", "ERROR")
                else:
                    self._log(f"❌ Konnte Thread '{module_name}' nicht zwangsweise beenden.", "TASK-MANAGER", "ERROR")

            except Exception as e:
                self._log(f"❌ Ausnahme bei Zwangsterminierung: {e}", "TASK-MANAGER", "ERROR")

            return False
