# controller/app_controller.py
import os
import mimetypes
from flask import send_from_directory, send_file, jsonify

from controller.base.main import BaseController
from generated.paths import (
    PUBLIC_LAYER_FOLDER,
    PUBLIC_TEMP_UPLOAD_FOLDER,
    PUBLIC_TEMP_RENDER_FOLDER,
    PUBLIC_TEMP_CHANNEL_FOLDER,
    PUBLIC_TEMP_MASK_FOLDER,
    PUBLIC_TEMP_CURSOR_FOLDER,
)
from config.data.constant import FRONTEND_PATH


class AppController(BaseController):
    """
    AppController:
    - Verantwortlich für Frontend Serving & File-Downloads.
    - Erbt von BaseController → nutzt generische Exception-, Log- und Parser-Mechanismen.
    """

    @staticmethod
    def serve_index():
        """Liefert die Hauptindex-Datei des Frontends."""
        try:
            return send_from_directory(FRONTEND_PATH[0], FRONTEND_PATH[1])
        except FileNotFoundError:
            return jsonify({"error": "Frontend-Index nicht gefunden"}), 404

    @staticmethod
    def serve_static(path: str):
        """Liefert statische Assets aus dem Frontend-Ordner."""
        file_path = os.path.join(FRONTEND_PATH[0], path)
        if not os.path.exists(file_path):
            return jsonify({"error": f"Datei '{path}' nicht gefunden"}), 404
        return send_from_directory(FRONTEND_PATH[0], path)

    @staticmethod
    def download(filename: str):
        """
        Liefert beliebige Dateien aus öffentlichen Temp- und Layer-Ordnern.
        Prüft alle bekannten PUBLIC_* Verzeichnisse der Anwendung.
        """
        search_paths = [
            PUBLIC_LAYER_FOLDER,
            PUBLIC_TEMP_RENDER_FOLDER,
            PUBLIC_TEMP_UPLOAD_FOLDER,
            PUBLIC_TEMP_CHANNEL_FOLDER,
            PUBLIC_TEMP_MASK_FOLDER,
            PUBLIC_TEMP_CURSOR_FOLDER,
        ]

        for folder in search_paths:
            file_path = os.path.join(folder, filename)
            if os.path.exists(file_path):
                mimetype, _ = mimetypes.guess_type(file_path)
                return send_file(file_path, mimetype=mimetype or "application/octet-stream")

        return jsonify({"error": "Datei nicht gefunden"}), 404
