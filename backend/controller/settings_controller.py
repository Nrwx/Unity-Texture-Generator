from model.settings_model import SettingsModel

class SettingsController:
    @staticmethod
    def update_animation_settings(new_settings):
        current = SettingsModel.get_settings().copy()
        current["use_gpu"] = bool(new_settings.get("use_gpu", current["use_gpu"]))
        current["cpu_threads"] = int(new_settings.get("cpu_threads", current["cpu_threads"]))
        current["preferred_unit"] = new_settings.get("preferred_unit", current["preferred_unit"])
        return current
