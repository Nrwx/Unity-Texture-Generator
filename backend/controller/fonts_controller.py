from flask import request, jsonify, send_from_directory
from model.fonts_model import FontsModel

class FontsController:

    @staticmethod
    def handle_fonts():
        if request.method == 'GET':
            return jsonify(FontsModel.get_fonts())

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
        return send_from_directory(FontsModel.get_font_path(folder), filename)
