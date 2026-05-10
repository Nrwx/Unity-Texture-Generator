import shutil
import os
import json
from pathlib import Path
from typing import Callable, Dict, Any, List, Optional, Union
import threading
from datetime import datetime

LOG_TYPE = Callable[[str, str, str, Optional[str]], None]
REGISTRY_TYPE = Any  # flexible; erwartet .get/.set API


class Config:
    """
    Thread-safe Singleton Config-Klasse.
    Wenn sie erneut initialisiert wird, werden nur die Werte aktualisiert,
    die neu übergeben werden, ohne die Instanz zu ersetzen.
    """

    _instance = None
    _instance_lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(
        self,
        log: LOG_TYPE = None,
        registry: REGISTRY_TYPE = None,
        syslink: REGISTRY_TYPE = None,
        config_dict: Optional[Dict[str, Any]] = None,
        base_dir: Optional[Union[str, Path]] = None
    ):
        # Thread-safe Lock für Instanzmethoden
        if not hasattr(self, "_lock"):
            self._lock = threading.RLock()

        with self._lock:
            # Nur einmalige Initialisierung der Basisobjekte
            if not getattr(self, "_initialized", False):
                self.log: LOG_TYPE = log
                self.registry: REGISTRY_TYPE = registry
                self._raw_config: Dict[str, Any] = config_dict or {}
                self.base_dir = base_dir
                self.syslink = syslink
                self.boot_sequence: List[str] = [
                    "sudo", "system", "project", "path", "driver", "gpu", "plugin", "measure", "storage"
                ]
                self._secure_cache: Optional[Dict[str, Any]] = None

                self._initialized = True
            else:
                # Wenn die Instanz schon existiert, nur Werte updaten
                if log is not None:
                    self.log = log
                if registry is not None:
                    self.registry = registry
                if syslink is not None:
                    self.syslink = syslink
                if config_dict:
                    self._raw_config.update(config_dict)
                    self._secure_cache = None  # Cache zurücksetzen
                if base_dir is not None:
                    self.base_dir = base_dir


    # -----------------------
    # Accessors
    # -----------------------
    @property
    def data(self) -> Dict[str, Any]:
        """Gibt das aktuell geladene dependencies-Objekt (in-memory) zurück."""
        return self._raw_config.get("dependencies", {})

    def get_library_policy(self) -> Dict[str, Any]:
        """Liest library_policy aus dependencies.config.library_policy (sicher)."""
        return (
            self._raw_config
            .get("dependencies", {})
            .get("config", {})
            .get("library_policy", {})
        )

    def get_plugin_path(self) -> Optional[str]:
        """Liest plugin_path aus der externen Config."""
        raw = self._raw_config or {}
        plugin_path = raw.get("plugin_path")

        if not plugin_path:
            return None

        return os.path.abspath(os.path.expanduser(plugin_path))


    def get_project_name(self) -> str:
        raw = self._raw_config or {}
        return raw.get("project_name") or "app"

    # -------------------------------------------------------------
    # Pre-Actions
    # -------------------------------------------------------------
    @property
    def boot_actions(self) -> Dict[str, Callable[[str, Path], Optional[Any]]]:
        return {
            "sudo": lambda name, path: (
                (lambda globals_to_set: (
                    (lambda total_var: (
                        [self.registry.set(var_name, default, var_type) for var_name, default, var_type in globals_to_set]
                    ))(self.log(f"Schlüssel registriert: 2 Stk.", "SYSTEM", "REGISTERY", "🔒️"))
                )
                )([
                    ("TASK_MANAGER", None, object),
                    ("ACTIVE_GPU", None, object)
                ])
            ),
            "path": lambda name, path: shutil.rmtree("generated") if Path("generated").exists() else None,
            "driver": lambda name, path: shutil.rmtree("__DRIVER") if Path("__DRIVER").exists() else None,
        }

    # -------------------------------------------------------------
    # Modul-Parameter
    # -------------------------------------------------------------
    @property
    def boot_params(self) -> Dict[str, Callable[[], Dict[str, Any]]]:
        return {
            "sudo": lambda: {"development": True, "log_level": 3},
            "system": lambda: {
                "development": self.registry.get("DEVELOPMENT"),
                "log_level": self.registry.get("LOG_LEVEL")
            },
            "path": lambda: {"backend_path": self.registry.get("BACKEND_PATH"), "log": self.log},
            "driver": lambda: {
                "os_type": self.registry.get("OS_TYPE"),
                "os_arch": self.registry.get("OS_ARCH"),
                "log": self.log
            },
            "gpu": lambda: {
                "os_type": self.registry.get("OS_TYPE"),
                "ms_build_tools": self.registry.get("MS_BUILD_TOOLS"),
                "log": self.log,
                "task_manager": True
            },
            "plugin": lambda: {
                "backend_path": self.registry.get("BACKEND_PATH"),
                "plugin_path": self.get_plugin_path(),
                "project_name": self.get_project_name()
            },
            "measure": lambda: {
                "os_type": self.registry.get("OS_TYPE"),
                "os_arch": self.registry.get("OS_ARCH"),
                "os_cpu": self.registry.get("OS_CPU"),
                "os_threads": self.registry.get("OS_THREADS"),
                "os_memory": self.registry.get("OS_MEMORY"),
                "gpu_name": self.registry.get("GPU_NAME"),
                "gpu_memory_mb": self.registry.get("GPU_MEMORY_MB"),
                "development": self.registry.get("DEVELOPMENT"),
                "log_level": self.registry.get("LOG_LEVEL"),
            },
            "storage": lambda: {
                "path": self.registry.get("BACKEND_PATH"),
                "development": self.registry.get("DEVELOPMENT"),
                "log_level": self.registry.get("LOG_LEVEL"),
            },
            "dxdiag": lambda: {
                "log": self.log
            },
            "intel_linux": lambda: {
                "log": self.log
            },
            "intel_windows": lambda: {
                "log": self.log
            },
            "nvidia_smi": lambda: {
                "log": self.log
            },
            "pycuda": lambda: {
                "log": self.log
            },
            "pytorch": lambda: {
                "log": self.log
            }
        }

    # -------------------------------------------------------------
    # Thread/Resource Config
    # -------------------------------------------------------------
    @property
    def boot_threads(self) -> Dict[str, Callable[[], Dict[str, Union[int, bool, str]]]]:
        return {
            "sudo": lambda: {"cpu": 5, "gpu": 0, "priority": 10, "terminate": False},
            "system": lambda: {"cpu": 5, "gpu": 0, "priority": 10, "terminate": False},
            "project": lambda: {"cpu": 10, "gpu": 0, "priority": 15, "terminate": False},
            "path": lambda: {"cpu": 5, "gpu": 0, "priority": 10, "terminate": False},
            "driver": lambda: {"cpu": 10, "gpu": 0, "priority": 20, "terminate": False},
            "gpu": lambda: {"cpu": 5, "gpu": 90, "gpu_only": True, "priority": 100, "terminate": True, "terminate_id": "gpu_priority_group"},
            "measure": lambda: {"cpu": 40, "gpu": 0, "cpu_only": True, "priority": 50, "terminate": False},
            "storage": lambda: {"cpu": 70, "gpu": 30, "dual": True, "priority": 80, "terminate": True, "terminate_id": "storage_group"},
        }

    # -------------------------------------------------------------
    # Methode zum direkten Export für Boot
    # -------------------------------------------------------------
    def create_boot_config(self) -> Dict[str, Any]:
        """
        Liefert exakt die vier Keys, die der Boot-Loader benötigt:
        boot_sequence, boot_actions, boot_params, boot_threads
        """
        return {
            "boot_sequence": self.boot_sequence,
            "boot_actions": self.boot_actions,
            "boot_params": self.boot_params,
            "boot_threads": self.boot_threads
        }

    # -------------------------------------------------------------
    # Secure settings extraction (inlined, no dataclass)
    # -------------------------------------------------------------
    def get_secure_settings(self) -> Dict[str, Any]:
        """
        Liest die 'secure' Sektion aus dem übergebenen raw config (build.json).
        Gibt ein dict mit validierten Defaults zurück:
          {
            "service_name": str,
            "account_name": str,
            "use_keyring": bool,
            "storage_path": str,
            "key_path": str
          }
        Zusätzlich wird die Anzahl existierender Schlüssel geloggt.
        Caching: Ergebnis wird zwischengespeichert; bei Bedarf reload_secure_settings() aufrufen.
        """
        if self._secure_cache is not None:
            return self._secure_cache

        raw_secure: Dict[str, Any] = {}
        try:
            raw_secure = (self._raw_config or {}).get("secure", {}) or {}
        except Exception:
            raw_secure = {}

        project_name = (self._raw_config or {}).get("project_name") or "app"

        # Basiswerte
        service_name = raw_secure.get("service_name") or project_name
        account_name = raw_secure.get("account_name") or os.getenv("USER") or os.getenv("USERNAME") or "default"
        use_keyring = bool(raw_secure.get("use_keyring", False))

        # Pfade aus config (können leer/omitted sein)
        storage_path_cfg = raw_secure.get("storage_path")
        key_path_cfg = raw_secure.get("key_path")

        storage_path: Optional[str] = storage_path_cfg if storage_path_cfg else None
        key_path: Optional[str] = key_path_cfg if key_path_cfg else None

        # Fallbacks wenn noch None
        if not storage_path:
            home = Path.home()
            storage_path = str(home / f". {project_name}" / "secure_store.json")
            self.log(f"Secure: fallback storage_path used: {storage_path}", "SECURE", "WARN", "⚠️")
        if not key_path:
            home = Path.home()
            key_path = str(home / f". {project_name}" / ".secure_key")
            self.log(f"Secure: fallback key_path used: {key_path}", "SECURE", "WARN", "⚠️")

        # Ergebnis zwischenspeichern und zurückgeben
        result = {
            "project_name": service_name,
            "service_name": service_name,
            "account_name": account_name,
            "use_keyring": use_keyring,
            "storage_path": storage_path,
            "key_path": key_path
        }
        self._secure_cache = result
        self.log("Konfigurations-Datei 'build.json' validiert…", "SECURE", "INFO", "🛡️")
        return result

    # -------------------------------------------------------------
    # Sicheres Schreiben der Secure-Einstellungen in build.json
    # -------------------------------------------------------------
    def write_secure_config(
        self,
        base_dir: Optional[Union[str, Path]] = None,
        values: Optional[Dict[str, Any]] = None
    ) -> str:
        base_path = Path(base_dir or self.base_dir)
        config_path = base_path / "build.json"

        existing_data: Dict[str, Any] = {}
        if config_path.exists():
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    existing_data = json.load(f)
            except Exception as e:
                self.log(f"write_secure_config: konnte bestehende build.json nicht laden: {e}", "CONFIG", "WARN", "⚠️")

        secure_data = self.get_secure_settings()
        if values:
            secure_data.update(values)
        existing_data["secure"] = {**existing_data.get("secure", {}), **secure_data}

        try:
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(existing_data, f, indent=2, ensure_ascii=False)
            self.log(f"Secure-Config aktualisiert: {config_path}", "SECURE", "INFO", "🔒")
        except Exception as e:
            self.log(f"Fehler beim Schreiben: {e}", "SECURE", "ERROR", "📛")
            raise


        self._secure_cache = secure_data
        return str(config_path)

    def reload_secure_settings(self) -> Dict[str, Any]:
        """
        Erzwingt Neulesen der secure Einstellungen (z.B. nach Runtime-Config-Änderung).
        """
        self._secure_cache = None
        return self.get_secure_settings()


    # -----------------------------
    # Disk Operations
    # -----------------------------
    def reload_from_disk(self) -> Dict[str, Any]:
        """
        Force reload of build.json from disk into memory.
        Returns parsed JSON or {} if missing/invalid.
        """
        config_path = self.base_dir / "build.json"
        if not config_path.exists():
            self.log(f"Konfigurations-Datei 'build.json' nicht gefunden!", "CONFIG", "WARN", "⚠️")
            return {}

        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self._raw_config = data
                self.log("Konfigurations-Datei 'build.json' erfolgreich gelesen… ", "CONFIG", "INFO", "🔎")
                return data
        except Exception as e:
            self.log(f"Konfigurations-Datei 'build.json' meldet fehler: ({e})", "CONFIG", "ERROR", "📛")
            return {}

    def write_layer_management(self, layer_obj: Dict[str, Any]) -> str:
        """
        Merge a new dependencies/libraries structure into the existing build.json,
        preserving all unrelated data and previous dependency keys.
        """
        with self._lock:
            build_path = self.base_dir / "build.json"
            tmp_path = build_path.with_suffix(".tmp")

            # Load current build.json
            existing = {}
            if build_path.exists():
                try:
                    with open(build_path, "r", encoding="utf-8") as f:
                        existing = json.load(f)
                except Exception as e:
                    self.log(f"Fehler beim Lesen der Konfigurtions-Dtei: ({e})", "CONFIG", "WARN", "⚠️")
            merged = existing.copy()

            # --- smart merge for dependencies
            if "dependencies" not in merged:
                merged["dependencies"] = {}

            deps_existing = merged["dependencies"]

            # merge all keys from new layer_obj
            for key, val in layer_obj.items():
                if key == "dependencies":
                    # layer_obj["dependencies"] kann eigene Subkeys haben
                    for subk, subv in val.items():
                        if isinstance(subv, dict) and isinstance(deps_existing.get(subk), dict):
                            deps_existing[subk].update(subv)
                        else:
                            deps_existing[subk] = subv
                else:
                    merged[key] = val

            # update timestamp
            deps_existing["last_build"] = datetime.utcnow().isoformat() + "Z"
            merged["dependencies"] = deps_existing

            # --- write safely
            try:
                tmp_path.parent.mkdir(parents=True, exist_ok=True)
                with open(tmp_path, "w", encoding="utf-8") as f:
                    json.dump(merged, f, indent=2, ensure_ascii=False)
                os.replace(str(tmp_path), str(build_path))
                self._raw_config = merged
                self.log(f"Konfigurations-Datei wurde erfolgreich aktualisiert", "CONFIG", "INFO", "💾")
                return str(build_path)
            except Exception as e:
                if tmp_path.exists():
                    tmp_path.unlink(missing_ok=True)
                self.log(f"Fehler beim schreiben der Konfigurations-Datei: ({e})", "CONFIG", "ERROR", "📛")
                raise

    def write_libraries(self, libs: Dict[str, Any]) -> str:
        """
        Write only dependencies.libraries section.
        Used by LibraryManager when persisting updates.
        """
        with self._lock:
            deps = self._raw_config.get("dependencies", {})
            deps["libraries"] = libs
            deps["last_build"] = datetime.utcnow().isoformat() + "Z"
            self._raw_config["dependencies"] = deps

            path = self.base_dir / "build.json"
            tmp = path.with_suffix(".tmp")

            try:
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump(self._raw_config, f, indent=2, ensure_ascii=False)
                os.replace(str(tmp), str(path))
                self.log(f"Es wurden ({len(libs)} Pakete aktualisiert!", "CONFIG", "INFO", "💾")
                return str(path)
            except Exception as e:
                if tmp.exists():
                    tmp.unlink(missing_ok=True)
                self.log(f"Fehler beim aktualisieren der Pakete: {e}", "CONFIG", "ERROR", "📛")
                raise