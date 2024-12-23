from flask import Flask, request, jsonify, send_file, send_from_directory
from PIL import Image, ImageOps, ImageFilter, ImageEnhance
import numpy as np
import os
import io
import cv2
import uuid

from components import (
    generate_diffuse_map,
    generate_normal_map,
    generate_specular_map,
    generate_bump_map,
    generate_light_map,
    generate_alpha_map,
    generate_stone_map,
    generate_grass_map,
    apply_crop_image,
    apply_blend_edges,
    apply_brightness_contrast,
    apply_sharpness,
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
)

# Initialising
app = Flask(__name__)
# Ordner für temporäre Dateien
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Definition der Eingabeparameter und deren Standardwerte
PARAMETERS = {
    "upload": {
        # STANDARD METHODS PARAMS START
        "selectedMaps": {"type": list, "default": []},
        "cropLeft": {"type": int, "default": 0},
        "cropTop": {"type": int, "default": 0},
        "cropRight": {"type": int, "default": 0},
        "cropBottom": {"type": int, "default": 0},
        "method": {"type": str, "default": "tiling_scatter"},
        "output_format": {"type": str, "default": "PNG"},
        "quality": {"type": int, "default": 80},
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
        "color_shift": {"type": int, "default": 0},
        "hue_variation": {"type": int, "default": 0},
        # COLOR PARAMS END

        # NOISE PARAMS START
        "noise_level": {"type": int, "default": 0},
        # NOISE PARAMS END

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
        "noise_level": {"type": float, "default": 0.0},
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
}

@app.route('/')
def serve_frontend():
    return send_from_directory('../frontend/dist', 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):
    return send_from_directory('../frontend/dist', path)

@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(file_path):
        return send_file(file_path, mimetype='image/png')
    return jsonify({"error": "File not found"}), 404

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        params = parse_parameters(PARAMETERS['upload'], request.form)

        # Datei öffnen
        file = request.files['file']
        image = Image.open(file.stream).convert("RGB")
        cropped_image = apply_crop_image(
            image, params["cropLeft"], params["cropTop"], params["cropRight"], params["cropBottom"]
        )

        method_function_map = {
            '1': {
                'keys': {"blending_intensity", "tile_x", "tile_y"},
                'function': create_tiling_scatter
            },
            '2': {
                'keys': {"blending_intensity", "max_shift_ratio", "blur", "blur_mode",
                         "blur_radius", "sharpness", "color_shift", "invert_colors", "rotation_angle",
                         "contrast", "hue_variation" "edge_detection", "brightness", "noise_level"},
                'function': create_randomized_scatter
            },
            '3': {
                'keys': {"shift_x", "shift_y", "blending_intensity"},
                'function': create_blended_edges
            },
            '4': {
                'keys': {"blending_intensity"},
                'function': create_mirrored_collage
            },
            '5': {
                'keys': {"stone_size", "density", "intensity", "stone_variance"},
                'function': generate_stone_map
            },
            '6': {
                'keys': {"base_brightness", "base_opacity", "base_contrast", "base_sharpness", "blur",
                         "blur_mode", "base_tile_x", "base_tile_y", "base_fade_alpha"},
                'function': generate_grass_map
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

        # Bildverarbeitung mit der entsprechenden Methode
        processed_image = method_function(cropped_image, **method_params)

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
                file_uuid = uuid.uuid4().hex
                map_filename = f"{map_type.replace(' ', '_').lower()}_{file_uuid}.png"
                map_path = os.path.join(UPLOAD_FOLDER, map_filename)

                # Speichern der Datei
                map_image.save(map_path, format=params["output_format"], quality=params["quality"])

                additional_maps.append({
                    "type": map_type,
                    "url": f"/download/{map_filename}"
                })

        return jsonify({
            "additionalMaps": additional_maps
        })

    except Exception as e:
        print(f"Fehler beim Hochladen der Datei: {str(e)}")  # Fehler im Terminal ausgeben
        return jsonify({"error": str(e)}), 500

@app.route('/tile', methods=['POST'])
def tile_image_endpoint():
    try:
        params = parse_parameters(PARAMETERS['tile'], request.form)

        # Diffuse-Bildpfad prüfen
        diffuse_image_path = os.path.join(UPLOAD_FOLDER, os.path.basename(params["diffuse_image_url"]))
        if not os.path.exists(diffuse_image_path):
            raise FileNotFoundError(f"File not found: {diffuse_image_path}")

        # Bild laden
        image = Image.open(diffuse_image_path).convert("RGB")

        # Kachelbild erstellen
        tiled_image = apply_tile_image(image, params["tile_x"], params["tile_y"])

        # UUID für Dateinamen
        file_uuid = uuid.uuid4().hex
        tiled_filename = f"tiled_image_{file_uuid}.png"
        tiled_path = os.path.join(UPLOAD_FOLDER, tiled_filename)

        # Speichern
        tiled_image.save(tiled_path, format="PNG")

        return jsonify({"url": f"/download/{tiled_filename}"})
    except Exception as e:
        print(f"Fehler: {str(e)}")
        return jsonify({"error": str(e)}), 500

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

    # Schärfen
    if sharpness > 0:  # Überprüft, ob die Schärfe größer als 0 ist
        img_array = apply_sharpness(img_array, sharpness)

    # Farbtonvariation
    if hue_variation > 0:  # Überprüft, ob die Farbtonvariation größer als 0 ist
        img_array = apply_hue_rotation(img_array, hue_variation)

    # Farben invertieren
    if invert_colors:  # Überprüft, ob die Farben invertiert werden sollen (True oder False)
        img_array = apply_invert_colors(img_array, invert_colors)

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
