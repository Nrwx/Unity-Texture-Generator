from flask import Blueprint, request, jsonify
from controller.fonts_controller import FontsController
from utils import parse_response
from config.data.constant import ( REDIRECT_ROUTE )

router_fonts = Blueprint('fonts', __name__)
@router_fonts.route('/', methods=['GET', 'POST'], strict_slashes=REDIRECT_ROUTE)
def handle_fonts():
    if request.method == 'GET':
        try:
            result = FontsController.fetch()

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST':
        try:
            result = FontsController.handle(request.form)

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    else:
        return jsonify({"error": str(e)}), 500

    response, status = parse_response(result)

    return jsonify(response), status


@router_fonts.route('/<folder>/<filename>', methods=['GET'])
def serve_font(folder, filename):
    return FontsController.serve_font(folder, filename)
