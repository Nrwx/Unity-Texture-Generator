from flask import Blueprint, request, jsonify
from controller.layer_controller import LayerController
from utils import parse_response

router_layer = Blueprint("layer", __name__)
@router_layer.route("/", methods=["GET", "POST"])
def handle_layer():
    if request.method == 'GET':
        try:
            result = LayerController.fetch()

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST':
        try:
            result = LayerController.handle(request.form)

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    else:
        return jsonify({"error": str(e)}), 500

    response, status = parse_response(result)

    return jsonify(response), status