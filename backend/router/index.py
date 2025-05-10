from view.fonts_view import router_fonts
from view.settings_view import router_settings
from view.tile_view import router_tile
from view.layer_view import router_layer
from view.viewport_view import router_viewport

def register_router(app):
    app.register_blueprint(router_viewport, url_prefix='/viewport')
    app.register_blueprint(router_fonts, url_prefix='/fonts')
    app.register_blueprint(router_settings, url_prefix='/settings')
    app.register_blueprint(router_layer, url_prefix='/layer')
    app.register_blueprint(router_tile, url_prefix='/tile')