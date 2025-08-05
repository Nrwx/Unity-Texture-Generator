from flask import Blueprint, request, jsonify
from controller.path_controller import PathController
from utils import parse_response
from config.data.constant import ( REDIRECT_ROUTE )

router_path = Blueprint("path", __name__)

@router_path.route("", methods=["POST"], strict_slashes=REDIRECT_ROUTE)
def path():
    if request.method == 'POST':
        try:
            result = PathController.handle(request.form)

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    response, status = parse_response(result)

    return jsonify(response), status
