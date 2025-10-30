import os
from controller.base.main import BaseController
from flask import jsonify, send_file

class BrushController(BaseController):

    def _serve_brush(self, folder, filename):
        path = self._model._brush_style(folder, filename)
        if os.path.exists(path):
            return send_file(path)
        return jsonify({'error':'Not found'}), 404