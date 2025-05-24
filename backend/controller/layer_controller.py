from model.layer_model import LayerModel
from config.api.parameter import PARAMETERS
from utils import parse_parameters

class LayerController:

    METHOD_MAP = {
        "add": {
            "keys": {"name", "type", "width", "height", "id"},
            "function": LayerModel.add
        },
        "addText": {
            'keys': {"type", "order", "name", "hidden", "opacity", "color", "fontFamily", "fontSize", "fontWeight", "initFontSize", "initHeight", "initWidth", "letterSpacing", "lineHeight", "text", "textAlign", "textDecoration", "textTransform", "width", "height", "x", "y"},
            'function': LayerModel.addText
        },
        "delete": {
            "keys": {"id"},
            "function": LayerModel.delete
        },
        "list": {
            "keys": {},
            "function": LayerModel.fetch
        },
        "update": {
            'keys': {"type", "name", "width", "height", "id", "a", "b", "c", "d", "x", "y", "rotate", "order", "hidden", "opacity", "blend_mode", "color", "mask"},
            'function': LayerModel.update
        },
        "preview": {
            'keys': {},
            'function': LayerModel.preview
        },
        "order": {
            'keys': {"id", "order"},
            'function': LayerModel.order
        },
        "hide": {
            'keys': {"id", "hidden"},
            'function': LayerModel.hide
        },
        "blend": {
            'keys': {"id", "blend_mode", "color"},
            'function': LayerModel.blend
        },
        "paste": {
            'keys': {"id"},
            'function': LayerModel.paste
        },
        "mask": {
            'keys': {"id", "id2"},
            'function': LayerModel.mask
        },
        "update:channel": {
            'keys': {},
            'function': LayerModel.channel
        },
    }

    @classmethod
    def handle(cls, form):
        params = parse_parameters(PARAMETERS['layer'], form)
        method = params.get('method')
        if method not in cls.METHOD_MAP:
            return {"error": "Invalid method"}, 400

        method_info = cls.METHOD_MAP[method]
        method_keys = method_info['keys']
        method_function = method_info['function']
        method_params = {key: params[key] for key in method_keys if key in params}
        return method_function(**method_params)

    @classmethod
    def fetch(cls):
        method_info = cls.METHOD_MAP['list']
        method_function = method_info['function']
        return method_function()