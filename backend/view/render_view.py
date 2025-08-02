from flask import Blueprint, request, jsonify
from controller.render_controller import RenderController
from utils import parse_response
from config.data.constant import ( REDIRECT_ROUTE )

router_render = Blueprint("render", __name__)

@router_render.route("", methods=["POST"], strict_slashes=REDIRECT_ROUTE)
def renderer():
    if request.method == 'POST':
        try:
            result = RenderController.handle(request.form)

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    response, status = parse_response(result)

    return jsonify(response), status
