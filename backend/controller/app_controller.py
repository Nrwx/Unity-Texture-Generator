import os
from flask import send_from_directory, send_file, jsonify
from generated.paths import PUBLIC_LAYER_FOLDER, PUBLIC_TEMP_UPLOAD_FOLDER, PUBLIC_TEMP_CHANNEL_FOLDER, PUBLIC_TEMP_MASK_FOLDER
from config.data.constant import ( FRONTEND_PATH )

class AppController:

    @staticmethod
    def serve_index():
        return send_from_directory(FRONTEND_PATH[0], FRONTEND_PATH[1])

    @staticmethod
    def serve_static(path):
        return send_from_directory(FRONTEND_PATH[0], path)

    @staticmethod
    def download(filename):
        file_paths = [
            os.path.join(PUBLIC_LAYER_FOLDER, filename),
            os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER, filename),
            os.path.join(PUBLIC_TEMP_CHANNEL_FOLDER, filename),
            os.path.join(PUBLIC_TEMP_MASK_FOLDER, filename)
        ]

        for file_path in file_paths:
            if os.path.exists(file_path):
                return send_file(file_path, mimetype='image/png')

        return jsonify({"error": "File not found"}), 404