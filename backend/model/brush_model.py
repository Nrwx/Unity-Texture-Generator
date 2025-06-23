import os, uuid, shutil, zipfile, tempfile
from flask import jsonify
from generated.paths import ASSETS_BRUSH_FOLDER, PUBLIC_BRUSH_FOLDER
from config.data.constant import BRUSHES

class BrushModel:
    @staticmethod
    def get_brushes():
        return BRUSHES, 200

    @staticmethod
    def scan_styles():
        scanned = []
        for dirpath, _, files in os.walk(PUBLIC_BRUSH_FOLDER):
            if dirpath == PUBLIC_BRUSH_FOLDER:
                continue
            group_id = os.path.basename(dirpath)
            # Retrieve original name if available (e.g., from .zip folder names)
            existing_group = next((g for g in BRUSHES if g['id'] == group_id), None)
            group_name = existing_group.get('name') if existing_group else group_id

            items = []
            for f in files:
                if f.lower().endswith(('.jpg', '.png')):
                    item_id = str(uuid.uuid4())
                    items.append({
                        'id': item_id,
                        'name': os.path.splitext(f)[0],
                        'path': f"/{group_id}/{f}"
                    })
            if items:
                scanned.append({
                    'id': group_id,
                    'name': group_name,
                    'path': f"/{group_id}",
                    'children': items
                })
        BRUSHES.clear()
        BRUSHES.extend(scanned)
        print(BRUSHES)
        return BRUSHES

    @staticmethod
    def copy_standard_assets():
        if not os.path.exists(PUBLIC_BRUSH_FOLDER):
            os.makedirs(PUBLIC_BRUSH_FOLDER)
        if not os.listdir(PUBLIC_BRUSH_FOLDER):
            for entry in os.listdir(ASSETS_BRUSH_FOLDER):
                src = os.path.join(ASSETS_BRUSH_FOLDER, entry)
                group_name = os.path.splitext(entry)[0]
                if zipfile.is_zipfile(src):
                    with zipfile.ZipFile(src, 'r') as zip_ref:
                        with tempfile.TemporaryDirectory() as tmp:
                            zip_ref.extractall(tmp)
                            BrushModel.process_folder(group_name, tmp)
                elif os.path.isdir(src):
                    BrushModel.process_folder(group_name, src)

    @staticmethod
    def process_folder(name, src_dir):
        group_id = str(uuid.uuid4())
        dest = os.path.join(PUBLIC_BRUSH_FOLDER, group_id)
        os.makedirs(dest, exist_ok=True)
        children = []
        for root, _, files in os.walk(src_dir):
            for f in files:
                if f.lower().endswith(('.jpg','.png')):
                    new_id = str(uuid.uuid4())
                    ext = os.path.splitext(f)[1]
                    dst_name = f"{new_id}{ext}"
                    shutil.copyfile(os.path.join(root,f), os.path.join(dest,dst_name))
                    children.append({
                        'id': new_id,
                        'name': os.path.splitext(f)[0],
                        'path': f"/{group_id}/{dst_name}"
                    })
        if children:
            BRUSHES.append({ 'id': group_id, 'name': name, 'children': children })

    @staticmethod
    def initialize():
        BrushModel.copy_standard_assets()
        BrushModel.scan_styles()

    @staticmethod
    def fetch_group(gid):
        group = next((g for g in BRUSHES if g['id']==gid), None)
        return jsonify(group or {'error':'Not found'}), (200 if group else 404)

    @staticmethod
    def upload_style(files):
        if 'file' not in files:
            return jsonify({'error':'No file'}), 400
        f = files['file']
        fname = f.filename
        dest_folder = os.path.join(PUBLIC_BRUSH_FOLDER, os.path.splitext(fname)[0])
        if os.path.isdir(dest_folder): shutil.rmtree(dest_folder)
        os.makedirs(dest_folder)
        path = os.path.join(dest_folder, fname)
        f.save(path)
        return jsonify({'status':'uploaded'}), 201

    @staticmethod
    def delete_group(gid):
        group = next((g for g in BRUSHES if g['id']==gid), None)
        if not group:
            return jsonify({'error':'Not found'}), 404
        shutil.rmtree(os.path.join(PUBLIC_BRUSH_FOLDER, gid), ignore_errors=True)
        return jsonify({'status':'deleted'})

    @staticmethod
    def get_style_path(folder, filename):
        return os.path.join(PUBLIC_BRUSH_FOLDER, folder, filename)