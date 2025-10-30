from config.data.constant import (BACKUP, MAX_BACKUPS, LAYERS)
from typing import Any, Optional,Callable
from model.base.main import BaseModel
from utils import time
import copy

class BackupModel(BaseModel):
    @classmethod
    def create(cls, state, id, title):
        try:
            backups_for_id = [b for b in BACKUP if b["id"] == id]
            active_backup = next((b for b in backups_for_id if b["active"]), None)
            max_global_index = max((b["index"] for b in BACKUP), default=-1)

            if active_backup is not None:
                current_time = active_backup["time"]
            else:
                current_time = -1  # oder 0 je nach Zeitformat

            # Lösche alle Backups, die nach active_backup zeitlich liegen
            BACKUP[:] = [b for b in BACKUP if not (b["id"] == id and b["time"] > current_time)]

            new_index = max_global_index + 1
            now = time('unix_ms')
            BACKUP.append({
                "id": id,
                "title": title,
                "time": now,
                "state": copy.deepcopy(state),
                "active": True,
                "index": new_index
            })

            # Deaktiviere andere Backups mit der ID
            for b in BACKUP:
                if b["id"] == id and b["index"] != new_index:
                    b["active"] = False

            return {"message": f"Backup für {id} gespeichert.", "index": new_index}
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

            chosen_time = chosen_backup["time"]
            chosen_state = chosen_backup["state"]

            # 1. Lösche alle Backups, die zeitlich nach dem Ziel-Zeitpunkt liegen
            BACKUP[:] = [b for b in BACKUP if b["time"] <= chosen_time]

            # 2. Setze alle Backups auf inactive
            for b in BACKUP:
                b["active"] = False

            # 3. Aktiviere das gewählte Backup
            for b in BACKUP:
                if b["id"] == id and b["index"] == index:
                    b["active"] = True

            # 4. Layer mit gleicher ID in LAYERS ersetzen (wenn vorhanden), sonst hinzufügen
            updated = False
            for i, layer in enumerate(LAYERS):
                if layer.get("id") == id:
                    LAYERS[i] = chosen_state
                    updated = True
                    break
            if not updated:
                LAYERS.append(chosen_state)

            return {"message": f"Jump erfolgreich zu ID '{id}'"}
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
        return [{
            "id": b["id"],
            "index": b["index"],
            "title": b["title"],
            "state": b["state"],
            "time": b["time"]
        } for b in BACKUP]