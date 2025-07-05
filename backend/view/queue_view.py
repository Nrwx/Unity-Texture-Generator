from flask import Blueprint, jsonify
from controller.queue_controller import QueueController
from config.data.constant import ( REDIRECT_ROUTE )

router_queue = Blueprint("queue", __name__)

@router_queue.route("", methods=["GET"], strict_slashes=REDIRECT_ROUTE)
def queue_status():
    status = QueueController.get_queue_status()
    return jsonify(status)
