import os
from flask import send_from_directory
from controller.base.main import BaseController
from generated.paths import PUBLIC_MATERIAL_FOLDER

class MaterialController(BaseController):

    @classmethod
    def _safe_join_material_folder(cls, material_id):
        material_id = str(material_id or "").strip()

        if not material_id:
            raise ValueError("Material ID fehlt.")

        if "/" in material_id or "\\" in material_id or ".." in material_id:
            raise ValueError("Ungültige Material ID.")

        folder = os.path.join(PUBLIC_MATERIAL_FOLDER, material_id)

        return folder

    @classmethod
    def _serve_texture(cls, material_id, filename):
        try:
            filename = str(filename or "").strip()

            if not filename:
                return {"error": "Dateiname fehlt."}, 400

            if "/" in filename or "\\" in filename or ".." in filename:
                return {"error": "Ungültiger Dateiname."}, 400

            folder = cls._safe_join_material_folder(material_id)
            path = os.path.join(folder, filename)

            if not os.path.exists(path):
                return {
                    "error": "Material texture not found.",
                    "material_id": material_id,
                    "filename": filename,
                    "path": path,
                }, 404

            return send_from_directory(
                folder,
                filename,
                as_attachment=False,
            )

        except Exception as error:
            return {"error": str(error)}, 500

    @classmethod
    def _serve_package(cls, material_id, filename):
        try:
            filename = str(filename or "").strip()

            if not filename:
                return {"error": "Dateiname fehlt."}, 400

            if "/" in filename or "\\" in filename or ".." in filename:
                return {"error": "Ungültiger Dateiname."}, 400

            folder = cls._safe_join_material_folder(material_id)
            path = os.path.join(folder, filename)

            if not os.path.exists(path):
                return {
                    "error": "Material package not found.",
                    "material_id": material_id,
                    "filename": filename,
                    "path": path,
                }, 404

            return send_from_directory(
                folder,
                filename,
                as_attachment=False,
            )

        except Exception as error:
            return {"error": str(error)}, 500