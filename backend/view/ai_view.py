from flask import Blueprint
from controller.ai_controller import AIController
from config.data.constant import REDIRECT_ROUTE

router_ai = Blueprint('ai', __name__)

@router_ai.route('', methods=['POST'], strict_slashes=REDIRECT_ROUTE)
def generate_image():
    return AIController.handle_generate_image()
