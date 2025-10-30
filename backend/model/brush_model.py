# model/brush_model.py
import os, uuid, shutil, zipfile, tempfile
from flask import jsonify, send_file
from model.base.main import BaseModel
from generated.paths import ASSETS_BRUSH_FOLDER, PUBLIC_BRUSH_FOLDER
from config.data.constant import BRUSHES
from components import generate_thumbnail_map

class BrushModel(BaseModel):
    @classmethod
    def initialize(cls):
        try:
            cls._copy_standard_assets()
            cls._scan_styles()
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def fetch(cls):
        try:
            return cls._render()
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def upload(cls, files):
        try:
            if 'file' not in files:
                return {'error': 'No file'}, 400
            f = files['file']
            fname = f.filename
            dest_folder = os.path.join(PUBLIC_BRUSH_FOLDER, os.path.splitext(fname)[0])
            if os.path.isdir(dest_folder):
                shutil.rmtree(dest_folder)
            os.makedirs(dest_folder, exist_ok=True)
            path = os.path.join(dest_folder, fname)
            f.save(path)
            return {'status': 'uploaded'}, 201
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def delete(cls, gid):
        try:
            group = next((g for g in BRUSHES if g['id'] == gid), None)
            if not group:
                return {'error': 'Not found'}, 404
            shutil.rmtree(os.path.join(PUBLIC_BRUSH_FOLDER, gid), ignore_errors=True)
            return {'status': 'deleted'}, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def _copy_standard_assets(cls):
        try:
            os.makedirs(PUBLIC_BRUSH_FOLDER, exist_ok=True)
            if not os.listdir(PUBLIC_BRUSH_FOLDER):
                for entry in os.listdir(ASSETS_BRUSH_FOLDER):
                    src = os.path.join(ASSETS_BRUSH_FOLDER, entry)
                    group_name = os.path.splitext(entry)[0]
                    if zipfile.is_zipfile(src):
                        with zipfile.ZipFile(src, 'r') as zip_ref, tempfile.TemporaryDirectory() as tmp:
                            zip_ref.extractall(tmp)
                            cls._process_folder(group_name, tmp)
                    elif os.path.isdir(src):
                        cls._process_folder(group_name, src)
        except Exception as e:
            return cls.handle_error(e)

    @staticmethod
    def _scan_styles():
        scanned = []
        for dirpath, _, files in os.walk(PUBLIC_BRUSH_FOLDER):
            if dirpath == PUBLIC_BRUSH_FOLDER:
                continue
            group_id = os.path.basename(dirpath)
            existing_group = next((g for g in BRUSHES if g['id'] == group_id), None)
            group_name = existing_group.get('name') if existing_group else group_id

            items = []
            for f in files:
                if f.lower().endswith(('.jpg', '.png')):
                    item_id = str(uuid.uuid4())
                    file_path = os.path.join(PUBLIC_BRUSH_FOLDER, group_id, f)
                    items.append({
                        'id': item_id,
                        'name': os.path.splitext(f)[0],
                        'path': f"/{group_id}/{f}",
                        'thumbnail': generate_thumbnail_map(item_id, path=file_path, size=64, image=None)
                    })
            if items:
                scanned.append({'id': group_id, 'name': group_name, 'path': f"/{group_id}", 'children': items})

        BRUSHES.clear()
        BRUSHES.extend(scanned)
        return BRUSHES, 200

    @staticmethod
    def _process_folder(name, src_dir):
        group_id = str(uuid.uuid4())
        dest = os.path.join(PUBLIC_BRUSH_FOLDER, group_id)
        os.makedirs(dest, exist_ok=True)
        children = []
        for root, _, files in os.walk(src_dir):
            for f in files:
                if f.lower().endswith(('.jpg', '.png')):
                    new_id = str(uuid.uuid4())
                    ext = os.path.splitext(f)[1]
                    dst_name = f"{new_id}{ext}"
                    shutil.copyfile(os.path.join(root, f), os.path.join(dest, dst_name))
                    children.append({'id': new_id, 'name': os.path.splitext(f)[0], 'path': f"/{group_id}/{dst_name}"})
        if children:
            BRUSHES.append({'id': group_id, 'name': name, 'children': children})

    @staticmethod
    def _brush_style(folder, filename):
        return os.path.join(PUBLIC_BRUSH_FOLDER, folder, filename)

    @staticmethod
    def _render():
        return BRUSHES, 200