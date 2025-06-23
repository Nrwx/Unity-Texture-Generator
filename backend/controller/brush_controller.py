import os
from flask import request, jsonify, send_file
from model.brush_model import BrushModel
from generated.paths import PUBLIC_BRUSH_FOLDER

class BrushController:
    @staticmethod
    def handle(data, files):
        mode = data.get('mode')
        if mode == 'list':
            return BrushModel.scan_styles(), 200
        if mode == 'fetch':
            return BrushModel.fetch_group(data.get('id'))
        if mode == 'upload':
            return BrushModel.upload_style(files)
        if mode == 'delete':
            return BrushModel.delete_group(data.get('id'))
        return jsonify({'error':'Invalid mode'}), 400

    @staticmethod
    def fetch():
        return BrushModel.get_brushes()

    @staticmethod
    def serve_style(folder, filename):
        path = BrushModel.get_style_path(folder, filename)
        if os.path.exists(path):
            # adjust mimetype per extension
            return send_file(path)
        return jsonify({'error':'Not found'}), 404