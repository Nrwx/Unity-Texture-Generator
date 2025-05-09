import os, shutil, zipfile, uuid, tempfile
from flask import jsonify
from werkzeug.utils import secure_filename
from generated.paths import (
    ASSETS_FONT_FOLDER,
    PUBLIC_FONT_FOLDER,
)

FONTS = []

class FontsModel:

    @staticmethod
    def get_fonts():
        return FONTS

    @staticmethod
    def scan_fonts():
        scanned_fonts = []
        for dirpath, dirnames, filenames in os.walk(PUBLIC_FONT_FOLDER ):
            if dirpath != PUBLIC_FONT_FOLDER :
                folder_name = os.path.basename(dirpath)
                children = []
                existing_group = next((f for f in FONTS if f["id"] == folder_name), None)

                for fn in filenames:
                    if fn.lower().endswith(('.ttf', '.woff', '.otf')):
                        file_id = None
                        original_name = os.path.splitext(fn)[0]
                        filename = original_name

                        if existing_group:
                            match = next((c for c in existing_group["children"] if c["path"].endswith(f"/{fn}")), None)
                            if match:
                                file_id = match.get("id")
                                filename = match.get("filename", original_name)
                                original_name = match.get("name", filename)

                        if not file_id:
                            file_id = str(uuid.uuid4())

                        children.append({
                            'id': file_id,
                            'name': original_name,
                            'path': f"/font/{folder_name}/{fn}"
                        })

                if children:
                    scanned_fonts.append({
                        'id': folder_name,
                        'name': existing_group["name"] if existing_group else folder_name,
                        'path': f"/font/{folder_name}",
                        'favorite': existing_group["favorite"] if existing_group else False,
                        'children': children
                    })

        FONTS.clear()
        FONTS.extend(scanned_fonts)
        print(FONTS)
        return FONTS

    @staticmethod
    def copy_standard_assets():
        if not os.path.exists(PUBLIC_FONT_FOLDER ):
            os.makedirs(PUBLIC_FONT_FOLDER )

        if not os.listdir(PUBLIC_FONT_FOLDER ):
            for entry in os.listdir(ASSETS_FONT_FOLDER ):
                entry_path = os.path.join(ASSETS_FONT_FOLDER , entry)

                if zipfile.is_zipfile(entry_path):
                    with zipfile.ZipFile(entry_path, 'r') as zip_ref:
                        with tempfile.TemporaryDirectory() as temp_dir:
                            zip_ref.extractall(temp_dir)
                            FontsModel.process_font_folder(entry, temp_dir)

                elif os.path.isdir(entry_path):
                    FontsModel.process_font_folder(entry, entry_path)

    @staticmethod
    def process_font_folder(folder_name, src_dir):
        group_id = str(uuid.uuid4())
        dest_dir = os.path.join(PUBLIC_FONT_FOLDER , group_id)
        os.makedirs(dest_dir, exist_ok=True)

        children = []

        for dirpath, dirnames, filenames in os.walk(src_dir):
            for fn in filenames:
                if fn.lower().endswith(('.ttf', '.woff', '.otf')):
                    original_name = os.path.splitext(fn)[0]
                    ext = os.path.splitext(fn)[1]
                    file_id = str(uuid.uuid4())
                    new_filename = f"{file_id}{ext}"

                    shutil.copyfile(os.path.join(dirpath, fn), os.path.join(dest_dir, new_filename))

                    children.append({
                        'id': file_id,
                        'name': original_name,
                        'filename': original_name,
                        'path': f"/font/{group_id}/{new_filename}"
                    })

        if children:
            FONTS.append({
                'id': group_id,
                'name': folder_name,
                'path': f"/font/{group_id}",
                'favorite': False,
                'children': children
            })

    @staticmethod
    def initialize():
        FontsModel.copy_standard_assets()
        FontsModel.scan_fonts()

    @staticmethod
    def fetch_group(fid):
        group = next((g for g in FONTS if g['id'] == fid), None)
        return jsonify(group or {'error': 'Font group not found'}), (200 if group else 404)

    @staticmethod
    def upload_font_file(files):
        if 'file' not in files:
            return jsonify({'error': 'No file part'}), 400

        f = files['file']
        filename = secure_filename(f.filename)
        dest = os.path.join(PUBLIC_FONT_FOLDER , os.path.splitext(filename)[0])

        if os.path.isdir(dest):
            shutil.rmtree(dest)
        os.makedirs(dest, exist_ok=True)

        if filename.lower().endswith('.zip'):
            zip_path = os.path.join(dest, filename)
            f.save(zip_path)
            with zipfile.ZipFile(zip_path, 'r') as z:
                z.extractall(dest)
            os.remove(zip_path)
        else:
            f.save(os.path.join(dest, filename))

        return jsonify({'status': 'uploaded'})

    @staticmethod
    def update_group(data):
        fid = data.get('id')
        group = next((g for g in FONTS if g['id'] == fid), None)
        if not group:
            return jsonify({'error': 'Font group not found'}), 404
        group['favorite'] = bool(data.get('favorite', False))
        return jsonify(group)

    @staticmethod
    def delete_group(fid):
        group = next((g for g in FONTS if g['id'] == fid), None)
        if not group:
            return jsonify({'error': 'Font group not found'}), 404
        shutil.rmtree(os.path.join(PUBLIC_FONT_FOLDER , fid), ignore_errors=True)
        return jsonify({'status': 'deleted'})

    @staticmethod
    def get_font_path(folder):
        return os.path.join(PUBLIC_FONT_FOLDER , folder)
