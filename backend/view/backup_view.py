from flask import Blueprint, request, jsonify
from controller.backup_controller import BackupController
from utils import parse_response
from config.data.constant import REDIRECT_ROUTE

router_backup = Blueprint("backup", __name__)

@router_backup.route("", methods=["GET", "POST"], strict_slashes=REDIRECT_ROUTE)
def handle_backup():
    if request.method == 'GET':
        try:
            params = request.args.to_dict()
            result = BackupController.fetch(params)

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST':
        try:
            result = BackupController.handle(request.form)

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    else:
        return jsonify({"error": str(e)}), 500

    response, status = parse_response(result)

    return jsonify(response), status
