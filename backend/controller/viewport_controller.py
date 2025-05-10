from model.viewport_model import ViewportModel
from utils.api.parser import parse_parameters
from config.api.parameter import PARAMETERS

class ViewportController:

    @staticmethod
    def handle(form):
        params = parse_parameters(PARAMETERS['viewport'], form)

        return ViewportModel.set_viewport(
            mode=params['mode'],
            width=params['width'],
            height=params['height'],
            title=params['title'],
            layer_name=params['layer']
        )