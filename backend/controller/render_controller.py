from model.render_model import RenderModel
from utils.api.parser import parse_parameters
from config.api.parameter import PARAMETERS

class RenderController:

    METHOD_MAP = {
        "text-path": {
            "keys": {"id", "write_svg"},
            "function": RenderModel.text_to_path
        },
    }

    @classmethod
    def handle(cls, form):
        params = parse_parameters(PARAMETERS['renderer'], form)
        method = params.get('method')
        if method not in cls.METHOD_MAP:
            return {"error": "Invalid method"}, 400

        method_info = cls.METHOD_MAP[method]
        method_keys = method_info['keys']
        method_function = method_info['function']
        method_params = {key: params[key] for key in method_keys if key in params}
        return method_function(**method_params)
