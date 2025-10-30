import json
import os
import threading
from typing import Optional, Dict, Callable, Any
from cryptography.fernet import Fernet, InvalidToken


class Treasure:
    """
    Thread-safe Treasure-Manager mit Singleton-artigem Lock.
    Verwaltet verschlüsselte Tokens im JSON-Storage.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(
        self,
        project_name: str = "app",
        service_name: Optional[str] = None,
        account_name: Optional[str] = None,
        storage_path: Optional[str] = None,
        key: Any = None,
        key_path: Optional[str] = None,
        use_keyring: bool = False,
        log: Any = None
    ):
        if getattr(self, "_initialized", False):
            # Bereits initialisiert: nur neue Werte updaten
            if project_name:
                self.project_name = project_name
            if service_name:
                self.service_name = service_name
            if account_name:
                self.account_name = account_name
            if storage_path:
                self.storage_path = storage_path
            if key_path:
                self.key_path = key_path
            if key:
                self.key = key
            if log:
                self.log = log
            if use_keyring is not None:
                self.use_keyring = use_keyring
            return

        self.project_name = project_name or "app"
        self.service_name = service_name or self.project_name
        self.account_name = account_name or os.getenv("USER") or os.getenv("USERNAME") or "default"
        self.storage_path = storage_path or ""
        self.key_path = key_path or ""
        self.use_keyring = bool(use_keyring)
        self.key = key
        self.log = log

        self._lock = threading.RLock()

        # Storage sicherstellen
        d = os.path.dirname(self.storage_path)
        if d and not os.path.exists(d):
            os.makedirs(d, exist_ok=True)

        # Key laden oder erzeugen
        key_bytes = self.key.load(
            self.service_name,
            self.account_name,
            key_path=self.key_path,
            create=True,
            use_keyring=self.use_keyring
        )
        self._fernet = Fernet(key_bytes)

        # Daten laden
        self._data: Dict[str, str] = {}
        self._load_storage()

        self._initialized = True

    # ---------- interne Helpers ----------
    def _load_storage(self):
        try:
            if os.path.exists(self.storage_path):
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    self._data = json.load(f)
            else:
                self._data = {}
        except Exception as e:
            self.log("Treasure: load storage failed: %s", e)
            self._data = {}

    def _save_storage(self):
        try:
            tmp = f"{self.storage_path}.tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2)
            os.replace(tmp, self.storage_path)
        except Exception as e:
            self.log(f"Das speichern der Registry ist fehlgeschlagen: {e}", "TREASURE", "ERROR", "📛")
            raise

    # ---------- öffentliche API ----------
    def set(self, key: str, value: str) -> None:
        if not isinstance(value, str):
            raise TypeError("Treasure.set expects a string value.")
        token = self._fernet.encrypt(value.encode("utf-8")).decode("utf-8")
        with self._lock:
            self._load_storage()
            self._data[key] = token
            self._save_storage()
        #self.log(f"erfolgreich generiert: {key}", "TREASURE", "TOKEN", "🛡️")
        self.log("erfolgreich generiert...", "TREASURE", "TOKEN", "🛡️")

    def get(self, key: str) -> Optional[str]:
        with self._lock:
            self._load_storage()
            token = self._data.get(key)
        if not token:
            return None
        try:
            return self._fernet.decrypt(token.encode("utf-8")).decode("utf-8")
        except InvalidToken:
            self.log(f":validierung fehlgeschlagen {key}", "TREASURE", "AUTH", "⚠️")
            return None

    def exists(self, key: str) -> bool:
        with self._lock:
            self._load_storage()
            return key in self._data

    def delete(self, key: str) -> None:
        with self._lock:
            self._load_storage()
            if key in self._data:
                self._data.pop(key)
                self._save_storage()

    def list(self) -> Dict[str, str]:
        with self._lock:
            self._load_storage()
            return dict(self._data)
