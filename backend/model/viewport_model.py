# model/viewport_model.py
from config.data.constant import ( VIEWPORT_CONFIG, CHANNELS, LAYERS )
from model.layer_model import LayerModel

class ViewportModel:

    @staticmethod
    def set_viewport(mode, width, height, title, layer_name):
        config = {
            "mode": mode,
            "width": width,
            "height": height,
            "title": title,
            "layer": layer_name
        }

        CHANNELS.clear()
        LAYERS.clear()
        VIEWPORT_CONFIG.clear()
        VIEWPORT_CONFIG.append(config)

        LayerModel.add(name=layer_name, path=None, id=None, type=0, width=width, height=height)

        return {"message": "Viewport set", "viewport": VIEWPORT_CONFIG}, 200