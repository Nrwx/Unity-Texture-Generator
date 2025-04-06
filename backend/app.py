from flask import Flask, request, jsonify, send_file, send_from_directory
from PIL import Image, ImageOps, ImageFilter, ImageEnhance
import numpy as np
import os
import shutil
import io
import math
import cv2
import uuid
from werkzeug.utils import secure_filename
from config.app.app_settings import ANIMATION_SETTINGS, get_app_settings, save_app_settings

from components import (
    generate_diffuse_map,
    generate_normal_map,
    generate_specular_map,
    generate_bump_map,
    generate_light_map,
    generate_alpha_map,
    generate_stone_map,
    generate_grass_map,
    apply_cut_out,
    apply_color,
    apply_crop_image,
    apply_blend_edges,
    apply_brightness_contrast,
    apply_shift_tiles,
    apply_tile_image,
    apply_brightness_contrast,
    apply_color_shift,
    apply_noise,
    apply_random_shift,
    apply_blur,
    apply_sharpness,
    apply_invert_colors,
    apply_blend_edges,
    apply_edge_detection,
    apply_rotation,
    apply_hue_rotation,
    apply_color_lookup,
    texture_projection,
)

from utils import (
    apply_rgb_rgba,
    apply_alpha,
)

# Initialising
app = Flask(__name__)
PUBLIC_FOLDER = "public"
if os.path.exists(PUBLIC_FOLDER):
    shutil.rmtree(PUBLIC_FOLDER)

# Ordner für temporäre Dateien
UPLOAD_FOLDER = os.path.join(PUBLIC_FOLDER, "upload")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

LAYER_FOLDER = os.path.join(PUBLIC_FOLDER, "layer")
os.makedirs(LAYER_FOLDER, exist_ok=True)

SOURCE_FOLDER = os.path.join(PUBLIC_FOLDER, "backup")
os.makedirs(SOURCE_FOLDER, exist_ok=True)

