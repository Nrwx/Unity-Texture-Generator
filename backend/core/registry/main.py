import threading
import uuid
import json
from typing import Any

_ALLOWED_PRIMITIVES = (int, float, bool, str)

def _is_primitive_val(val) -> bool:
    """Rekursiv prüfen: nur primitives, lists oder dicts mit primitiv-nested."""
    if isinstance(val, _ALLOWED_PRIMITIVES):
        return True
    if isinstance(val, list):
        return all(_is_primitive_val(x) for x in val)
    if isinstance(val, dict):
        return all(isinstance(k, str) and _is_primitive_val(v) for k, v in val.items())
    return False

def _type_name(t: type) -> str:
    return t.__name__ if hasattr(t, "__name__") else str(t)

class Registry:
    _instance = None
    _lock = threading.Lock()  # Thread-safe Singleton-Lock

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(self, treasure=None):
        if getattr(self, "_initialized", False):
            return
        self._registry = {}
        self._registry_lock = threading.RLock()
        self._initialized = True
        self.treasure = treasure

    def init_key(self, key: str, expected_type: type):
        """Primär-Keys hinzufügen (None initialisieren). Erlaubt auch expected_type == object."""
        if expected_type not in (int, float, bool, str, list, dict, object):
            raise TypeError(f"Expected type must be primitive/list/dict/object, got {expected_type!r}")
        with self._registry_lock:
            self._registry[key] = {"value": None, "type": expected_type, "id": None, "object_ref": None}

    def set(self, key: str, value, expected_type: type):
        """
        Setzt einen Wert. Besonderheit:
        - expected_type == object:
            - wenn value serialisierbar (primitives/list/dict) -> speichern in Treasure (persist)
            - sonst -> nur In-Memory-Referenz in Registry (kein Treasure)
        - sonst wie vorher: nur primitives/list/dict erlaubt, alles andere -> TypeError
        """
        if expected_type not in (int, float, bool, str, list, dict, object):
            raise TypeError(f"Key '{key}': expected_type must be int/float/bool/str/list/dict/object")

        with self._registry_lock:
            entry = self._registry.get(key)
            if entry is None:
                self._registry[key] = {"value": None, "type": expected_type, "id": None, "object_ref": None}
                entry = self._registry[key]

            # Wenn value None -> nur Registry-Eintrag (kein Treasure)
            if value is None:
                entry.update({"value": None, "id": None, "type": expected_type, "object_ref": None})
                return

            # Sonderfall: expected_type is object
            if expected_type is object:
                # Wenn serialisierbar -> persistieren (Treasure), sonst In-Memory speichern
                if _is_primitive_val(value):
                    # persistieren: type info ist der konkrete Typ (z.B. int/str/list/dict)
                    new_id = str(uuid.uuid4())
                    payload = {"__type__": _type_name(type(value)), "value": value}
                    payload_str = json.dumps(payload, ensure_ascii=False)
                    self.treasure.set(new_id, payload_str)
                    self._registry[key] = {"value": new_id, "type": type(value), "id": new_id, "object_ref": None}
                    return
                else:
                    # In-memory reference (nicht persistiert)
                    self._registry[key] = {"value": None, "type": object, "id": None, "object_ref": value}
                    return

            # Standardfälle (expected_type in primitives/list/dict)
            # primitive strict type check to avoid bool/int confusion
            if expected_type in (int, float, bool, str):
                if type(value) is not expected_type:
                    raise TypeError(f"Key '{key}' erwartet Typ {expected_type.__name__}, bekam aber {type(value).__name__}")
            else:
                # list/dict expected
                if expected_type is list and not isinstance(value, list):
                    raise TypeError(f"Key '{key}' erwartet list, bekam {type(value).__name__}")
                if expected_type is dict and not isinstance(value, dict):
                    raise TypeError(f"Key '{key}' erwartet dict, bekam {type(value).__name__}")

            # Für list/dict: sicherstellen, dass nested primitiv ist
            if expected_type in (list, dict) and not _is_primitive_val(value):
                raise TypeError(f"Key '{key}': nested values müssen primitive (int/float/bool/str) sein.")

            # Neue Treasure-ID und persistieren
            new_id = str(uuid.uuid4())
            payload = {"__type__": _type_name(expected_type), "value": value}
            payload_str = json.dumps(payload, ensure_ascii=False)
            self.treasure.set(new_id, payload_str)
            self._registry[key] = {"value": new_id, "type": expected_type, "id": new_id, "object_ref": None}

    def get(self, key: str):
        """
        Liefert den Wert:
        - wenn In-Memory object_ref gesetzt -> return object direkt
        - sonst: Treasure holen und deserialisieren + Fallbacks wie zuvor
        """
        with self._registry_lock:
            if key not in self._registry:
                raise KeyError(f"Key '{key}' nicht gefunden.")
            entry = self._registry[key]
            value_id = entry["value"]
            expected_type = entry["type"]
            object_ref = entry.get("object_ref")

            # Falls In-Memory-Objekt vorhanden -> direkt zurückgeben
            if object_ref is not None:
                return object_ref

            if value_id is None:
                return None

        # Treasure außerhalb des Locks holen
        treasure_value = self.treasure.get(value_id)
        if treasure_value is None:
            return None

        # Versuche JSON (neues Format)
        try:
            parsed = json.loads(treasure_value)
            if isinstance(parsed, dict) and "__type__" in parsed and "value" in parsed:
                val = parsed["value"]
                # Wenn expected_type ist object, dann type in entry kann die konkrete Typklasse sein (int/str/..)
                if expected_type in (int, float, bool, str) or expected_type is object:
                    if type(val) is expected_type or expected_type is object:
                        return val
                    # Konvertierungsversuch für primitives
                    try:
                        if expected_type is bool:
                            return bool(val)
                        if expected_type is int:
                            return int(val)
                        if expected_type is float:
                            return float(val)
                        if expected_type is str:
                            return str(val)
                    except Exception:
                        raise TypeError(f"Treasure-Wert für '{key}' passt nicht zu erwartetem Typ {expected_type.__name__}")
                else:
                    if expected_type is list and isinstance(val, list):
                        return val
                    if expected_type is dict and isinstance(val, dict):
                        return val
                    raise TypeError(f"Treasure-Wert für '{key}' passt nicht zu erwartetem Typ {expected_type.__name__}")
        except json.JSONDecodeError:
            pass

        # Fallbacks wie zuvor (raw string parsing)
        raw = treasure_value
        if expected_type is str or expected_type is object:
            # object kann auch aus Treasure gelesen werden (wenn zuvor serialisiert)
            return raw if expected_type is str else raw

        if expected_type is bool:
            low = raw.strip().lower()
            if low in ("true", "1", "yes"):
                return True
            if low in ("false", "0", "no"):
                return False
            raise ValueError(f"Kann bool nicht aus Treasure-String '{raw}' parsen.")

        if expected_type is int:
            try:
                return int(raw)
            except Exception:
                raise ValueError(f"Kann int nicht aus Treasure-String '{raw}' parsen.")

        if expected_type is float:
            try:
                return float(raw)
            except Exception:
                raise ValueError(f"Kann float nicht aus Treasure-String '{raw}' parsen.")

        if expected_type in (list, dict):
            try:
                parsed2 = json.loads(raw)
                if expected_type is list and isinstance(parsed2, list):
                    return parsed2
                if expected_type is dict and isinstance(parsed2, dict):
                    return parsed2
                raise ValueError(f"Treasure-String konnte nicht in {expected_type.__name__} konvertiert werden.")
            except Exception as e:
                raise ValueError(f"Fallback: konnte list/dict nicht parsen: {e}")

    def exists(self, key: str) -> bool:
        with self._registry_lock:
            return key in self._registry

    def remove(self, key: str):
        with self._registry_lock:
            entry = self._registry.pop(key, None)
        if not entry:
            return
        # Wenn eine Treasure-ID existiert -> löschen
        if entry.get("value"):
            self.treasure.delete(entry["value"])
        # Wenn object_ref vorhanden -> einfach verwerfen (In-Memory)
        # Keine Aktion nötig für object_ref

    def list_all(self):
        with self._registry_lock:
            result = {}
            for k, v in self._registry.items():
                t = v["type"]
                # wenn object_ref vorhanden -> typ als 'object' anzeigen
                if v.get("object_ref") is not None:
                    result[k] = "object(in-memory)"
                else:
                    result[k] = t.__name__ if hasattr(t, "__name__") else str(t)
            return result
