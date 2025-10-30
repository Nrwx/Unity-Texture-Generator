# model/fonts_model.py
import os, shutil, zipfile, uuid, tempfile
from flask import jsonify
from werkzeug.utils import secure_filename
from PIL import Image, ImageDraw, ImageFont
from model.base.main import BaseModel
from generated.paths import ASSETS_FONT_FOLDER, PUBLIC_FONT_FOLDER
from config.data.constant import FONTS

class FontsModel(BaseModel):

    @classmethod
    def initialize(cls):
        try:
            cls._copy_standard_assets()
            cls._scan_fonts()
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def fetch(cls):
        try:
            return FONTS, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def upload(cls, files):
        try:
            if "file" not in files:
                return {"error": "No file part"}, 400
            f = files["file"]
            filename = secure_filename(f.filename)
            dest = os.path.join(PUBLIC_FONT_FOLDER, os.path.splitext(filename)[0])
            if os.path.isdir(dest):
                shutil.rmtree(dest)
            os.makedirs(dest, exist_ok=True)

            if filename.lower().endswith(".zip"):
                zip_path = os.path.join(dest, filename)
                f.save(zip_path)
                with zipfile.ZipFile(zip_path, "r") as z:
                    z.extractall(dest)
                os.remove(zip_path)
            else:
                f.save(os.path.join(dest, filename))
            return {"status": "uploaded"}, 201
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def update(cls, data):
        try:
            fid = data.get("id")
            group = next((g for g in FONTS if g["id"] == fid), None)
            if not group:
                return {"error": "Font group not found"}, 404
            group["favorite"] = bool(data.get("favorite", False))
            return group, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def delete(cls, id):
        try:
            group = next((g for g in FONTS if g["id"] == id), None)
            if not group:
                return {"error": "Font group not found"}, 404
            shutil.rmtree(os.path.join(PUBLIC_FONT_FOLDER, id), ignore_errors=True)
            return {"status": "deleted"}, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def render(cls, layer):
        try:
            if layer.get("type") != 1:
                return None
            text = layer.get("text", "")
            font_id = layer.get("font")
            font_size = int(layer.get("fontSize", 20))
            color = layer.get("color", "#000000")
            width = int(layer.get("width", 200))
            height = int(layer.get("height", 50))

            font_path = None
            for group in FONTS:
                for child in group.get("children", []):
                    if child["id"] == font_id:
                        font_path = os.path.join(PUBLIC_FONT_FOLDER, group["id"], os.path.basename(child["path"]))
                        break
                if font_path:
                    break

            if not font_path:
                fallback_group = next((g for g in FONTS if g["name"] == "Microsoft Sans Serif.zip"), None)
                if fallback_group and fallback_group.get("children"):
                    fallback_child = fallback_group["children"][0]
                    font_path = os.path.join(PUBLIC_FONT_FOLDER, fallback_group["id"], os.path.basename(fallback_child["path"]))

            try:
                if font_path and os.path.exists(font_path):
                    font = ImageFont.truetype(font_path, font_size)
                else:
                    font = ImageFont.load_default()
            except Exception:
                font = ImageFont.load_default()

            img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            draw.text((0, 0), text, font=font, fill=color)
            return img
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def _copy_standard_assets(cls):
        try:
            os.makedirs(PUBLIC_FONT_FOLDER, exist_ok=True)
            if os.listdir(PUBLIC_FONT_FOLDER):
                return

            for entry in os.listdir(ASSETS_FONT_FOLDER):
                entry_path = os.path.join(ASSETS_FONT_FOLDER, entry)
                if zipfile.is_zipfile(entry_path):
                    with zipfile.ZipFile(entry_path, "r") as zip_ref:
                        with tempfile.TemporaryDirectory() as tmp_dir:
                            zip_ref.extractall(tmp_dir)
                            cls._process_font_folder(entry, tmp_dir)
                elif os.path.isdir(entry_path):
                    cls._process_font_folder(entry, entry_path)
        except Exception as e:
            return cls.handle_error(e)

    @staticmethod
    def _process_font_folder(folder_name, src_dir):
        group_id = str(uuid.uuid4())
        dest_dir = os.path.join(PUBLIC_FONT_FOLDER, group_id)
        os.makedirs(dest_dir, exist_ok=True)
        children = []

        for dirpath, _, filenames in os.walk(src_dir):
            for fn in filenames:
                if fn.lower().endswith(('.ttf', '.woff', '.otf')):
                    original_name = os.path.splitext(fn)[0]
                    ext = os.path.splitext(fn)[1]
                    file_id = str(uuid.uuid4())
                    new_filename = f"{file_id}{ext}"
                    shutil.copyfile(os.path.join(dirpath, fn), os.path.join(dest_dir, new_filename))
                    children.append({
                        "id": file_id,
                        "name": original_name,
                        "filename": original_name,
                        "path": f"/font/{group_id}/{new_filename}"
                    })

        if children:
            FONTS.append({
                "id": group_id,
                "name": folder_name,
                "path": f"/font/{group_id}",
                "favorite": False,
                "children": children
            })

    @staticmethod
    def _scan_fonts():
        scanned_fonts = []
        for dirpath, _, filenames in os.walk(PUBLIC_FONT_FOLDER):
            if dirpath == PUBLIC_FONT_FOLDER:
                continue
            folder_name = os.path.basename(dirpath)
            existing_group = next((f for f in FONTS if f["id"] == folder_name), None)
            children = []

            for fn in filenames:
                if fn.lower().endswith(('.ttf', '.woff', '.otf')):
                    file_id = str(uuid.uuid4())
                    original_name = os.path.splitext(fn)[0]
                    if existing_group:
                        match = next((c for c in existing_group.get("children", []) if c["path"].endswith(f"/{fn}")), None)
                        if match:
                            file_id = match.get("id", file_id)
                            original_name = match.get("name", original_name)
                    children.append({
                        "id": file_id,
                        "name": original_name,
                        "path": f"/font/{folder_name}/{fn}"
                    })

            if children:
                scanned_fonts.append({
                    "id": folder_name,
                    "name": existing_group.get("name", folder_name) if existing_group else folder_name,
                    "path": f"/font/{folder_name}",
                    "favorite": existing_group.get("favorite", False) if existing_group else False,
                    "children": children
                })

        FONTS.clear()
        FONTS.extend(scanned_fonts)
        return FONTS

    @staticmethod
    def _font_style(folder, filename):
        return os.path.join(PUBLIC_FONT_FOLDER, folder, filename)