# Definition der Eingabeparameter und deren Standardwerte
PARAMETERS = {
    "viewport": {
        "mode": {"type": int, "default": 1},
        "width": {"type": int, "default": 2048},
        "height": {"type": int, "default": 2048},
        "title": {"type": str, "default": "Unknown"},
        "layer": {"type": str, "default": "Layer"},
    },
    "upload": {
        # STANDARD METHODS PARAMS START
        "selectedMaps": {"type": list, "default": []},
        "cropLeft": {"type": int, "default": 0},
        "cropTop": {"type": int, "default": 0},
        "cropRight": {"type": int, "default": 0},
        "cropBottom": {"type": int, "default": 0},
        "method": {"type": int, "default": 0},
        "output_format": {"type": str, "default": "PNG"},
        "quality": {"type": int, "default": 80},
        "editFile": {"type": str, "default": ""},
        # STANDARD METHODS PARAMS END

        # BOOL HANDLER START
        "edge_detection": {"type": bool, "default": False},
        "invert_colors": {"type": bool, "default": False},
        # BOOL HANDLER END

        # BLUR PARAMS START
        "blur": {"type": float, "default": 0.5},
        "blur_mode": {"type": int, "default": 1},  # Gaussian Blur
        "blur_radius": {"type": float, "default": 50.0},  # Radius für radiale und quadratische Modi
        "blur_type": {"type": int, "default": 1},  # 1 = Inner, 2 = Outer
        "blur_center": {"type": tuple, "default": (0.5, 0.5)},  # Normalisierter Mittelpunkt des Effekts (Proportionen: 0.0 bis 1.0)
        "blur_falloff_mode": {"type": int, "default": 1},  # 1 = Linear, 2 = Exponential, 3 = Logarithmic, 4 = Quadratic, 5 = Cubic
        "blur_falloff_strength": {"type": float, "default": 1.0},  # Stärke des Falloff
        "blur_channel_weights": {"type": list, "default": [1.0, 1.0, 1.0]},  # Gewichtung der RGB-Kanäle
        "blur_iterations": {"type": int, "default": 1},  # Anzahl der Effektwiederholungen
        "blur_edge_sensitivity": {"type": float, "default": 0.5},  # Empfindlichkeit für Ränder (bei blur_edges)
        "blur_harmonic_strength": {"type": float, "default": 1.0},  # Stärke des harmonischen Blurs
        "blur_motion_angle": {"type": float, "default": 0.0},  # Winkel der Bewegungsunschärfe (0 = horizontal)
        "blur_direction": {"type": tuple, "default": (1.0, 0.0)},  # Richtung der Bewegungsunschärfe (Vektor)
        "blur_fisheye_strength": {"type": float, "default": 1.0},  # Stärke des FishEye-Effekts
        "blur_randomness": {"type": float, "default": 0.0},  # Zufälligkeit der Unschärfe
        "blur_transition_width": {"type": float, "default": 0.1},  # Übergangsbreite bei blur_edges
        "blur_boost": {"type": float, "default": 1.0},  # Verstärkung des Effekts
        "blur_lightness_limit": {"type": float, "default": 1.0},  # Begrenzung der Helligkeit durch den Effekt
        # BLUR PARAMS END

        # COLOR PARAMS START
        "color_overlay": {"type": str, "default": "#000000"},
        "color_overlay_mode": {"type": int, "default": 1},
        "color_lookup": {"type": int, "default": 0},
        "color_shift": {"type": int, "default": 0},
        "hue_variation": {"type": int, "default": 0},
        # COLOR PARAMS END

        # EDIT PARAMS START
        "cut_out": {"type": int, "default": 0},
        # EDIT PARAMS END

        # NOISE PARAMS START
        "noise_level": {"type": int, "default": 0},
        # NOISE PARAMS END

        # SIMULATE PARAMS START
        "simulate_mode": {"type": int, "default": 0},
        "amplitude": {"type": int, "default": 50},
        "frame_count": {"type": int, "default": 1},
        "frequency": {"type": float, "default": 0},
        "phase_shift": {"type": float, "default": 0},
        "amplitude_multiplier": {"type": float, "default": 0},
        "wave_type": {"type": int, "default": 0},
        # SIMULATE PARAMS END

        "blending_intensity": {"type": float, "default": 0.5},
        "gradient_intensity": {"type": float, "default": 0.0},

        "opacity": {"type": float, "default": 0.7},
        "brightness": {"type": float, "default": 0.0},
        "sharpness": {"type": float, "default": 0.0},
        "smoothness": {"type": float, "default": 0.7},
        "contrast": {"type": float, "default": 100.0},
        "base_brightness": {"type": float, "default": 0.0},
        "base_contrast": {"type": float, "default": 0.0},
        "base_sharpness": {"type": float, "default": 0.0},
        "base_smoothness": {"type": float, "default": 0.7},
        "base_contrast": {"type": float, "default": 100.0},
        "base_opacity": {"type": float, "default": 0.7},
        # FILTER AND COLOR PARAMS END

        # IMAGE ADJUSTING PARAMS START
        "intensity": {"type": int, "default": 0},
        "radius": {"type": int, "default": 1},
        "max_shift_ratio": {"type": float, "default": 0.1},
        "shift_x": {"type": float, "default": 0.1},
        "shift_y": {"type": float, "default": 0.1},
        "border_width": {"type": int, "default": 10},
        "stone_size": {"type": int, "default": 10},
        "stone_variance": {"type": float, "default": 0.5},
        "density": {"type": float, "default": 0.5},
        "rotation_angle": {"type": float, "default": 0.0},
        "fade_edges": {"type": float, "default": 0.0},
        "tile_size": {"type": int, "default": None},
        "tile_x": {"type": int, "default": 6},
        "tile_y": {"type": int, "default": 6},
        "base_tile_x": {"type": int, "default": 4},
        "base_tile_y": {"type": int, "default": 4},
        "base_fade_alpha": {"type": float, "default": 0.1},
        "fade_alpha": {"type": float, "default": 0.1},
        "randomness": {"type": float, "default": 0.2},
        # IMAGE ADJUSTING PARAMS END
    },
    "tile": {
        "diffuse_image_url": {"type": str, "required": True},
        "tile_x": {"type": int, "default": 1},
        "tile_y": {"type": int, "default": 1},
    },
    "layer": {
        "method": {"type": str, "required": True},
        "name": {"type": str, "default": ""},
        "width": {"type": int, "default": 1024},
        "height": {"type": int, "default": 1024},
        "id": {"type": str, "default": ""},
        "url": {"type": str, "default": ""},
        "a": {"type": float, "default": 1},
        "b": {"type": float, "default": 0},
        "c": {"type": float, "default": 0},
        "d": {"type": float, "default": 1},
        "x": {"type": int, "default": 0},
        "y": {"type": int, "default": 0},
        "rotate": {"type": float, "default": 0},
        "order": {"type": int, "default": 0},
    },
}

