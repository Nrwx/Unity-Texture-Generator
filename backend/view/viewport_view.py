from flask import Blueprint, request, jsonify
from controller.viewport_controller import ViewportController
from utils import parse_response
from config.data.constant import ( REDIRECT_ROUTE )

router_viewport = Blueprint("viewport", __name__)
@router_viewport.route("", methods=["POST"], strict_slashes=REDIRECT_ROUTE)
def handle_viewport():
    if request.method == 'POST':
        try:
            result = ViewportController.handle(request.form)

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    response, status = parse_response(result)

    return jsonify(response), status
