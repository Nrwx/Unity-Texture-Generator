from flask import Blueprint, request, jsonify
from controller.export_controller import ExportController
from utils import parse_response
from config.data.constant import REDIRECT_ROUTE

router_export = Blueprint("export", __name__)

@router_export.route("", methods=["POST"], strict_slashes=REDIRECT_ROUTE)
def handle_export():
    print(f"Incoming request URL: {request.url}")
    if request.method == 'POST':
        try:
            result = ExportController.handle(request.form)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    else:
        return jsonify({"error": "Methode nicht erlaubt."}), 405

    response, status = parse_response(result)

    return jsonify(response), status

