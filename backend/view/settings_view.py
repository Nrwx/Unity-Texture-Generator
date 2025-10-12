from flask import Blueprint, request, jsonify
from controller.settings_controller import SettingsController
from utils import parse_response
from config.data.constant import REDIRECT_ROUTE

router_settings = Blueprint("settings", __name__)
@router_settings.route("", methods=["GET", "POST"], strict_slashes=REDIRECT_ROUTE)
def settings():
    if request.method == 'GET':
        try:
            result = SettingsController.fetch()

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST':
        try:
            result = SettingsController.handle(request.form)

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    else:
        return jsonify({"error": str(e)}), 500

    response, status = parse_response(result)

    return jsonify(response), status