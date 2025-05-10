from flask import Blueprint
from controller.app_controller import AppController

router_app = Blueprint('app', __name__)

@router_app.route('/')
def frontend_index():
    return AppController.serve_index()

@router_app.route('/<path:path>')
def static_file(path):
    return AppController.serve_static(path)

@router_app.route('/download/<filename>', methods=['GET'])
def download(filename):
    return AppController.download(filename)
