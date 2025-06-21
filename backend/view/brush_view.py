from flask import Blueprint, request, jsonify
from controller.brush_controller import BrushController
from utils import parse_response
from config.data.constant import REDIRECT_ROUTE

router_brushes = Blueprint('brushes', __name__)

@router_brushes.route('/', methods=['GET', 'POST'], strict_slashes=REDIRECT_ROUTE)
def handle_brushes():
    if request.method == 'GET':
        try:
            result = BrushController.fetch()
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST':
        try:
            data = request.get_json() or request.form
            files = request.files
            result = BrushController.handle(data, files)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    else:
        return jsonify({"error": "Invalid Method"}), 405

    response, status = parse_response(result)
    return jsonify(response), status

@router_brushes.route('/style/<folder>/<filename>', methods=['GET'], strict_slashes=REDIRECT_ROUTE)
def serve_brush_style(folder, filename):
    return BrushController.serve_style(folder, filename)