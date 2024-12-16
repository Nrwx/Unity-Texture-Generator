from flask import Flask, request, jsonify, send_file, send_from_directory
from PIL import Image, ImageOps, ImageFilter
import numpy as np
import os
import io
import cv2
import uuid

app = Flask(__name__)

# Ordner für temporäre Dateien
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def crop_image(image, crop_left, crop_top, crop_right, crop_bottom):
    """Schneidet das Bild entsprechend den angegebenen Werten zu."""
    width, height = image.size
    return image.crop((
        crop_left,
        crop_top,
        width - crop_right,
        height - crop_bottom
    ))

def generate_diffuse_map(image):
    """Erstellt eine Diffuse Map (in diesem Fall einfach das Originalbild als Diffuse Map)."""
    return image

def generate_normal_map(image):
    """Erstellt eine Normal Map."""
    gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
    sobel_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    magnitude = cv2.magnitude(sobel_x, sobel_y)
    normal_map = cv2.normalize(magnitude, None, 0, 255, cv2.NORM_MINMAX)
    return Image.fromarray(normal_map.astype(np.uint8))

def generate_specular_map(image):
    """Erstellt eine Specular Map."""
    gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
    _, specular_map = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
    return Image.fromarray(specular_map)

def generate_bump_map(image):
    """Erstellt eine Bump Map."""
    gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
    bump_map = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
    bump_map = cv2.normalize(bump_map, None, 0, 255, cv2.NORM_MINMAX)
    return Image.fromarray(bump_map.astype(np.uint8))

def generate_light_map(image):
    """Erstellt eine Light Map."""
    return image.filter(ImageFilter.GaussianBlur(10))

def generate_alpha_map(image):
    """Erstellt eine Alpha Map (basierend auf Transparenz)."""
    gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
    _, alpha_map = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY)
    return Image.fromarray(alpha_map)

def generate_stone_map(img, stone_size, density, intensity):
    # Logik für Steinkarten hier
    return img

def generate_grass_map(img, blade_length, blade_width, density, intensity):
    # Logik für Graskarten hier
    return img

@app.route('/')
def serve_frontend():
    return send_from_directory('../frontend/dist', 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):
    return send_from_directory('../frontend/dist', path)

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        file = request.files['file']
        crop_left = int(request.form.get('cropLeft', 0))
        crop_top = int(request.form.get('cropTop', 0))
        crop_right = int(request.form.get('cropRight', 0))
        crop_bottom = int(request.form.get('cropBottom', 0))
        selected_maps = request.form.get('selectedMaps', '').split(',')
        method = request.form.get('method', 'tiling_scatter')  # Standardmethode
        intensity = int(request.form.get('intensity', 0))
        blending_intensity = float(request.form.get('blending_intensity', 0.5))
        radius = int(request.form.get('radius', 1))
        output_format = request.form.get('output_format', 'PNG')
        quality = int(request.form.get('quality', 80))
        max_shift_ratio = float(request.form.get('max_shift_ratio', 0.1))
        shift_x = float(request.form.get('shift_x', 0.1))
        shift_y = float(request.form.get('shift_y', 0.1))
        border_width = int(request.form.get('border_width', 10))
        stone_size = int(request.form.get('stone_size', 10))
        density = float(request.form.get('density', 0.5))
        blade_length = int(request.form.get('blade_length', 20))
        blade_width = int(request.form.get('blade_width', 1))

        # Datei speichern und öffnen
        image = Image.open(file.stream).convert("RGB")
        cropped_image = crop_image(image, crop_left, crop_top, crop_right, crop_bottom)

        # Erstelle Karten
        map_functions = {
            "Diffuse Map": generate_diffuse_map,
            "Normal Map": generate_normal_map,
            "Specular Map": generate_specular_map,
            "Bump Map": generate_bump_map,
            "Light Map": generate_light_map,
            "Alpha Map": generate_alpha_map,
        }
        additional_maps = []
        for map_type in selected_maps:
            map_type = map_type.strip()
            if map_type in map_functions:
                map_image = map_functions[map_type](cropped_image)
                processed_image = apply_seamless_logic(map_image, method, intensity, radius, quality, blending_intensity, max_shift_ratio, shift_x, shift_y, stone_size, density, blade_length, blade_width)

                # UUID für Dateinamen
                file_uuid = uuid.uuid4().hex
                map_filename = f"{map_type.replace(' ', '_').lower()}_{file_uuid}.png"
                map_path = os.path.join(UPLOAD_FOLDER, map_filename)

                # Speichern der Datei
                processed_image.save(map_path)

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

