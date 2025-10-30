# model/viewport_model.py
import uuid
from model.base.main import BaseModel
from config.data.constant import VIEWPORT_CONFIG, CHANNELS, LAYERS, BACKUP
from model.layer_model import LayerModel

class ViewportModel(BaseModel):
    """
    ViewportModel: zentrale Steuerung des Viewports.
    Setzt die Dimensionen, Mode und initialen Layer.
    """

    @staticmethod
    def set_viewport(mode, width, height, title, unit, dpi, sync, layer):
        config = {
            "id": str(uuid.uuid4()),
            "mode": mode,
            "width": width,
            "height": height,
            "unit": unit,
            "dpi": dpi,
            "sync": sync,
            "title": title
        }

        # Reset aller globalen States
        BACKUP.clear()
        CHANNELS.clear()
        LAYERS.clear()
        VIEWPORT_CONFIG.clear()
        VIEWPORT_CONFIG.append(config)

        # Initial-Layer hinzufügen
        LayerModel.add(name=layer, path=None, id=None, type=0, width=width, height=height)

        return {"message": "Viewport set", "viewport": VIEWPORT_CONFIG[0]}, 200

    @staticmethod
    def fetch():
        return VIEWPORT_CONFIG[0], 200