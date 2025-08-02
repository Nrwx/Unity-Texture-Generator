from flask import Flask, request, jsonify, send_file, send_from_directory
from dotenv import load_dotenv
import copy
from PIL import Image, ImageOps, ImageFilter, ImageEnhance
import numpy as np
import os
import shutil
import io
import math
import cv2
import uuid
import time
from werkzeug.utils import secure_filename
# PATH Initialising
from config.setup.generate_paths import init_paths
if os.path.exists("generated"):
    shutil.rmtree("generated")
if not os.path.exists("generated/paths.py"):
    init_paths()
# PATH Initialising

# NV_COMPRESS Initialising
from config.app.driver.install import detect_nvcompress_or_install
detect_nvcompress_or_install()  # ⏳
# NV_COMPRESS Initialising

from generated.paths import ( PUBLIC_FOLDER, PUBLIC_TEMP_UPLOAD_FOLDER, PUBLIC_TEMP_CHANNEL_FOLDER, PUBLIC_LAYER_FOLDER )
from config.api.parameter import PARAMETERS
from router.index import register_router
from model.fonts_model import FontsModel
from model.brush_model import BrushModel
from model.layer_model import LayerModel
from model.queue_model import QueueModel
from controller.queue_controller import QueueController, set_queue
from utils import ( apply_rgb_rgba, apply_alpha, parse_parameters )
from components import (
    generate_diffuse_map, generate_normal_map, generate_specular_map, generate_bump_map, generate_light_map, generate_alpha_map, generate_stone_map, generate_grass_map,

    apply_rgb_mode, apply_rgba_mode, apply_edge_smooth, apply_resize, apply_cut_out, apply_color, apply_crop_image, apply_brightness_contrast, apply_shift_tiles, apply_tile_image,
    apply_brightness_contrast, apply_color_shift, apply_noise, apply_random_shift, apply_blur, apply_sharpness, apply_invert_colors, apply_blend_edges, apply_edge_detection, apply_rotation, apply_hue_rotation, apply_color_lookup,

    texture_projection,
)
# Initialising
app = Flask(__name__)

load_dotenv()

register_router(app)

FontsModel.initialize()
BrushModel.initialize()

# Queue initialisieren
queue_instance = QueueModel(app)
set_queue(queue_instance)

@app.before_request
def queue_all_requests():
    if request.method not in ["POST", "GET", "PUT", "DELETE"]:
        return None

    if request.path in ["/queue"]:
        return None

    try:
        adapter = app.url_map.bind_to_environ(request.environ)
        endpoint, values = adapter.match()
        view_func = app.view_functions.get(endpoint)
        if not view_func:
            return None

        kwargs = {}

        # JSON-Daten übernehmen
        json_data = request.get_json(silent=True)
        if isinstance(json_data, dict):
            kwargs.update(json_data)

        # Formulardaten
        kwargs.update(request.form.to_dict())

        # Query-Parameter
        kwargs.update(request.args.to_dict())

        # Dateien
        for file_key in request.files:
            kwargs[file_key] = request.files[file_key]

        # Queue-Aufruf mit Blockierung auf Ergebnis
        return QueueController.enqueue_request(
            func=view_func,
            args=(),
            kwargs=kwargs,
            info={
                "endpoint": endpoint,
                "path": request.path,
                "method": request.method,
                "content_type": request.content_type or "",
                "has_files": bool(request.files),
            }
        )

    except Exception as e:
        print(f"[Queue Intercept Error] {e}")
        return None



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
            if params["method"] != 0:
                image, alpha = apply_rgb_rgba(image)

        # Datei aus dem EditFile-Parameter prüfen
        elif params.get("editFile", "").strip():
            url = str(request.form.get('editFile', ""))
            diffuse_image_path = os.path.join(PUBLIC_LAYER_FOLDER , os.path.basename(url))

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
                'keys': {"resize_index", "resize_mode", "upscale_method", "rgb_mode", "rgba_mode"},
                'function': apply_upload_adjustments
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
            },
            7: {
                'keys': {"color_overlay", "color_overlay_mode", "invert_colors",
                         "color_shift", "hue_variation"},
                'function': apply_color_adjustments
            },
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
        if method != 0:
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
                    map_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER , map_filename)

                    # Speichern jedes Frames
                    frame.save(map_path, format=params.get("output_format", "PNG"), quality=params.get("quality", 90))

                    # Hinzufügen zur Animation
                    animation_frames.append({
                        "id" : map_id,
                        "type": f"Frame {idx}",
                        "url": f"/download/{map_filename}",
                        "width": frame.width,
                        "height": frame.height,
                    })

                    LayerModel.add(map_name, map_path, map_id, 0)

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
                    map_path = os.path.join(PUBLIC_TEMP_UPLOAD_FOLDER , map_filename)

                    # Speichern der Datei
                    map_image.save(map_path, format=params["output_format"], quality=params["quality"])

                    additional_maps.append({
                        "id" : map_id,
                        "type": map_type,
                        "url": f"/download/{map_filename}",
                        "width": map_image.width,
                        "height": map_image.height,
                    })

                    LayerModel.add(map_name, map_path, map_id, 0)

            return jsonify({
                "additionalMaps": additional_maps
            })

    except Exception as e:
        print(f"Fehler beim Hochladen der Datei: {str(e)}")  # Fehler im Terminal ausgeben
        return jsonify({"error": str(e)}), 500

def apply_edits(img, cut_out):
    width, height = img.size
    img_array = np.array(img)

    # RGBA-Einstellungen
    if cut_out:
        img_array = apply_cut_out(cut_out, img_array)

    return Image.fromarray(img_array.astype(np.uint8))

def apply_upload_adjustments(img, resize_index, resize_mode, upscale_method, rgb_mode=0, rgba_mode=0):
    """
    Kombinierte Verarbeitung der Texture direkt beim Upload:
    - Resizing
    - Upscaling
    - RGB Optimierungen (Farbraum, Kontrast, Filter etc.)
    - Alpha Handling (Premultiplied, DXT, etc.)

    :param img: PIL.Image oder np.array (je nach Modul)
    :param resize_index: Index für Zielauflösung
    :param resize_mode: 0 = Crop, 1 = Padding
    :param upscale_method: 0 = Nearest, 1 = Bicubic, 2 = AI
    :param rgb_mode: int – RGB Verarbeitungsschritt (siehe rgb_handling.py)
    :param alpha_mode: int – Alpha Verarbeitungsschritt (siehe alpha_handling.py)
    :return: verarbeitetes PIL.Image oder np.array
    """

    # Step 1: Resize (wenn nicht "Original")
    if resize_index != 0:
        img = apply_resize(img, resize_index, resize_mode, upscale_method)

    # Step 2: RGB Processing (z.B. sRGB → Linear, Normals etc.)
    if rgb_mode != 0:
        img = apply_rgb_mode(img, rgb_mode)

    # Step 3: Alpha Handling (nur wenn Alpha explizit verlangt ist)
    if rgba_mode != 0:
        img = apply_rgba_mode(img, rgba_mode)

    return img

def apply_color_adjustments(img, color_overlay, color_overlay_mode, invert_colors, color_shift, hue_variation):
    width, height = img.size
    img_array = np.array(img)

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
