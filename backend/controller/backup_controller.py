from model.backup_model import BackupModel
import json

class BackupController:

    METHOD_MAP = {
        "create": {
            "keys": {"state", "id", "title"},
            "function": lambda state, id, title: BackupModel.create(json.loads(state), id, title)
        },
        "jump": {
            "keys": {"index", "id"},
            "function": lambda index, id: BackupModel.jump_to(int(index), id)
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
    def fetch(cls):
        return BackupModel.list_global()