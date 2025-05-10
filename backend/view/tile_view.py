from flask import Blueprint, request, jsonify
from controller.tile_controller import TileController
from utils import parse_response

router_tile = Blueprint("tile", __name__)
@router_tile.route('/', methods=['POST'])
def handle_tile():
    if request.method == 'POST':
        try:
            result = TileController.handle(request.form)

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    response, status = parse_response(result)

    return jsonify(response), status