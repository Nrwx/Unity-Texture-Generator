from flask import Blueprint, request, jsonify
from controller.settings_controller import SettingsController
from model.settings_model import SettingsModel

settings_bp = Blueprint('settings', __name__)

@settings_bp.route("/", methods=["GET", "POST"])
def apply_app_settings():
    if request.method == 'GET':
        return jsonify(SettingsModel.get_settings())

    if request.method == 'POST':
        new_settings = request.json
        if not new_settings:
            return jsonify({"error": "Keine Daten übermittelt"}), 400

        try:
            updated_settings = SettingsController.update_animation_settings(new_settings)
            SettingsModel.save_settings(updated_settings)

            # Optional: Settings global synchronisieren
            from config.app import app_settings
            app_settings.ANIMATION_SETTINGS = updated_settings

            return jsonify({"success": True, "updated_settings": updated_settings})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
