import os
from flask import request, jsonify, send_file
from model.fonts_model import FontsModel
from generated.paths import PUBLIC_FONT_FOLDER

class FontsController:

    @staticmethod
    def handle_fonts():
        mode = request.form.get('mode')
        if mode == 'list':
            return jsonify(FontsModel.scan_fonts())

        if mode == 'fetch':
            return FontsModel.fetch_group(request.form.get('id'))

        if mode == 'upload':
            return FontsModel.upload_font_file(request.files)

        if mode == 'update':
            return FontsModel.update_group(request.get_json())

        if mode == 'delete':
            return FontsModel.delete_group(request.form.get('id'))

        return jsonify({'error': 'Invalid mode'}), 400

    @staticmethod
    def serve_font(folder, filename):
        font_path = os.path.join(PUBLIC_FONT_FOLDER, folder, filename)

        if os.path.exists(font_path):
            print(font_path)
            return send_file(font_path, mimetype='font/ttf')

        return jsonify({"error": "Font file not found"}), 404

    @staticmethod
    def fetch():
        return FontsModel.get_fonts()
