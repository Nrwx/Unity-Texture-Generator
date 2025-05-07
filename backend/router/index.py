from view.fonts_view import fonts_bp
from view.settings_view import settings_bp

def register_router(app):
    app.register_blueprint(fonts_bp, url_prefix='/fonts')
    app.register_blueprint(settings_bp, url_prefix='/settings')