@app.route('/')
def serve_frontend():
    return send_from_directory('../frontend/dist', 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):
    return send_from_directory('../frontend/dist', path)

@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    file_paths = [os.path.join(LAYER_FOLDER, filename), os.path.join(UPLOAD_FOLDER, filename)]

    for file_path in file_paths:
        if os.path.exists(file_path):
            return send_file(file_path, mimetype='image/png')

    return jsonify({"error": "File not found"}), 404

viewportConfig = []
@app.route('/viewport', methods=['POST'])
def viewportCanvas():
    try:
        params = parse_parameters(PARAMETERS['viewport'], request.form)

        # Layer hinzufügen
        config = {
            "mode": params['mode'],
            "width": params['width'],
            "height": params['height'],
            "title": params['title'],
            "layer": params['layer']
        }
        viewportConfig.append(config)
        print(viewportConfig)

        add_layer(name=params['layer'], path=None, id=None, width=params['width'], height=params['height'])

        return jsonify({"message": "Viewport set", "viewport": viewportConfig}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        params = parse_parameters(PARAMETERS['upload'], request.form)

        image = None  # Standardwert für den Fall, dass keine Datei gefunden wird

        # Datei aus dem Upload-Parameter prüfen
        if "file" in request.files:
            file = request.files['file']
            image = Image.open(file.stream)

            # Überprüfen, ob das Bild RGBA ist, und konvertieren
            image, alpha = apply_rgb_rgba(image)

        # Datei aus dem EditFile-Parameter prüfen
        elif params.get("editFile", "").strip():
            url = str(request.form.get('editFile', ""))
            diffuse_image_path = os.path.join(LAYER_FOLDER, os.path.basename(url))

            if not os.path.exists(diffuse_image_path):
                raise FileNotFoundError(f"File not found: {diffuse_image_path}")

            image = Image.open(diffuse_image_path)

            # Überprüfen, ob das Bild RGBA ist, und konvertieren
            image, alpha = apply_rgb_rgba(image)

        # Keine gültige Datei gefunden
        if image is None:
            raise ValueError("No valid file provided in 'file' or 'editFile' parameters.")

        cropped_image = apply_crop_image(
            image, params["cropLeft"], params["cropTop"], params["cropRight"], params["cropBottom"]
        )

        method_function_map = {
            0: {
                'keys': {"color_overlay", "color_overlay_mode", "invert_colors",
                         "color_shift", "hue_variation"},
                'function': apply_color_adjustments
            },
            1: {
                'keys': {"brightness", "contrast", "sharpness", "edge_detection"},
                'function': apply_brightness_contrast_adjustments
            },
            2: {
                'keys': {"blur", "blur_mode", "blur_radius", "blur_falloff_mode", "blur_type", "noise_level"},
                'function': apply_fx_adjustments
            },
            3: {
                'keys': {"color_lookup"},
                'function': apply_beauty_adjustments
            },
            4: {
                'keys': {"editing_mode"},
                'function': apply_edits
            },
            5: {
                'keys': {"stone_size", "density", "intensity", "stone_variance"},
                'function': generate_stone_map
            },
            6: {
                'keys': {"simulate_mode", "frame_count", "amplitude", "frequency", "phase_shift", "amplitude_multiplier", "wave_type"},
                'function': apply_motion_projection
            }

        }


        # Methode auslesen
        method = params.get('method')
        if method not in method_function_map:
            return jsonify({"error": "Invalid method"}), 400

        method_info = method_function_map[method]
        method_keys = method_info['keys']
        method_function = method_info['function']

        # Parameter für die Methode extrahieren
        method_params = {key: params[key] for key in method_keys if key in params}

        print(method_params)

        # Bildverarbeitung mit der entsprechenden Methode
        processed_image = method_function(cropped_image, **method_params)

        # Den Alpha-Kanal wieder hinzufügen, falls vorhanden
        processed_image = apply_alpha(processed_image, alpha)

        # Prüfen, ob das Ergebnis eine Animation (Liste von Frames) ist
        if isinstance(processed_image, list):
            # Animation: Liste von Frames als JSON serialisieren
            animation_frames = []
            for idx, frame in enumerate(processed_image):
                if isinstance(frame, Image.Image):  # Sicherstellen, dass jedes Frame ein Pillow Image ist
                    map_id = str(uuid.uuid4())
                    map_name = f"frame_{idx}"
                    map_filename = f"{map_id}.png"
                    map_path = os.path.join(UPLOAD_FOLDER, map_filename)

                    # Speichern jedes Frames
                    frame.save(map_path, format=params.get("output_format", "PNG"), quality=params.get("quality", 90))

                    # Hinzufügen zur Animation
                    animation_frames.append({
                        "type": f"Frame {idx}",
                        "url": f"/download/{map_filename}",
                    })

                    add_layer(map_name, map_path, map_id)

            return jsonify({"animationFrames": animation_frames})

        else:
            # Karten basierend auf dem Hauptbild erstellen
            map_functions = {
                "Diffuse Map": generate_diffuse_map,
                "Normal Map": generate_normal_map,
                "Specular Map": generate_specular_map,
                "Bump Map": generate_bump_map,
                "Light Map": generate_light_map,
                "Alpha Map": generate_alpha_map,
            }

            additional_maps = []
            for map_type in params["selectedMaps"]:
                map_type = map_type.strip()
                if map_type in map_functions:
                    # Karte basierend auf dem Hauptbild erstellen
                    map_image = map_functions[map_type](processed_image)

                    # UUID für Dateinamen
                    map_id = str(uuid.uuid4())
                    map_name = map_type
                    map_filename = f"{map_id}.png"
                    map_path = os.path.join(UPLOAD_FOLDER, map_filename)

                    # Speichern der Datei
                    map_image.save(map_path, format=params["output_format"], quality=params["quality"])

                    additional_maps.append({
                        "type": map_type,
                        "url": f"/download/{map_filename}",
                    })

                    add_layer(map_name, map_path, map_id)

            return jsonify({
                "additionalMaps": additional_maps
            })

    except Exception as e:
        print(f"Fehler beim Hochladen der Datei: {str(e)}")  # Fehler im Terminal ausgeben
        return jsonify({"error": str(e)}), 500

@app.route('/tile', methods=['POST'])
def tile_image_endpoint():
    try:
        url = str(request.form.get('diffuse_image_url', ""))
        tile_x = int(request.form.get('tile_x', 1))
        tile_y = int(request.form.get('tile_y', 1))

        # Diffuse-Bildpfad prüfen
        diffuse_image_path = os.path.join(LAYER_FOLDER, os.path.basename(url))
        if not os.path.exists(diffuse_image_path):
            raise FileNotFoundError(f"File not found: {diffuse_image_path}")

        # Bild laden
        image = Image.open(diffuse_image_path)

        # Kachelbild erstellen
        tiled_image = apply_tile_image(image, tile_x, tile_y)

        # UUID für Dateinamen
        file_uuid = uuid.uuid4().hex
        tiled_filename = f"tiled_image_{file_uuid}.png"
        tiled_path = os.path.join(LAYER_FOLDER, tiled_filename)

        # Speichern
        tiled_image.save(tiled_path, format="PNG")

        return jsonify({"url": f"/download/{tiled_filename}"})
    except Exception as e:
        print(f"Fehler: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/settings', methods=['GET', 'POST'])
def apply_app_settings():
    if request.method == 'GET':
        # Liefere aktuelle Einstellungen
        return jsonify(get_app_settings())

    if request.method == 'POST':
        # Neue Einstellungen übernehmen
        new_settings = request.json
        if not new_settings:
            return jsonify({"error": "Keine Daten übermittelt"}), 400

        # Versuche, die Einstellungen zu aktualisieren
        try:
            updated_settings = update_animation_settings(new_settings)

            # Speichern der neuen Einstellungen
            save_app_settings(updated_settings)

            # ANIMATION_SETTINGS nach dem Speichern aktualisieren
            global ANIMATION_SETTINGS
            ANIMATION_SETTINGS = updated_settings

            # Rückmeldung mit den neuen Einstellungen
            return jsonify({"success": True, "updated_settings": updated_settings})

        except Exception as e:
            return jsonify({"error": str(e)}), 500


def update_animation_settings(new_settings):
    """Aktualisiere die Animationseinstellungen mit den neuen Werten."""
    updated_settings = get_app_settings().copy()  # Kopiere die aktuellen Einstellungen

    updated_settings["use_gpu"] = bool(new_settings.get("use_gpu", updated_settings["use_gpu"]))
    updated_settings["cpu_threads"] = int(new_settings.get("cpu_threads", updated_settings["cpu_threads"]))
    updated_settings["preferred_unit"] = new_settings.get("preferred_unit", updated_settings["preferred_unit"])

    return updated_settings

def parse_parameters(params_section, form):
    parsed_params = {}
    for key, config in params_section.items():
        value = form.get(key, None)
        if value is None:
            if config.get("required"):
                raise ValueError(f"Parameter '{key}' is required")
            parsed_params[key] = config.get("default")
        else:
            if config["type"] == list:
                parsed_params[key] = value.split(',')
            elif config["type"] == bool:
                parsed_params[key] = value.lower() == 'true'
            else:
                parsed_params[key] = config["type"](value)
    return parsed_params

layers = []
default_matrix = {
    "a": 1,
    "b": 0,
    "c": 0,
    "d": 1,
    "x": 0,
    "y": 0,
    "rotate": 0,
}
# Funktionen für Layer-Management
def add_layer(name="", path="", id="", width=1024, height=1024):
    try:
        source_id = str(uuid.uuid4())  # UUID für die Source-Datei
        source_path = os.path.join(SOURCE_FOLDER, f"{source_id}.png")
        viewport_width = viewportConfig[0]["width"]  # Base Width
        viewport_height = viewportConfig[0]["height"]  # Base Height

        if not id:  # Falls keine ID übergeben wurde, neue generieren
            id = str(uuid.uuid4())  # Neue UUID v4 generieren
            path = os.path.join(LAYER_FOLDER, f"{id}.png")
            img = Image.new("RGBA", (width, height), (0, 0, 0, 0))  # Leeres PNG erzeugen
        else:  # Falls ID übergeben wurde, bestehendes Bild laden
            img = Image.open(path)
            width, height = img.size

        # Zuerst das Backup der Originaldatei speichern
        img.save(source_path)
        # Skalierungsfaktor berechnen
        scale_factor = min(viewport_width / width, viewport_height / height)
        image_path = os.path.join(LAYER_FOLDER, f"{id}.png")
        # Falls Skalierung notwendig ist
        if scale_factor < 1:
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)

            # Bild proportional skalieren (aber Original bleibt erhalten)
            scaled_img = img.resize((new_width, new_height), Image.LANCZOS)

            # Skaliertes Bild speichern
            scaled_img.save(image_path)
        else:
            # Falls keine Skalierung notwendig ist, das Original einfach kopieren
            img.save(image_path)

        # Layer hinzufügen
        layer = {
            "id": id,
            "name": name,
            "width": new_width if scale_factor < 1 else width,
            "height": new_height if scale_factor < 1 else height,
            "url": f"/download/{id}.png",
            "matrix": default_matrix,
            "source": source_id,
            "order": len(layers)
        }
        layers.append(layer)
        print(layers)
        return jsonify(layer), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def update_layer(name, width, height, id, a, b, c, d, x, y, rotate, order):
    try:
        layer = next((l for l in layers if l["id"] == id), None)
        if not layer:
            return jsonify({"error": "Layer not found"}), 404

        matrix = {
            "a": a,  # Skalierung X
            "b": b,  # Rotation / Verzerrung
            "c": c,  # Rotation / Verzerrung
            "d": d,  # Skalierung Y
            "x": x,  # Position X
            "y": y,  # Position Y
            "rotate": rotate  # Rotation in Grad
        }

        if name:
            layer["name"] = name
        if width:
            layer["width"] = width
        if height:
            layer["height"] = height
        if id:
            layer["id"] = id
        if matrix:
            layer["matrix"] = matrix
        if order:
            layer["order"] = order

        print(layers)
        return jsonify(layer), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def delete_layer(id):
    try:
        layer = next((l for l in layers if l["id"] == id), None)
        if not layer:
            return jsonify({"error": "Layer not found"}), 404

        image_path = os.path.join(LAYER_FOLDER, f"{id}.png")
        layers.remove(layer)

        print(f"Deleting layer: {image_path}")
        if os.path.exists(image_path):
            os.remove(image_path)

        return jsonify({"message": "Layer deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def list_layers():
    return jsonify(layers), 200


def preview_layers():
    try:
        if not layers:
            return jsonify({"error": "No layers to preview"}), 404

        # Erstelle den leeren Canvas (Viewport)
        viewport_width = viewportConfig[0]["width"]
        viewport_height = viewportConfig[0]["height"]
        composite_image = Image.new('RGBA', (viewport_width, viewport_height), (0, 0, 0, 0))

        for layer in layers:
            layer_path = os.path.join(LAYER_FOLDER, f"{layer['id']}.png")
            if os.path.exists(layer_path):
                layer_img = Image.open(layer_path).convert('RGBA')
                matrix = layer.get("matrix", {
                    "a": 1, "b": 0, "c": 0, "d": 1,
                    "x": 0, "y": 0, "rotate": 0
                })

                original_width, original_height = layer_img.size
                scale_x = matrix["a"]
                scale_y = matrix["d"]

                # Berechne die Position vor der Skalierung und Rotation
                pos_x = int(round(matrix["x"]))
                pos_y = int(round(matrix["y"]))

                # Rotation
                rotate_angle = float(matrix.get("rotate", 0))

                # Berechne den Mittelpunkt für die Rotation
                center_x = original_width / 2
                center_y = original_height / 2

                # Wenn Rotation vorliegt, dann zuerst rotiere das Bild
                if rotate_angle != 0:
                    rotated_img = layer_img.rotate(-rotate_angle, resample=Image.BICUBIC, expand=True, center=(center_x, center_y))
                    rotated_width, rotated_height = rotated_img.size
                else:
                    rotated_img = layer_img
                    rotated_width, rotated_height = original_width, original_height

                # Skalierung: Jetzt wird das Bild skaliert (unter Berücksichtigung der Rotation)
                new_width = int(round(rotated_width * scale_x))
                new_height = int(round(rotated_height * scale_y))
                transformed_img = rotated_img.resize((new_width, new_height), resample=Image.BICUBIC)

                # Berechne den Offset durch Rotation und Skalierung
                # Berechne den Mittelpunkt des skalierten Bildes und den Offset nach der Skalierung
                center_scaled_x = new_width / 2
                center_scaled_y = new_height / 2

                # Berechne den neuen Offset, um das Bild richtig zu platzieren
                offset_x = center_scaled_x - center_x
                offset_y = center_scaled_y - center_y

                # Neue Position im Viewport nach der Skalierung und Rotation
                paste_x = int(round(pos_x - offset_x))
                paste_y = int(round(pos_y - offset_y))

                # Layer auf das finale Bild setzen
                composite_image.paste(transformed_img, (paste_x, paste_y), transformed_img)

        # Speichern der finalen Map
        map_id = str(uuid.uuid4())
        map_filename = f"{map_id}.png"
        map_path = os.path.join(UPLOAD_FOLDER, map_filename)
        composite_image.save(map_path, format="PNG", quality=100)

        return jsonify({"id": map_id, "title": "preview", "src": f"/download/{map_filename}"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def order_layers(id, order):
    """
    Verschiebt das Layer mit der gegebenen ID an die angegebene Position (order),
    und passt die Reihenfolge aller anderen Layer entsprechend an.
    """
    try:
        # Sicherstellen, dass order eine ganze Zahl ist
        order = int(order)

        # Layer mit gegebener ID finden
        index = next((i for i, l in enumerate(layers) if l["id"] == id), None)
        if index is None:
            return jsonify({"error": f"Layer with id {id} not found."}), 404

        # Layer verschieben
        moved_layer = layers.pop(index)
        layers.insert(order, moved_layer)

        # Reihenfolge neu nummerieren
        for i, layer in enumerate(layers):
            layer["order"] = i

        return jsonify({"success": True, "message": f"Layer {id} moved to position {order}."}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/layer', methods=['POST'])
def layer_management():
    try:
        params = parse_parameters(PARAMETERS['layer'], request.form)
        method_function_map = {
            "add": {
                'keys': {"name", "width", "height"},
                'function': add_layer
            },
            "update": {
                'keys': {"name", "width", "height", "id", "a", "b", "c", "d", "x", "y", "rotate", "order"},
                'function': update_layer
            },
            "delete": {
                'keys': {"id"},
                'function': delete_layer
            },
            "list": {
                'keys': {},
                'function': list_layers
            },
            "preview": {
                'keys': {},
                'function': preview_layers
            },
            "order": {
                'keys': {"id", "order"},
                'function': order_layers
            },
        }

        method = params.get('method')
        if method not in method_function_map:
            return jsonify({"error": "Invalid method"}), 400

        method_info = method_function_map[method]
        method_keys = method_info['keys']
        method_function = method_info['function']
        method_params = {key: params[key] for key in method_keys if key in params}
        return method_function(**method_params)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def apply_edits(img, cut_out):
    width, height = img.size
    img_array = np.array(img)

    # RGBA-Einstellungen
    if cut_out:
        img_array = apply_cut_out(cut_out, img_array)

    return Image.fromarray(img_array.astype(np.uint8))

def apply_color_adjustments(img, color_overlay, color_overlay_mode, invert_colors, color_shift, hue_variation):
    width, height = img.size
    img_array = np.array(img)

    print(color_shift)
    # RGBA-Einstellungen
    if color_overlay:
        img_array = apply_color(img_array, color_overlay, color_overlay_mode)

    # Farbtonvariation
    if color_shift != 0:
        img_array = apply_color_shift(img_array, color_shift)

    # Farbtonvariation
    if hue_variation != 0:
        img_array = apply_hue_rotation(img_array, hue_variation)

    # Farben invertieren
    if invert_colors:
        img_array = apply_invert_colors(img_array, invert_colors)

    return Image.fromarray(img_array.astype(np.uint8))

def apply_brightness_contrast_adjustments(img, brightness, contrast, sharpness, edge_detection):
    width, height = img.size
    img_array = np.array(img)
    if brightness or contrast:
        img_array = apply_brightness_contrast(img_array, brightness, contrast)

    # Schärfen anwenden, wenn der Schärfungsfaktor größer als 0 ist
    if sharpness > 0:
        img_array = apply_sharpness(img_array, sharpness)

    # Kantenerkennung anwenden, wenn aktiviert
    if edge_detection:
        img_array = apply_edge_detection(img_array, edge_detection)

    return Image.fromarray(img_array.astype(np.uint8))

def apply_fx_adjustments(img, blur, blur_mode, blur_radius, blur_falloff_mode, blur_type, noise_level):
    width, height = img.size
    img_array = np.array(img)
    if blur > 0 and blur_radius > 0:
        img_array = apply_blur(img_array, blur, blur_mode, blur_radius, blur_falloff_mode, blur_type)

    if noise_level > 0:  # Überprüft, ob das Rauschlevel größer als 0 ist
        img_array = apply_noise(img_array, noise_level)

    return Image.fromarray(img_array.astype(np.uint8))

def apply_beauty_adjustments(img, color_lookup):
    width, height = img.size
    img_array = np.array(img)
    if color_lookup > 0:  # Überprüft, ob das Rauschlevel größer als 0 ist
        img_array = apply_color_lookup(img_array, color_lookup)
    return Image.fromarray(img_array.astype(np.uint8))

def apply_motion_projection(img, simulate_mode, frame_count, amplitude, frequency, phase_shift, amplitude_multiplier, wave_type):
    width, height = img.size
    img_array = np.array(img)
    if simulate_mode > 0:  # Überprüft, ob das Rauschlevel größer als 0 ist
        img_array = texture_projection(img, simulate_mode, frame_count, amplitude, frequency, phase_shift, amplitude_multiplier, wave_type)

    if frame_count > 1:
        return img_array
    else:
        return Image.fromarray(img_array.astype(np.uint8))

def pre_average(img, intensity, radius):
    """Fügt Unschärfe hinzu und passt den Kontrast basierend auf der Intensität an."""
    img = img.filter(ImageFilter.GaussianBlur(radius))
    return ImageOps.autocontrast(img, cutoff=intensity)

"""Erstellt eine gekachelte Textur und blendet die Ränder mit einstellbarer Intensität."""
def create_tiling_scatter(img, blending_intensity, tile_x, tile_y):
    width, height = img.size
    tiled_image = apply_tile_image(img, tile_x, tile_y)
    img_array = np.array(tiled_image)
    seamless_array = apply_blend_edges(img_array, width, height, blending_intensity)
    return Image.fromarray(seamless_array.astype(np.uint8))

def create_mirrored_collage(img, blending_intensity):
    """Erstellt eine gespiegelte Collage und blendet die Ränder mit einstellbarer Intensität."""
    width, height = img.size
    new_img = Image.new("RGB", (width * 2, height * 2))
    for x in range(2):
        for y in range(2):
            tile = img
            if x % 2 == 1:
                tile = ImageOps.mirror(tile)
            if y % 2 == 1:
                tile = ImageOps.flip(tile)
            new_img.paste(tile, (x * width, y * height))
    img_array = np.array(new_img)
    seamless_array = apply_blend_edges(img_array, width, height, blending_intensity)
    return Image.fromarray(seamless_array.astype(np.uint8))

def create_blended_edges(img, shift_x, shift_y, blending_intensity):
    """Erstellt ein Bild mit verschobenen und geblendeten Kanten."""
    width, height = img.size
    img_array = np.array(img)
    shifted_x = np.roll(img_array, shift=int(width * shift_x), axis=1)
    shifted_y = np.roll(shifted_x, shift=int(height * shift_y), axis=0)
    blended_array = (img_array * (1 - blending_intensity) + shifted_y * blending_intensity).astype(np.uint8)
    seamless_array = apply_blend_edges(blended_array, width, height, blending_intensity)
    return Image.fromarray(seamless_array)

def create_randomized_scatter(
    img, blending_intensity, max_shift_ratio, blur, blur_mode, blur_radius, sharpness, color_shift,
    invert_colors, rotation_angle, contrast, hue_variation=0, edge_detection=False, brightness=0, noise_level=0):
    """Erstellt ein Bild mit fortschrittlichen Textur-Effekten für professionelle Game-Texturen."""
    width, height = img.size
    img_array = np.array(img)

    # Kontrastintensität
    if brightness > 0 or contrast > 0:  # Überprüft, ob Helligkeit oder Kontrast größer als 0 ist
        img_array = apply_brightness_contrast(img_array, brightness, contrast)

    # Farbverschiebung
    if color_shift > 0:  # Überprüft, ob die Farbverschiebung größer als 0 ist
        img_array = apply_color_shift(img_array, color_shift)

    # Rauschen
    if noise_level > 0:  # Überprüft, ob das Rauschlevel größer als 0 ist
        img_array = apply_noise(img_array, noise_level)

    # Zufällige Verschiebung
    if max_shift_ratio > 0:  # Überprüft, ob die maximale Verschiebung größer als 0 ist
        img_array = apply_random_shift(img_array, width, height, max_shift_ratio)

    # Weichzeichnung
    if blur > 0 and blur_mode and blur_radius > 0:  # Überprüft, ob Weichzeichnung aktiv ist und der Radius größer als 0
        img_array = apply_blur(img_array, blur, blur_mode, blur_radius)

    # Übergänge
    if blending_intensity > 0:  # Überprüft, ob die Übergangsintensität größer als 0 ist
        img_array = apply_blend_edges(img_array, width, height, blending_intensity)

    # Kantenhervorhebung
    if edge_detection:  # Überprüft, ob die Kantenhervorhebung aktiviert ist (True oder False)
        img_array = apply_edge_detection(img_array, edge_detection)

    # Bildrotation
    if rotation_angle > 0:  # Überprüft, ob der Rotationswinkel größer als 0 ist
        img_array = apply_rotation(img_array, rotation_angle)

    # Rückgabe des modifizierten Bildes
    return Image.fromarray(img_array.astype(np.uint8))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
