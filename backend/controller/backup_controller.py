from model.backup_model import BackupModel
import json

class BackupController:

    METHOD_MAP = {
        "create_global": {
            "keys": {"state"},
            "function": lambda state: BackupModel.create_global_state(json.loads(state))
        },
        "undo": {
            "keys": set(),
            "function": lambda: BackupModel.undo()
        },
        "redo": {
            "keys": set(),
            "function": lambda: BackupModel.redo()
        },
        "jump": {
            "keys": {"index"},
            "function": lambda index: BackupModel.jump_to(int(index))
        },
        "create": {
            "keys": {"id"},
            "function": BackupModel.create
        },
        "restore": {
            "keys": {"id"},
            "function": BackupModel.restore
        },
        "previous": {
            "keys": {"id"},
            "function": BackupModel.previous
        },
        "forward": {
            "keys": {"id"},
            "function": BackupModel.forward
        }
    }

    @classmethod
    def handle(cls, params):
        method = params.get("method")
        if method not in cls.METHOD_MAP:
            return {"error": "Ungültige Methode."}, 400

        method_info = cls.METHOD_MAP[method]
        method_keys = method_info["keys"]
        method_function = method_info["function"]
        method_params = {key: params[key] for key in method_keys if key in params}
        return method_function(**method_params)


    @classmethod
    def fetch(cls, params):
        """
        GET-Handler:
          - ohne id → globale Liste
          - mit id  → layer-spezifische Liste
        """
        layer_id = params.get("id")
        if layer_id:
            return BackupModel.list_backups(layer_id)
        else:
            return BackupModel.list_global()

    @classmethod
    def list_layer_backups(cls):
        return BackupModel.list_backups()

    @classmethod
    def get_current_layer_backup(cls, layer_id):
        return BackupModel.get_current(layer_id)

    @classmethod
    def list_global_backups(cls):
        return BackupModel.list_global()