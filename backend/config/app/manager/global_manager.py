import threading

class GlobalManager:
    _instance = None
    _lock = threading.Lock()  # Thread-safe Singleton-Lock

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        # Verhindert mehrfaches Initialisieren
        if self._initialized:
            return
        self._registry = {}
        self._registry_lock = threading.RLock()  # Thread-safety für Registry
        self._initialized = True

    def set(self, key: str, value, expected_type: type):
        """
        Setzt einen Wert in die Registry. None ist als Platzhalter erlaubt,
        echte Werte werden typgeprüft.
        """
        if value is not None and not isinstance(value, expected_type):
            raise TypeError(
                f"TypeError: Key '{key}' erwartet Typ {expected_type.__name__}, "
                f"bekam aber {type(value).__name__}"
            )
        with self._registry_lock:
            self._registry[key] = {"value": value, "type": expected_type}

    def get(self, key: str):
        """
        Gibt den Wert eines Keys zurück.
        """
        with self._registry_lock:
            if key not in self._registry:
                raise KeyError(f"Key '{key}' nicht gefunden.")
            return self._registry[key]["value"]

    def exists(self, key: str) -> bool:
        """
        Prüft, ob ein Key existiert.
        """
        with self._registry_lock:
            return key in self._registry

    def remove(self, key: str):
        """
        Entfernt einen Key aus der Registry.
        """
        with self._registry_lock:
            self._registry.pop(key, None)

    def list_all(self):
        """
        Listet alle Keys und deren Typen auf.
        """
        with self._registry_lock:
            return {k: v["type"].__name__ for k, v in self._registry.items()}
