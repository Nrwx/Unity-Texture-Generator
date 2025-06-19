from view.app_view import router_app
from view.fonts_view import router_fonts
from view.settings_view import router_settings
from view.tile_view import router_tile
from view.layer_view import router_layer
from view.viewport_view import router_viewport
from view.modifier_view import router_modifier
from view.backup_view import router_backup
from view.ai_view import router_ai

def register_router(app):
    app.register_blueprint(router_app, url_prefix='/')
    app.register_blueprint(router_viewport, url_prefix='/viewport')
    app.register_blueprint(router_fonts, url_prefix='/fonts')
    app.register_blueprint(router_settings, url_prefix='/settings')
    app.register_blueprint(router_layer, url_prefix='/layer')
    app.register_blueprint(router_tile, url_prefix='/tile')
    app.register_blueprint(router_modifier, url_prefix='/modifier')
    app.register_blueprint(router_backup, url_prefix="/backup")
    app.register_blueprint(router_ai, url_prefix="/ai/generateImage/")