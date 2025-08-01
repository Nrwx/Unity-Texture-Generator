from model.export_model import ExportModel
from config.api.parameter import PARAMETERS
from utils import parse_parameters

class ExportController:

    METHOD_MAP = {
        "update": {
            "keys": {"mode", "quality", "type", "dpi", "title", "compress", "inlineCss", "paperSize", "landscape", "margin"},
            "function": ExportModel.update
        },
    }

    @classmethod
    def handle(cls, form):
        params = parse_parameters(PARAMETERS['export'], form)
        method = params.get('method')
        if method not in cls.METHOD_MAP:
            return {"error": "Invalid method"}, 400

        method_info = cls.METHOD_MAP[method]
        method_keys = method_info['keys']
        method_function = method_info['function']
        method_params = {key: params[key] for key in method_keys if key in params}
        return method_function(**method_params)