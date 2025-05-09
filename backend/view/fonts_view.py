from flask import Blueprint
from controller.fonts_controller import FontsController

router_fonts = Blueprint('fonts', __name__)

router_fonts.add_url_rule('', view_func=FontsController.handle_fonts, methods=['GET', 'POST'])
router_fonts.add_url_rule('/<folder>/<filename>', view_func=FontsController.serve_font)
