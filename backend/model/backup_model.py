from collections import deque
import copy
from config.data.constant import (LAYERS, LAYER_BACKUPS, BACKUP_INDEX, MAX_BACKUPS)
from utils import time

class BackupModel:

    @staticmethod
    def create_global_state(state):
        # Schneide zukünftige States ab, wenn nicht am Ende
        if GLOBAL_BACKUP["index"] < len(GLOBAL_BACKUP["history"]) - 1:
            GLOBAL_BACKUP["history"] = GLOBAL_BACKUP["history"][:GLOBAL_BACKUP["index"] + 1]

        # State hinzufügen (deepcopy für Sicherheit)
        GLOBAL_BACKUP["history"].append(copy.deepcopy(state))
        GLOBAL_BACKUP["index"] += 1

        return {"message": "Globaler Zustand gespeichert.", "index": GLOBAL_BACKUP["index"]}

    @staticmethod
    def get_global_state():
        if GLOBAL_BACKUP["index"] == -1:
            return {"error": "Keine Zustände vorhanden."}, 404
        return GLOBAL_BACKUP["history"][GLOBAL_BACKUP["index"]]

    @staticmethod
    def undo():
        if GLOBAL_BACKUP["index"] > 0:
            GLOBAL_BACKUP["index"] -= 1
            return {"message": "Zurückgesprungen.", "index": GLOBAL_BACKUP["index"]}
        return {"error": "Kein früherer Zustand verfügbar."}, 400

    @staticmethod
    def redo():
        if GLOBAL_BACKUP["index"] < len(GLOBAL_BACKUP["history"]) - 1:
            GLOBAL_BACKUP["index"] += 1
            return {"message": "Vorgespult.", "index": GLOBAL_BACKUP["index"]}
        return {"error": "Kein späterer Zustand verfügbar."}, 400

    @staticmethod
    def jump_to(index):
        if 0 <= index < len(GLOBAL_BACKUP["history"]):
            GLOBAL_BACKUP["index"] = index
            return {"message": f"Gesprungen zu Index {index}", "index": index}
        return {"error": "Ungültiger Index."}, 400

    @staticmethod
    def list_global():
        return {
            "history": [
                {"index": i, "active": (i == GLOBAL_BACKUP["index"])}
                for i in range(len(GLOBAL_BACKUP["history"]))
            ],
            "current": GLOBAL_BACKUP["index"]
        }

    @staticmethod
    def create(id):
        layer = next((l for l in LAYERS if l["id"] == id), None)
        if not layer:
            return {"error": f"Layer mit ID '{id}' nicht gefunden."}, 404

        backup = {
            "time": time('unix_ms'),
            "matrix": layer["matrix"].copy(),
            "width": layer.get("width"),
            "height": layer.get("height"),
            "type": layer.get("type"),
        }

        if layer["type"] == 0:
            backup.update({
                "url": layer.get("url"),
                "opacity": layer.get("opacity"),
                "blend_mode": layer.get("blend_mode"),
                "color": layer.get("color"),
                "name": layer.get("name"),
                "mask": layer.get("mask"),
            })
        elif layer["type"] == 1:
            backup.update({
                "text": layer.get("text"),
                "font": layer.get("font"),
                "fontFamily": layer.get("fontFamily"),
                "fontSize": layer.get("fontSize"),
                "fontWeight": layer.get("fontWeight"),
                "initFontSize": layer.get("initFontSize"),
                "initHeight": layer.get("initHeight"),
                "initWidth": layer.get("initWidth"),
                "letterSpacing": layer.get("letterSpacing"),
                "lineHeight": layer.get("lineHeight"),
                "textAlign": layer.get("textAlign"),
                "textDecoration": layer.get("textDecoration"),
                "textTransform": layer.get("textTransform"),
                "opacity": layer.get("opacity"),
                "color": layer.get("color"),
                "name": layer.get("name"),
                "mask": layer.get("mask"),
            })

        if id not in LAYER_BACKUPS:
            LAYER_BACKUPS[id] = deque(maxlen=MAX_BACKUPS)
        LAYER_BACKUPS[id].append(backup)
        BACKUP_INDEX[id] = len(LAYER_BACKUPS[id]) - 1

        return {"message": f"Backup für Layer {id} gespeichert."}, 200

    @staticmethod
    def _apply_backup(id, backup):
        layer = next((l for l in LAYERS if l["id"] == id), None)
        if not layer:
            return {"error": f"Layer mit ID '{id}' nicht gefunden."}, 404

        layer.update({
            "matrix": backup["matrix"],
            "width": backup["width"],
            "height": backup["height"],
        })

        if backup["type"] == 0:
            layer.update({
                "url": backup.get("url"),
                "opacity": backup.get("opacity"),
                "blend_mode": backup.get("blend_mode"),
                "color": backup.get("color"),
                "name": backup.get("name"),
                "mask": backup.get("mask"),
            })
        elif backup["type"] == 1:
            layer.update({
                "text": backup.get("text"),
                "font": backup.get("font"),
                "fontFamily": backup.get("fontFamily"),
                "fontSize": backup.get("fontSize"),
                "fontWeight": backup.get("fontWeight"),
                "initFontSize": backup.get("initFontSize"),
                "initHeight": backup.get("initHeight"),
                "initWidth": backup.get("initWidth"),
                "letterSpacing": backup.get("letterSpacing"),
                "lineHeight": backup.get("lineHeight"),
                "textAlign": backup.get("textAlign"),
                "textDecoration": backup.get("textDecoration"),
                "textTransform": backup.get("textTransform"),
                "opacity": backup.get("opacity"),
                "color": backup.get("color"),
                "name": backup.get("name"),
                "mask": backup.get("mask"),
            })

        return {"message": f"Layer {id} erfolgreich wiederhergestellt."}, 200

    @staticmethod
    def restore(id):
        if id not in LAYER_BACKUPS or not LAYER_BACKUPS[id]:
            return {"error": "Kein Backup vorhanden."}, 404

        BACKUP_INDEX[id] = len(LAYER_BACKUPS[id]) - 1
        backup = LAYER_BACKUPS[id][BACKUP_INDEX[id]]
        return BackupModel._apply_backup(id, backup)

    @staticmethod
    def previous(id):
        if id not in BACKUP_INDEX or BACKUP_INDEX[id] <= 0:
            return {"error": "Kein früheres Backup verfügbar."}, 400

        BACKUP_INDEX[id] -= 1
        backup = LAYER_BACKUPS[id][BACKUP_INDEX[id]]
        return BackupModel._apply_backup(id, backup)

    @staticmethod
    def forward(id):
        if id not in BACKUP_INDEX or BACKUP_INDEX[id] >= len(LAYER_BACKUPS[id]) - 1:
            return {"error": "Kein späteres Backup verfügbar."}, 400

        BACKUP_INDEX[id] += 1
        backup = LAYER_BACKUPS[id][BACKUP_INDEX[id]]
        return BackupModel._apply_backup(id, backup)

    @staticmethod
    def list_backups(id):
        if id not in LAYER_BACKUPS:
            return {"backups": []}, 200
        return {
            "backups": list(LAYER_BACKUPS[id]),
            "currentIndex": BACKUP_INDEX.get(id, -1)
        }, 200
