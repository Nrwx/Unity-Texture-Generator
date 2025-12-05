# model/channel_model.py
import os
import uuid
from PIL import Image
from config.data.constant import LAYERS, CHANNELS
from model.base.main import BaseModel
from model.render_model import RenderModel
from generated.paths import PUBLIC_TEMP_CHANNEL_FOLDER
from components import generate_channels
from utils import time

class ChannelModel(BaseModel):
    CHANNEL_KEYS = ["red", "green", "blue", "alpha", "cyan", "grey", "combined"]

    # -------------------------------------------------------------
    # CHANNEL ENTRY BUILDER
    # -------------------------------------------------------------
    @classmethod
    def _generate_channel_entry(cls, channel_key, image, true_flag=True):
        """
        Erzeugt EINEN Channel Eintrag.
        Nur der zutreffende Channel-Key wird als Bool gespeichert.
        combined ist ein normaler Channel-Eintrag (Originalbild).
        """
        map_id = str(uuid.uuid4())
        filename = f"{map_id}.png"

        os.makedirs(PUBLIC_TEMP_CHANNEL_FOLDER, exist_ok=True)
        path = os.path.join(PUBLIC_TEMP_CHANNEL_FOLDER, filename)
        image.save(path, "PNG", quality=100)

        thumb_url = RenderModel._thumbnail(map_id, path, size=64)

        titles = {
            "red": "Red",
            "green": "Green",
            "blue": "Blue",
            "alpha": "Alpha",
            "cyan": "Cyan",
            "grey": "Grey",
            "combined": "Combined"
        }

        entry = {
            "id": map_id,
            "url": f"/download/{filename}",
            "name": titles.get(channel_key, channel_key.capitalize()),
            "thumbnail": thumb_url,
            "time": time('unix_ms'),
            "width": image.width,
            "height": image.height,
            channel_key: true_flag
        }

        return entry

    # -------------------------------------------------------------
    # EXTRACT SINGLE CHANNEL
    # -------------------------------------------------------------
    @classmethod
    def _extract_channel_from_image(cls, img, channel_key):
        if img is None:
            return None

        base = img.convert("RGBA")
        r, g, b, a = base.split()

        if channel_key == "red": return r
        if channel_key == "green": return g
        if channel_key == "blue": return b
        if channel_key == "alpha": return a
        if channel_key == "grey": return base.convert("L")

        if channel_key == "cyan":
            cmyk = base.convert("CMYK")
            c, _, _, _ = cmyk.split()
            return c

        return base

    # -------------------------------------------------------------
    # BUILD CHANNELS ARRAY
    # -------------------------------------------------------------
    @classmethod
    def fetch(cls, ids=None):
        """
        Generiert CHANNELS Array für Frontend.
        - ids: Liste von Layer-IDs, falls nur bestimmte Layer berücksichtigt werden sollen.
        - Wenn ids=None, werden alle sichtbaren Layer verwendet (global).
        """
        CHANNELS.clear()

        # Layer Auswahl
        if ids:
            if not isinstance(ids, list):
                ids = [ids]
            layers_to_render = [l for l in LAYERS if l["id"] in ids]
        else:
            layers_to_render = [l for l in LAYERS if l.get("hidden", 0) != 1]

        # Render Basisbild
        base_image = RenderModel.preview(return_image=True, layer_id=ids)

        # ---------------------------------------------------------
        # 1) COMBINED — immer das Originalbild
        # ---------------------------------------------------------
        combined_entry = cls._generate_channel_entry("combined", base_image, true_flag=True)
        CHANNELS.append(combined_entry)

        # ---------------------------------------------------------
        # 2) Standard RGB + Alpha Channel
        # ---------------------------------------------------------
        tmp_channels = generate_channels(base_image)  # returns dict red/green/blue/alpha
        for key, img in tmp_channels.items():
            entry = cls._generate_channel_entry(key.lower(), img)
            CHANNELS.append(entry)

        # ---------------------------------------------------------
        # 3) CYAN + GREY nur, wenn Layer aktiv (basierend auf ids oder global)
        # ---------------------------------------------------------
        for key in ["cyan", "grey"]:
            active_layers = [l for l in layers_to_render if l.get("channel", {}).get(key)]
            if active_layers:
                ch_img = cls._extract_channel_from_image(base_image.copy(), key)
                entry = cls._generate_channel_entry(key, ch_img, true_flag=True)
                CHANNELS.append(entry)

        return CHANNELS, 200


    # -------------------------------------------------------------
    # GLOBAL TOGGLE / OPTIONAL LAYER IDS
    # -------------------------------------------------------------
    @classmethod
    def toggle(cls, channel, state, ids=None):
        """
        Setzt einen Channel global oder nur für bestimmte Layer.
        - channel_name: Name des Channels (z.B. "red")
        - state: True/False
        - ids: Liste von Layer-IDs, falls nur bestimmte Layer geändert werden sollen. None = global
        """
        if ids:
            if not isinstance(ids, list):
                ids = [ids]
            target_layers = [l for l in LAYERS if l["id"] in ids]
        else:
            target_layers = LAYERS

        for layer in target_layers:
            cfg = layer.get("channel", {})
            if channel in cfg:
                cfg[channel] = state
                RenderModel.preview(return_image=True, layer_id=layer["id"])

        # CHANNELS neu generieren, optional nur für die angegebenen ids
        return {
            "success": True,
            "message": f"toggle mode '{ids}' applied with channel: {channel} and state: {state}."
        }, 200

    # -------------------------------------------------------------
    # BUILD CONFIG OBJECT FROM LAYERS OR CHANNELS
    # -------------------------------------------------------------
    @classmethod
    def setting(cls, ids=None):
        """
        Erstellt ein vollständiges Config-Objekt basierend auf Layer-Einstellungen.
        - ids: Liste von Layer-IDs, nur diese Layer werden geprüft.
        - Wenn ids=None, werden alle sichtbaren Layer geprüft.
        - Jeder Channel-Key (außer 'combined') ist im Ergebnis enthalten und True,
          wenn mindestens ein Layer diesen aktiviert hat.
        """
        config = {k: False for k in cls.CHANNEL_KEYS if k != "combined"}

        if ids:
            if not isinstance(ids, list):
                ids = [ids]
            layers_to_check = [l for l in LAYERS if l["id"] in ids]

            for key in config.keys():
                config[key] = any(layer.get("channel", {}).get(key, False) for layer in layers_to_check)

            if layers_to_check:
                config["ids"] = [l["id"] for l in layers_to_check]

        else:
            # Prüfe alle sichtbaren Layer
            layers_to_check = [l for l in LAYERS if l.get("hidden", 0) != 1]

            for key in config.keys():
                config[key] = any(layer.get("channel", {}).get(key, False) for layer in layers_to_check)

        return config, 200
