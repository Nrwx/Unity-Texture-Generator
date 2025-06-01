from flask import Blueprint, request, jsonify
from controller.modifier_controller import ModifierController
from utils import parse_response
from config.data.constant import ( REDIRECT_ROUTE )

router_modifier = Blueprint("modifier", __name__)
@router_modifier.route("", methods=["POST"], strict_slashes=REDIRECT_ROUTE)
def handle_viewport():
    if request.method == 'POST':
        try:
            result = ModifierController.handle(request.form)

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    response, status = parse_response(result)

    return jsonify(response), status
