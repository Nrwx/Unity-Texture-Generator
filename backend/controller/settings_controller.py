from model.settings_model import SettingsModel
from utils.api.parser import parse_parameters
from config.api.parameter import PARAMETERS


class SettingsController:
    """
    SettingsController im gleichen Schema wie RenderController.
    Handhabt Methoden 'get' und 'update'.
    """

    METHOD_MAP = {
        "list": {
            "keys": {},
            "function": SettingsModel.get_settings
        },
        "update": {
            "keys": {
                # === System ===
                "os_type",
                "os_arch",
                "os_cpu",
                "os_memory",

                # === GPU ===
                "use_gpu",
                "gpu_name",
                "gpu_memory_mb",
                "preferred_unit",

                # === CPU ===
                "cpu_threads",

                # === Performance ===
                "system_score",
                "system_rating",
                "recommended_ram_gb",
                "recommended_cpu_threads",
                "recommended_gpu_gb",

                # === Meta ===
                "last_update"
            },
            "function": SettingsModel.update_settings
        }
    }

    @classmethod
    def handle(cls, form):
        params = parse_parameters(PARAMETERS['settings'], form)
        method = params.get('method')
        if method not in cls.METHOD_MAP:
            return {"error": "Invalid method"}, 400

        method_info = cls.METHOD_MAP[method]
        method_keys = method_info['keys']
        method_function = method_info['function']
        method_params = {key: params[key] for key in method_keys if key in params}
        return method_function(**method_params)

    @classmethod
    def fetch(cls):
        method_info = cls.METHOD_MAP['list']
        method_function = method_info['function']
        return method_function()
