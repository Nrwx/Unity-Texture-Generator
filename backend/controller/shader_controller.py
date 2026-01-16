# controller/shader_controller.py
import os
from flask import jsonify, send_file
from controller.base.main import BaseController

class ShaderController(BaseController):

    def _serve_shader(self, folder, filename):
        path = self._model._shader_style(folder, filename)
        if os.path.exists(path):
            return send_file(path)
        return jsonify({"error": "Font file not found"}), 404