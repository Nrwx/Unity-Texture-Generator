from config.data.constant import (BACKUP, MAX_BACKUPS, LAYERS)
from typing import Any, Optional,Callable
from model.base.main import BaseModel
from utils import time
import copy

class BackupModel(BaseModel):

    @staticmethod
    def _normalize_state(state):
        """
        Gibt IMMER eine vollständige Scene (Liste von Layern) zurück
        """
        # Fall 1: vollständige Scene
        if isinstance(state, list):
            return copy.deepcopy(state)

        # Fall 2: einzelner Layer
        if isinstance(state, dict):
            scene = copy.deepcopy(LAYERS)

            # Layer mit gleicher ID ersetzen oder hinzufügen
            for i, layer in enumerate(scene):
                if layer.get("id") == state.get("id"):
                    scene[i] = copy.deepcopy(state)
                    break
            else:
                scene.append(copy.deepcopy(state))

            return scene

        raise ValueError("Ungültiger State-Typ")


    @classmethod
    def create(cls, state, id, title):
        try:
            if state is None:
                return {"error": "State fehlt"}, 400

            # State vereinheitlichen
            normalized_state = cls._normalize_state(state)

            backups_for_id = [b for b in BACKUP if b["id"] == id]
            active_backup = next((b for b in backups_for_id if b.get("active")), None)

            if active_backup:
                active_index = active_backup["index"]

                # 🔥 GLOBALE Zukunft löschen (ID EGAL)
                BACKUP[:] = [
                    b for b in BACKUP
                    if b["index"] <= active_index
                ]

                new_index = active_index + 1
            else:
                # erster Eintrag oder inkonsistenter Zustand
                new_index = max((b["index"] for b in BACKUP), default=-1) + 1

            BACKUP.append({
                "id": id,
                "title": title,
                "time": time("unix_ms"),
                "state": normalized_state,
                "active": True,
                "index": new_index
            })

            # alle anderen deaktivieren
            for b in BACKUP:
                if b["index"] != new_index:
                    b["active"] = False

            return {
                "message": f"Backup gespeichert (Index {new_index})",
                "index": new_index
            }, 200

        except Exception as e:
            return cls.handle_error(e)




    @classmethod
    def jump(cls, index, id):
        try:
            backups = cls._get_backups_for_id_sorted(id)
            if not backups:
                return {"error": f"Kein Backup für ID '{id}' gefunden."}, 404

            chosen_backup = next((b for b in backups if b["index"] == index), None)
            if chosen_backup is None:
                return {"error": "Ungültiger Index."}, 400

            # Backups aktiv setzen
            for b in BACKUP:
                b["active"] = False
            chosen_backup["active"] = True

            # 🔥 Scene vollständig ersetzen
            LAYERS.clear()
            LAYERS.extend(copy.deepcopy(chosen_backup["state"]))

            return {"message": f"Jump erfolgreich zu Index {index}"}, 200

        except Exception as e:
            return cls.handle_error(e)



    @classmethod
    def fetch(cls):
        return cls._list_global(), 200

    @staticmethod
    def _get_backups_for_id_sorted(id):
        return sorted([b for b in BACKUP if b["id"] == id], key=lambda b: b["index"])

    @staticmethod
    def _list_global():
        # 🔥 Finde globalen aktiven Index (Undo-Pointer)
        active_index = max(
            (b["index"] for b in BACKUP if b.get("active")),
            default=-1
        )

        return [{
            "id": b["id"],
            "index": b["index"],
            "title": b["title"],
            "time": b["time"],
            "active": b["active"],
            "future": b["index"] > active_index
        } for b in BACKUP]