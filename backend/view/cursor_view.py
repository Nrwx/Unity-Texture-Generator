from flask import Blueprint, request, jsonify
from controller.cursor_controller import CursorController
from utils import parse_response
from config.data.constant import REDIRECT_ROUTE

router_cursor = Blueprint("cursor", __name__)

@router_cursor.route("", methods=["POST"], strict_slashes=REDIRECT_ROUTE)
def handle_cursor():
    try:
        data = request.form
        if not data:
            return jsonify({"error": "Keine Eingabedaten übermittelt"}), 400

        result = CursorController.handle(data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    response, status = parse_response(result)
    return jsonify(response), status