@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(file_path):
        return send_file(file_path, mimetype='image/png')
    return jsonify({"error": "File not found"}), 404

def apply_seamless_logic(img, method, intensity, radius, quality, blending_intensity, max_shift_ratio, shift_x, shift_y, stone_size, density, blade_length, blade_width):
    if method == '1':  # Smoothed Collage
        return pre_average(create_tiling_scatter(img, blending_intensity), intensity, radius)
    elif method == '2':  # Scattered Edges
        return create_randomized_scatter(img, blending_intensity, max_shift_ratio)
    elif method == '3':  # Smoothed Copies
        return create_blended_edges(img, shift_x, shift_y, blending_intensity)
    elif method == '4':  # Restoring Frame
        return create_mirrored_collage(img, blending_intensity)
    elif method == "5":
        return generate_stone_map(img, stone_size, density, intensity)
    elif method == "6":
        return generate_grass_map(img, blade_length, blade_width, density, intensity)
    return img

def pre_average(img, intensity, radius):
    """Fügt Unschärfe hinzu und passt den Kontrast basierend auf der Intensität an."""
    img = img.filter(ImageFilter.GaussianBlur(radius))
    return ImageOps.autocontrast(img, cutoff=intensity)

def create_tiling_scatter(img, blending_intensity):
    """Erstellt eine gekachelte Textur und blendet die Ränder mit einstellbarer Intensität."""
    width, height = img.size
    new_img = Image.new("RGB", (width * 2, height * 2))
    for x in range(2):
        for y in range(2):
            new_img.paste(img, (x * width, y * height))
    img_array = np.array(new_img)
    seamless_array = blend_edges(img_array, width, height, blending_intensity)
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
    seamless_array = blend_edges(img_array, width, height, blending_intensity)
    return Image.fromarray(seamless_array.astype(np.uint8))

def create_blended_edges(img, shift_x, shift_y, blending_intensity):
    """Erstellt ein Bild mit verschobenen und geblendeten Kanten."""
    width, height = img.size
    img_array = np.array(img)
    shifted_x = np.roll(img_array, shift=int(width * shift_x), axis=1)
    shifted_y = np.roll(shifted_x, shift=int(height * shift_y), axis=0)
    blended_array = (img_array * (1 - blending_intensity) + shifted_y * blending_intensity).astype(np.uint8)
    seamless_array = blend_edges(blended_array, width, height, blending_intensity)
    return Image.fromarray(seamless_array)

def create_randomized_scatter(img, blending_intensity, max_shift_ratio):
    """Erstellt ein Bild mit zufällig verschobenen Kanten."""
    width, height = img.size
    img_array = np.array(img)
    random_shift_x = np.random.randint(-int(width * max_shift_ratio), int(width * max_shift_ratio))
    random_shift_y = np.random.randint(-int(height * max_shift_ratio), int(height * max_shift_ratio))
    scattered_array = np.roll(img_array, shift=random_shift_x, axis=1)
    scattered_array = np.roll(scattered_array, shift=random_shift_y, axis=0)
    seamless_array = blend_edges(scattered_array, width, height, blending_intensity)
    return Image.fromarray(seamless_array.astype(np.uint8))

def blend_edges(img_array, width, height, blending_intensity):
    """Blendet die Ränder des Bildes nahtlos mit einstellbarer Intensität."""
    blended_array = img_array.copy()
    blend_factor = blending_intensity
    # Horizontale Übergänge
    blended_array[:, :width // 4] = (
        blend_factor * img_array[:, :width // 4] + (1 - blend_factor) * np.roll(img_array, shift=-(width // 2), axis=1)[:, :width // 4]
    )
    blended_array[:, -width // 4:] = (
        blend_factor * img_array[:, -width // 4:] + (1 - blend_factor) * np.roll(img_array, shift=width // 2, axis=1)[:, -width // 4:]
    )
    # Vertikale Übergänge
    blended_array[:height // 4, :] = (
        blend_factor * img_array[:height // 4, :] + (1 - blend_factor) * np.roll(img_array, shift=-(height // 2), axis=0)[:height // 4, :]
    )
    blended_array[-height // 4:, :] = (
        blend_factor * img_array[-height // 4:, :] + (1 - blend_factor) * np.roll(img_array, shift=height // 2, axis=0)[-height // 4:, :]
    )
    return blended_array

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
