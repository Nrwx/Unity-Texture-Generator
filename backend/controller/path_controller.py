from model.path_model import PathModel
from utils.api.parser import parse_parameters
from config.api.parameter import PARAMETERS

class PathController:

    METHOD_MAP = {
        "add": {
            'keys': { "name", "width", "height", "edit", "id", "stroke", "strokeWidth", "strokeDash", "strokeDashType", "strokeDashArray", "fill", "fillOpacity", "points", "connections", "gradient", "closed" },
            'function': PathModel.add
        },
        "update": {
            'keys': { "name", "width", "height", "edit", "id", "stroke", "strokeWidth", "strokeDash", "strokeDashType", "strokeDashArray", "fill", "fillOpacity", "points", "connections", "gradient", "closed" },
            'function': PathModel.update
        },
        "delete": {
            "keys": {"id"},
            "function": PathModel.delete
        },
        "fetch": {
            "keys": {"id"},
            "function": PathModel.fetch
        },
    }

    @classmethod
    def handle(cls, form):
        params = parse_parameters(PARAMETERS['path'], form)
        method = params.get('method')
        if method not in cls.METHOD_MAP:
            return {"error": "Invalid method"}, 400

        method_info = cls.METHOD_MAP[method]
        method_keys = method_info['keys']
        method_function = method_info['function']
        method_params = {key: params[key] for key in method_keys if key in params}
        return method_function(**method_params)
