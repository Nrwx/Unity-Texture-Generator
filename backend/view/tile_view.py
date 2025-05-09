from flask import Blueprint, request, jsonify
from controller.tile_controller import TileController

router_tile = Blueprint("tile", __name__)

@router_tile.route('/tile', methods=['POST'])
def handle_tile():
    try:
        url = TileController.handle(request.form)
        return jsonify({"url": url}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
