from view.fonts_view import router_fonts
from view.settings_view import router_settings

def register_router(app):
    app.register_blueprint(router_fonts, url_prefix='/fonts')
    app.register_blueprint(router_settings, url_prefix='/settings')