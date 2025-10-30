# controller/fonts_controller.py
import os
from flask import jsonify, send_file
from controller.base.main import BaseController

class FontsController(BaseController):

    def _serve_font(self, folder, filename):
        path = self._model._font_style(folder, filename)
        if os.path.exists(path):
            return send_file(path, mimetype='font/ttf')
        return jsonify({"error": "Font file not found"}), 404