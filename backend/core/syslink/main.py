import threading
import inspect
from typing import Any, get_origin, get_args, Optional, Union
from collections.abc import Callable as CollCallable

class SystemLink:
    """
    Thread-sicherer Singleton-Manager.
    API: link(key, value, expected_type)
      - expected_type kann z.B.:
          * a concrete class (str, int, MyClass)
          * object (akzeptiert jede Instanz)
          * type (erwartet eine Klasse selbst, nicht Instanz)
          * typing.Callable[[...], Ret] (oder Optional[...] / Union[...])
    Best-effort Prüfung: Callable -> prüft callable(...) + optional Signatur-Länge.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(self, log=None):
        if getattr(self, "_initialized", False):
            return
        self._registry = {}
        self._registry_lock = threading.RLock()
        # log should be tolerant: log(msg, source?, category?, icon?, level?) or simple callable
        self.log = log or (lambda *a, **k: None)
        self._initialized = True

    # -------------------------
    # Hilfsprüfungen
    # -------------------------
    def _is_callable_generic(self, tp: Any) -> bool:
        origin = get_origin(tp)
        return origin is CollCallable or tp is CollCallable

    def _match_type(self, value: Any, expected_type: Any) -> bool:
        """
        Best-effort Typprüfung:
         - Union/Optional: true, wenn irgendein member passt
         - Callable[...]   : prüfe callable(...) und optional Param-Anzahl
         - expected_type is type : prüfe isinstance(value, type)
         - expected_type is object: akzeptiere alles außer None (konfigurierbar)
         - sonst: isinstance(value, expected_type) mit Schutz gegen TypeError
        """
        # None handling
        if value is None:
            # Accept None only if expected_type explicitly allows it (Optional[...] / Union[..., None])
            origin = get_origin(expected_type)
            if origin is Union:
                args = get_args(expected_type)
                if type(None) in args:
                    return True
            # If expected_type is object or Any, optionally accept None? we disallow by default
            return False

        origin = get_origin(expected_type)

        # Union / Optional
        if origin is Union:
            for arg in get_args(expected_type):
                if arg is type(None):
                    if value is None:
                        return True
                    continue
                if self._match_type(value, arg):
                    return True
            return False

        # Callable[...] (typing.Callable)
        if self._is_callable_generic(expected_type):
            if not callable(value):
                return False
            # optional: verify positional parameter count (best-effort)
            try:
                args_ret = get_args(expected_type)
                if args_ret:
                    arg_spec = args_ret[0]
                    if arg_spec is Ellipsis:
                        return True
                    if isinstance(arg_spec, (list, tuple)):
                        sig = inspect.signature(value)
                        params = [
                            p for p in sig.parameters.values()
                            if p.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)
                        ]
                        expected_len = len(arg_spec)
                        # allow bound methods heuristics:
                        if len(params) < expected_len:
                            # if bound method, first parameter (self) may be omitted; check tolerance
                            if len(params) + 1 < expected_len:
                                return False
                return True
            except Exception:
                return True  # fallback

        # expected_type is 'type' meaning we expect *a class* object (not an instance)
        if expected_type is type:
            return isinstance(value, type)

        # expected_type is 'object' (accept any non-None)
        if expected_type is object:
            return True

        # Fallback: normal isinstance check (guarded)
        try:
            return isinstance(value, expected_type)
        except TypeError:
            # expected_type might be a subscripted generic not handled above
            return False

    # -------------------------
    # Registrierung
    # -------------------------
    def register_core(self, key: str, expected_type: Any = object):
        with self._registry_lock:
            if key in self._registry:
                raise KeyError(f"Core-Key '{key}' existiert bereits.")
            self._registry[key] = {"value": None, "type": expected_type}
            self.log(f"Core-Key '{key}' registriert.", "SYSTEM", "LINK", "🔗")

    # -------------------------
    # Haupt-API: link
    # -------------------------
    def link(self, key: str, value: Any, expected_type: Any = object):
        """
        Link(key, value, expected_type)
        - Validiert value gegen expected_type (siehe _match_type)
        - Registriert key falls nicht vorhanden
        - Sorgt für thread-safe Wrapping bei Instanzen (nicht bei Funktionen)
        """
        # none handling: only allow if expected_type explicitly allows None
        if value is None:
            origin = get_origin(expected_type)
            if origin is Union and type(None) in get_args(expected_type):
                # allowed
                pass
            elif expected_type in (object, Any):
                pass
            else:
                raise TypeError(f"'{key}' erwartet {expected_type} (None nicht erlaubt)")

        # validate type
        if value is not None and not self._match_type(value, expected_type):
            raise TypeError(f"'{key}' erwartet Typ {expected_type}, bekam {type(value)}")

        # ensure registry entry
        with self._registry_lock:
            if key not in self._registry:
                self._registry[key] = {"value": None, "type": expected_type}
            else:
                # update type to the explicit provided expected_type
                self._registry[key]["type"] = expected_type

        # if it's a class (type), store class as-is (instances will be wrapped on instantiation)
        is_class_type = isinstance(value, type)
        if is_class_type:
            stored_value = value
        elif value is not None and not callable(value):
            stored_value = self._ensure_thread_safe(value, key)
        else:
            stored_value = value

        with self._registry_lock:
            self._registry[key]["value"] = stored_value

        self.log(f"'{key}' erfolgreich verknüpft.", "SYSTEM", "LINK", "🔗")

    # -------------------------
    # unlink / remove / get
    # -------------------------
    def unlink(self, key: str):
        with self._registry_lock:
            if key in self._registry:
                self._registry[key]["value"] = None
                self.log(f"'{key}' erfolgreich getrennt.", "SYSTEM", "LINK", "🔗")

    def remove(self, key: str):
        with self._registry_lock:
            if key in self._registry:
                self._registry.pop(key, None)
                self.log(f"'{key}' entfernt.", "SYSTEM", "LINK", "🔗")

    def get(self, key: str) -> Any:
        with self._registry_lock:
            if key not in self._registry:
                raise KeyError(f"Core-Key '{key}' nicht gefunden.")
            return self._registry[key]["value"]

    # -------------------------
    # Thread-safety wrapping
    # -------------------------
    def _ensure_thread_safe(self, obj: Any, key: str):
        if obj is None:
            return None

        if hasattr(obj, "_lock") and isinstance(getattr(obj, "_lock"), (threading.Lock, threading.RLock)):
            self.log(f"'{key}' ist bereits thread-safe.", "SYSTEM", "LINK", "🔒")
            return obj

        self.log(f"'{key}' wird automatisch thread-sicher gemacht.", "SYSTEM", "LINK", "🛡️")
        lock = threading.RLock()
        try:
            setattr(obj, "_lock", lock)
        except Exception:
            return obj  # cannot set attributes on some builtins

        for attr_name in dir(obj):
            if attr_name.startswith("_"):
                continue
            try:
                attr = getattr(obj, attr_name)
            except Exception:
                continue
            if callable(attr):
                wrapped = self._lock_wrapper(attr, lock)
                try:
                    setattr(obj, attr_name, wrapped)
                except Exception:
                    pass

        return obj

    def _lock_wrapper(self, func: Any, lock: threading.RLock):
        def safe_method(*args, **kwargs):
            with lock:
                return func(*args, **kwargs)
        try:
            safe_method.__name__ = getattr(func, "__name__", safe_method.__name__)
            safe_method.__doc__ = getattr(func, "__doc__", safe_method.__doc__)
        except Exception:
            pass
        return safe_method

    # -------------------------
    # execute / diagnostics
    # -------------------------
    def execute(self, key: str, *args, **kwargs) -> Any:
        target = self.get(key)
        if target is None:
            raise RuntimeError(f"Core-Link '{key}' ist nicht verknüpft.")

        # class -> instantiate and wrap instance
        if isinstance(target, type):
            self.log(f"Instanziere Klasse '{key}'.", "SYSTEM", "LINK", "🔗")
            instance = target(*args, **kwargs)
            instance = self._ensure_thread_safe(instance, key)
            return instance

        # callable function or callable object
        if callable(target):
            self.log(f"Führe Callable '{key}' aus.", "SYSTEM", "LINK", "🔗")
            return target(*args, **kwargs)

        # fallback: object with __call__
        if hasattr(target, "__call__"):
            self.log(f"Rufe Instanz '{key}' auf.", "SYSTEM", "LINK", "🔗")
            return target(*args, **kwargs)

        raise TypeError(f"'{key}' ist weder callable, noch Klasse, noch call-fähiges Objekt.")

    def list_links(self):
        with self._registry_lock:
            links = {
                key: (f"✅ linked ({type(v['value']).__name__})" if v["value"] else "❌ unlinked")
                for key, v in self._registry.items()
            }
        self.log("Link-Status abgerufen.", "SYSTEM", "LINK", "🔗")
        return links

    def exists(self, key: str) -> bool:
        with self._registry_lock:
            exists = key in self._registry
        self.log(f"Existenzprüfung: '{key}' → {exists}", "SYSTEM", "LINK", "🔗")
        return exists
