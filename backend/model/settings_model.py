from config.app.app_settings import get_app_settings, save_app_settings

class SettingsModel:
    @staticmethod
    def get_settings():
        return get_app_settings()

    @staticmethod
    def save_settings(updated_settings):
        save_app_settings(updated_settings)
