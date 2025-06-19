from flask import Blueprint, request, jsonify
from controller.backup_controller import BackupController
from utils import parse_response
from config.data.constant import REDIRECT_ROUTE

router_backup = Blueprint("backup", __name__)

@router_backup.route("", methods=["GET", "POST"], strict_slashes=REDIRECT_ROUTE)
def handle_backup():
    print(f"Incoming request URL: {request.url}")
    if request.method == 'GET':
        try:
            params = request.args.to_dict()
            print(f"Query params: {params}")
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

@router_backup.route("/layer/<string:layer_id>/list", methods=["GET"])
def list_layer_backups(layer_id):
    try:
        result = BackupController.list_layer_backups(layer_id)
        response, status = parse_response(result)
        return jsonify(response), status
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@router_backup.route("/layer/<string:layer_id>/current", methods=["GET"])
def get_current_layer_backup(layer_id):
    try:
        result = BackupController.get_current_layer_backup(layer_id)
        response, status = parse_response(result)
        return jsonify(response), status
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@router_backup.route("/global/list", methods=["GET"])
def list_global_backups():
    try:
        result = BackupController.list_global_backups()
        response, status = parse_response(result)
        return jsonify(response), status
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@router_backup.route("/layer/list", methods=["GET"])
def layer_backups():
    try:
        result = BackupController.list_layer_backups()
        response, status = parse_response(result)
        return jsonify(response), status
    except Exception as e:
        return jsonify({"error": str(e)}), 500