# model/channel_model.py
import os
import uuid
from PIL import Image
from config.data.constant import LAYERS, CHANNELS
from model.base.main import BaseModel
from model.render_model import RenderModel
from generated.paths import PUBLIC_TEMP_CHANNEL_FOLDER
from components import generate_channels
from utils import time, get_img

class ChannelModel(BaseModel):
    CHANNEL_KEYS = ["red", "green", "blue", "alpha", "cyan", "grey", "combined"]

    # -------------------------------------------------------------
    # CHANNEL ENTRY BUILDER
    # -------------------------------------------------------------
    @classmethod
    def _generate_channel_entry(cls, channel_key, image, true_flag=True):
        map_id = str(uuid.uuid4())
        filename = f"{map_id}.png"

        os.makedirs(PUBLIC_TEMP_CHANNEL_FOLDER, exist_ok=True)
        path = os.path.join(PUBLIC_TEMP_CHANNEL_FOLDER, filename)
        image.save(path, "PNG", quality=100)

        thumb_url = RenderModel._thumbnail(map_id, path, size=64)

        entry = {
            "id": map_id,
            "url": f"/download/{filename}",
            "name": channel_key.capitalize(),
            "thumbnail": thumb_url,
            "key": channel_key,
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
        CHANNELS.clear()
        if ids:
            if not isinstance(ids, list):
                ids = [ids]
            layers_to_render = [l for l in LAYERS if l["id"] in ids]
        else:
            layers_to_render = [l for l in LAYERS if l.get("hidden", 0) != 1]

        base_image = RenderModel.preview(return_image=True, layer_id=ids)

        # Combined
        combined_entry = cls._generate_channel_entry("combined", base_image, true_flag=True)
        CHANNELS.append(combined_entry)

        # Standard RGB + Alpha
        tmp_channels = generate_channels(base_image)
        for key, img in tmp_channels.items():
            entry = cls._generate_channel_entry(key.lower(), img)
            CHANNELS.append(entry)

        # Cyan + Grey
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
        if ids:
            if not isinstance(ids, list):
                ids = [ids]
            target_layers = [l for l in LAYERS if l["id"] in ids]
        else:
            target_layers = LAYERS

        for layer in target_layers:
            cfg = layer.setdefault("channel", {})
            cfg[channel] = state
            RenderModel.preview(return_image=True, layer_id=layer["id"])

        return {
            "success": True,
            "message": f"toggle mode '{ids}' applied with channel: {channel} and state: {state}."
        }, 200

    # -------------------------------------------------------------
    # CHANNEL CRUD OPERATIONS
    # -------------------------------------------------------------
    @classmethod
    def create(cls, channel_key, image_id, layer_ids=None):
        """Fügt einen neuen Channel-Entry hinzu und speichert als ID im Layer"""
        try:
            img = get_img(image_id)
        except Exception as e:
            try:
                cls._log(str(e), "CHANNEL", "ERROR", "!")
            except Exception:
                pass
            return {"success": False, "message": "Channel image not found"}, 404

        entry = cls._generate_channel_entry(channel_key, img, true_flag=False)

        if layer_ids is None:
            target_layers = LAYERS
        else:
            target_layers = [l for l in LAYERS if l["id"] in layer_ids]

        for layer in target_layers:
            cfg = layer.setdefault("channel", {})
            cfg.setdefault("custom", {})
            cfg["custom"][entry["id"]] = False

        CHANNELS.append(entry)
        return entry, 200

    @classmethod
    def activate(cls, entry_id, key, layer_ids=None):
        """Aktiviert einen Channel-Entry für den Key und deaktiviert alte"""
        if key not in cls.CHANNEL_KEYS:
            return {"success": False, "message": "Invalid key"}, 400

        if layer_ids is None:
            target_layers = LAYERS
        else:
            target_layers = [l for l in LAYERS if l["id"] in layer_ids]

        for layer in target_layers:
            cfg = layer.setdefault("channel", {})
            # Deaktiviere alte
            for k in cls.CHANNEL_KEYS:
                if cfg.get(k) is True:
                    cfg[k] = False
            # Aktiviere neue
            cfg[key] = entry_id  # ID als Wert
            RenderModel.preview(return_image=True, layer_id=layer["id"])

        return {"success": True, "message": f"Entry {entry_id} activated as {key}"}, 200

    @classmethod
    def delete(cls, entry_id, layer_ids=None):
        """Löscht einen Channel-Entry aus allen oder spezifischen Layern"""
        if layer_ids is None:
            target_layers = LAYERS
        else:
            target_layers = [l for l in LAYERS if l["id"] in layer_ids]

        for layer in target_layers:
            cfg = layer.get("channel", {})
            if "custom" in cfg and entry_id in cfg["custom"]:
                del cfg["custom"][entry_id]
            for k in cls.CHANNEL_KEYS:
                if cfg.get(k) == entry_id:
                    cfg[k] = False
            RenderModel.preview(return_image=True, layer_id=layer["id"])

        global CHANNELS
        CHANNELS = [c for c in CHANNELS if c["id"] != entry_id]

        return {"success": True, "message": f"Entry {entry_id} deleted"}, 200

    # -------------------------------------------------------------
    # BUILD CONFIG OBJECT FROM LAYERS OR CHANNELS
    # -------------------------------------------------------------
    @classmethod
    def setting(cls, ids=None):
        config = {k: False for k in cls.CHANNEL_KEYS if k != "combined"}

        if ids:
            if not isinstance(ids, list):
                ids = [ids]
            layers_to_check = [l for l in LAYERS if l["id"] in ids]
        else:
            layers_to_check = [l for l in LAYERS if l.get("hidden", 0) != 1]

        for key in config.keys():
            config[key] = any(
                isinstance(layer.get("channel", {}).get(key), (str, bool))
                and layer["channel"][key] not in [False, None]
                for layer in layers_to_check
            )

        if layers_to_check:
            config["ids"] = [l["id"] for l in layers_to_check]

        return config, 200
