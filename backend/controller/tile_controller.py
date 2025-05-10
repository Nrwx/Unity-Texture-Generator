from model.tile_model import TileModel
from config.api.parameter import PARAMETERS
from utils import parse_parameters

class TileController:
    @staticmethod
    def handle(form_data):
        params = parse_parameters(PARAMETERS['tile'], form_data)
        model = TileModel(**params)
        return jsonify(model.generate())
