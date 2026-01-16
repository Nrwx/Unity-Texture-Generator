import os
import zipfile
import shutil
import tempfile
import uuid

from model.base.main import BaseModel
from generated.paths import ASSETS_SHADER_FOLDER, PUBLIC_SHADER_FOLDER

# ------------------------------------------------------------
# Global Shader Registry (wie FONTS)
# ------------------------------------------------------------
SHADERS = []


class ShaderModel(BaseModel):

    # ============================================================
    # Auto-Initialize
    # ============================================================
    @classmethod
    def initialize(cls):
        try:
            cls._copy_standard_assets()
            cls._scan_shaders()
        except Exception as e:
            return cls.handle_error(e)

    # ============================================================
    # Public Fetch API
    # ============================================================
    @classmethod
    def fetch(cls):
        return SHADERS, 200

    # ============================================================
    # Copy & unzip assets/shader/*.zip → public/shader/
    # ============================================================
    @classmethod
    def _copy_standard_assets(cls):
        os.makedirs(PUBLIC_SHADER_FOLDER, exist_ok=True)

        # nicht erneut entpacken
        if os.listdir(PUBLIC_SHADER_FOLDER):
            return

        for entry in os.listdir(ASSETS_SHADER_FOLDER):
            src = os.path.join(ASSETS_SHADER_FOLDER, entry)

            if zipfile.is_zipfile(src):
                with zipfile.ZipFile(src, "r") as zip_ref:
                    with tempfile.TemporaryDirectory() as tmp:
                        zip_ref.extractall(tmp)
                        cls._merge_shader_tree(tmp, folder_name=os.path.splitext(entry)[0])
            elif os.path.isdir(src):
                cls._merge_shader_tree(src, folder_name=entry)

    # ============================================================
    # Merge GLSL files into public/shader/<folderId>
    # ============================================================
    @staticmethod
    def _merge_shader_tree(src_dir, folder_name):
        folder_id = str(uuid.uuid4())
        dest_dir = os.path.join(PUBLIC_SHADER_FOLDER, folder_id)
        os.makedirs(dest_dir, exist_ok=True)

        children = []

        for root, _, files in os.walk(src_dir):
            for fn in files:
                if fn.endswith(".glsl"):
                    glsl_id = str(uuid.uuid4())
                    name = os.path.splitext(fn)[0]
                    shutil.copyfile(
                        os.path.join(root, fn),
                        os.path.join(dest_dir, f"{glsl_id}.glsl")
                    )
                    children.append({
                        "id": glsl_id,
                        "name": name,
                        "folderId": folder_id,
                        "path": f"/shader/{folder_id}/{glsl_id}.glsl"
                    })

        if children:
            SHADERS.append({
                "id": folder_id,
                "name": folder_name,
                "path": f"/shader/{folder_id}",
                "children": children
            })

    # ============================================================
    # Scan public/shader → neu aufbauen falls nötig
    # ============================================================
    @classmethod
    def _scan_shaders(cls):
        # Optional: Hier könnte man SHADERS aus vorhandenen public/shader-Dateien rekonstruieren
        pass

    @staticmethod
    def _shader_style(folder, filename):
        return os.path.join(PUBLIC_SHADER_FOLDER, folder, filename)