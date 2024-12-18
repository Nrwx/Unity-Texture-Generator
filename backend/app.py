from flask import Flask, request, jsonify, send_file, send_from_directory
from PIL import Image, ImageOps, ImageFilter, ImageEnhance
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

def generate_stone_map(img, stone_size, density, intensity, stone_variance=0.5):
    """
    Generiert eine Steinkarte, die nahtlose Steine mit der angegebenen Größe, Dichte, Intensität und Variabilität enthält.
    """
    img_array = np.array(img)
    height, width, _ = img_array.shape

    # Basistextur initialisieren
    stone_map = np.zeros_like(img_array)

    # Steinmuster erstellen
    num_stones = int(density * height * width // (stone_size**2))
    for _ in range(num_stones):
        # Zufällige Position für Steine
        center_x = np.random.randint(stone_size, width - stone_size)
        center_y = np.random.randint(stone_size, height - stone_size)

        # Radius mit Variabilität berechnen
        radius = np.random.randint(
            max(1, int(stone_size * (1 - stone_variance))),
            int(stone_size * (1 + stone_variance))
        )

        # Steinfarbe mit Variabilität berechnen
        stone_color = np.clip(
            np.random.randint(intensity - 30, intensity + 30, 3),
            0, 255
        )

        # Steine als gefüllte Kreise zeichnen
        cv2.circle(stone_map, (center_x, center_y), radius, stone_color.tolist(), -1)

    # Nahtloses Mischen mit der Originaltextur
    blended_map = cv2.addWeighted(img_array, 0.6, stone_map, 0.4, 0)
    return Image.fromarray(blended_map)

def generate_grass_map(img, blade_length, blade_width, density, intensity, grass_angle_variance):
    """
    Generiert eine Graskarte mit Grashalmen der angegebenen Länge, Breite, Dichte, Intensität und Winkelvariabilität.
    """
    img_array = np.array(img)
    height, width, _ = img_array.shape

    # Basistextur initialisieren
    grass_map = np.zeros_like(img_array)

    # Konvertiere Winkelschwankung in Radianten
    angle_variance_rad = np.deg2rad(grass_angle_variance)

    num_blades = int(density * height * width // (blade_length * blade_width))
    for _ in range(num_blades):
        # Zufällige Position für Grashalme
        start_x = np.random.randint(0, width)
        start_y = np.random.randint(0, height)

        # Zufällige Richtung basierend auf Winkelschwankung
        angle = np.random.uniform(-angle_variance_rad, angle_variance_rad)
        end_x = int(start_x + blade_length * np.cos(angle))
        end_y = int(start_y - blade_length * np.sin(angle))

        # Grashalmfarbe mit Variabilität berechnen
        grass_color = np.clip(
            np.random.randint(intensity - 20, intensity + 20, 3),
            0, 255
        )

        # Grashalme zeichnen
        cv2.line(grass_map, (start_x, start_y), (end_x, end_y), grass_color.tolist(), blade_width)

    # Nahtloses Mischen mit der Originaltextur
    blended_map = cv2.addWeighted(img_array, 0.7, grass_map, 0.3, 0)
    return Image.fromarray(blended_map)

@app.route('/')
def serve_frontend():
    return send_from_directory('../frontend/dist', 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):
    return send_from_directory('../frontend/dist', path)

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        # Eingabeparameter auslesen
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
        stone_variance = float(request.form.get('stone_variance', 0.5))
        density = float(request.form.get('density', 0.5))
        blade_length = int(request.form.get('blade_length', 20))
        blade_width = int(request.form.get('blade_width', 1))
        grass_angle_variance = int(request.form.get('grass_angle_variance', 15))
        sharpness = float(request.form.get('sharpness', 0.0))
        color_shift = int(request.form.get('color_shift', 0))
        noise_level = float(request.form.get('noise_level', 0.0))
        invert_colors = request.form.get('invert_colors', 'false').lower() == 'true'
        rotation_angle = float(request.form.get('rotation_angle', 0.0))
        fade_edges = float(request.form.get('fade_edges', 0.0))
        contrast = float(request.form.get('contrast', 100.0))
        hue_variation = int(request.form.get('hue_variation', 0))
        tile_size = int(request.form.get('tile_size', 0)) if request.form.get('tile_size') else None
        gradient_intensity = float(request.form.get('gradient_intensity', 0.0))
        edge_detection = request.form.get('edge_detection', 'false').lower() == 'true'

        # Datei speichern und öffnen
        image = Image.open(file.stream).convert("RGB")
        cropped_image = crop_image(image, crop_left, crop_top, crop_right, crop_bottom)

        # Hauptbild generieren
        processed_image = apply_seamless_logic(
            cropped_image, method, intensity, radius, quality, blending_intensity,
            max_shift_ratio, shift_x, shift_y, stone_size, density, blade_length,
            blade_width, stone_variance, grass_angle_variance, sharpness, color_shift,
            noise_level, invert_colors, rotation_angle, contrast,
            hue_variation, tile_size, edge_detection
        )

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
        for map_type in selected_maps:
            map_type = map_type.strip()
            if map_type in map_functions:
                # Karte basierend auf dem Hauptbild erstellen
                map_image = map_functions[map_type](processed_image)

                # UUID für Dateinamen
                file_uuid = uuid.uuid4().hex
                map_filename = f"{map_type.replace(' ', '_').lower()}_{file_uuid}.png"
                map_path = os.path.join(UPLOAD_FOLDER, map_filename)

                # Speichern der Datei
                map_image.save(map_path, format=output_format, quality=quality)

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

def apply_seamless_logic(
    img,
    method,
    intensity,
    radius,
    quality,
    blending_intensity,
    max_shift_ratio,
    shift_x,
    shift_y,
    stone_size,
    density,
    blade_length,
    blade_width,
    stone_variance,
    grass_angle_variance,
    sharpness,
    color_shift,
    noise_level,
    invert_colors,
    rotation_angle,
    contrast,
    hue_variation,
    tile_size,
    edge_detection):
    if method == '1':  # Smoothed Collage
        return pre_average(create_tiling_scatter(img, blending_intensity), intensity, radius)
    elif method == '2':  # Scattered Edges
        return create_randomized_scatter(img, blending_intensity, max_shift_ratio, intensity, radius, sharpness, color_shift,
                                          noise_level, invert_colors, rotation_angle, contrast, hue_variation,
                                          tile_size, edge_detection)
    elif method == '3':  # Smoothed Copies
        return create_blended_edges(img, shift_x, shift_y, blending_intensity)
    elif method == '4':  # Restoring Frame
        return create_mirrored_collage(img, blending_intensity)
    elif method == "5":
        return generate_stone_map(img, stone_size, density, intensity, stone_variance )
    elif method == "6":
        return generate_grass_map(img, blade_length, blade_width, density, intensity, grass_angle_variance)
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

def create_randomized_scatter(
    img, blending_intensity, max_shift_ratio, intensity, radius, sharpness, color_shift,
    noise_level, invert_colors, rotation_angle, contrast, hue_variation,
    tile_size, edge_detection
):
    """Erstellt ein Bild mit fortschrittlichen Textur-Effekten für professionelle Game-Texturen."""
    width, height = img.size
    img_array = np.array(img)

    # Kontrastintensität
    img_array = np.clip(img_array * (intensity / 100), 0, 255)

    # Farbverschiebung
    if color_shift > 0:
        img_array[:, :, 0] = np.clip(img_array[:, :, 0] + color_shift, 0, 255)
        img_array[:, :, 1] = np.clip(img_array[:, :, 1] - color_shift, 0, 255)
        img_array[:, :, 2] = np.clip(img_array[:, :, 2] + color_shift // 2, 0, 255)

    # Rauschen
    if noise_level > 0:
        noise = np.random.randint(-int(255 * (noise_level / 100)), int(255 * (noise_level / 100)), img_array.shape)
        img_array = np.clip(img_array + noise, 0, 255)

    # Zufällige Verschiebung
    random_shift_x = np.random.randint(-int(width * max_shift_ratio), int(width * max_shift_ratio))
    random_shift_y = np.random.randint(-int(height * max_shift_ratio), int(height * max_shift_ratio))
    scattered_array = np.roll(img_array, shift=random_shift_x, axis=1)
    scattered_array = np.roll(scattered_array, shift=random_shift_y, axis=0)

    scattered_img = Image.fromarray(scattered_array.astype(np.uint8))

    # Weichzeichnung
    if radius > 0:
        scattered_img = scattered_img.filter(ImageFilter.GaussianBlur(radius=radius))

    # Schärfen
    if sharpness > 0:
        enhancer = ImageEnhance.Sharpness(scattered_img)
        scattered_img = enhancer.enhance(1 + sharpness / 100)

    # Kontrast
    if contrast != 100:
        enhancer = ImageEnhance.Contrast(scattered_img)
        scattered_img = enhancer.enhance(contrast / 100)

    # Farbtonvariation
    if hue_variation != 0:
        hsv_img = cv2.cvtColor(np.array(scattered_img), cv2.COLOR_RGB2HSV)
        hsv_img[:, :, 0] = (hsv_img[:, :, 0] + hue_variation) % 180
        scattered_img = Image.fromarray(cv2.cvtColor(hsv_img, cv2.COLOR_HSV2RGB))

    # Farben invertieren
    if invert_colors:
        scattered_img = Image.fromarray(255 - np.array(scattered_img))

    # Kachelgröße
    if tile_size and tile_size > 0:
        scattered_array = np.array(scattered_img)

        # Berechne die Kachelgröße und schneide das Bild entsprechend zu
        tile_width = min(tile_size, width)
        tile_height = min(tile_size, height)

        # Schneide das Bild auf die Kachelgröße zu
        cropped_array = scattered_array[:tile_height, :tile_width]

        # Berechne die Anzahl der Wiederholungen für Breite und Höhe
        repeat_x = (width + tile_width - 1) // tile_width
        repeat_y = (height + tile_height - 1) // tile_height

        # Erstelle das gekachelte Muster durch Wiederholung
        tiled_array = np.tile(cropped_array, (repeat_y, repeat_x, 1))

        # Schneide das Muster auf die ursprüngliche Bildgröße zu
        tiled_array = tiled_array[:height, :width]

        # Wandle das Ergebnis zurück in ein Bild
        scattered_img = Image.fromarray(tiled_array.astype(np.uint8))

    # Übergänge
    scattered_array = np.array(scattered_img)
    seamless_array = blend_edges(scattered_array, width, height, blending_intensity)

    # Kantenhervorhebung
    if edge_detection:
        gray_img = cv2.cvtColor(np.array(scattered_img), cv2.COLOR_RGB2GRAY)
        edges = cv2.Canny(gray_img, threshold1=50, threshold2=150)
        edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
        seamless_array = cv2.addWeighted(seamless_array, 1.0, edges_rgb, 0.5, 0)

    # Bildrotation
    if rotation_angle != 0:
        # Konvertiere das Bild in den RGBA-Modus, falls es noch nicht in diesem Modus ist
        scattered_img = scattered_img.convert("RGBA")

        # Berechne das Zentrum des Bildes
        center_x = width / 2
        center_y = height / 2

        # Füge Transparenz (Alpha-Wert 0) als Füllfarbe hinzu
        scattered_img = scattered_img.rotate(
            rotation_angle,
            resample=Image.BICUBIC,  # Hochwertige Interpolation
            expand=True,  # Größe anpassen, um das gesamte Bild zu erhalten
            center=(center_x, center_y),  # Setze das Zentrum auf die Bildmitte
            fillcolor=(0, 0, 0, 0)  # Transparenz als Füllfarbe
        )

    return scattered_img

def blend_edges(img_array, width, height, blending_intensity):
    """Blendet die Ränder des Bildes nahtlos mit einstellbarer Intensität."""
    if blending_intensity <= 0:
        return img_array  # Keine Mischung notwendig

    blended_array = img_array.copy()
    blend_factor = blending_intensity / 100  # Normalisierung des Faktors

    # Horizontale Übergänge
    blended_array[:, :width // 4] = (
        blend_factor * img_array[:, :width // 4] +
        (1 - blend_factor) * np.roll(img_array, shift=-(width // 2), axis=1)[:, :width // 4]
    )
    blended_array[:, -width // 4:] = (
        blend_factor * img_array[:, -width // 4:] +
        (1 - blend_factor) * np.roll(img_array, shift=width // 2, axis=1)[:, -width // 4:]
    )

    # Vertikale Übergänge
    blended_array[:height // 4, :] = (
        blend_factor * img_array[:height // 4, :] +
        (1 - blend_factor) * np.roll(img_array, shift=-(height // 2), axis=0)[:height // 4, :]
    )
    blended_array[-height // 4:, :] = (
        blend_factor * img_array[-height // 4:, :] +
        (1 - blend_factor) * np.roll(img_array, shift=height // 2, axis=0)[-height // 4:, :]
    )

    return blended_array

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
