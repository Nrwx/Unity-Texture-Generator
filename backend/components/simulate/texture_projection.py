from PIL import Image, ImageOps
import numpy as np
import random
import glob
import os

from components import (
    create_wave_animation,
)

ASSETS_DIR = "assets"
os.makedirs(ASSETS_DIR, exist_ok=True)

SIMULATE_MODE_MAPPING = {
    0: "none",
    1: "wave",
    2: "water",
    3: "lava",
    4: "grass",
    5: "rock",
    6: "stone",
    7: "tile",
    8: "particle",
    9: "skybox",
}

def texture_projection(img, simulate_mode, frame_count=1, amplitude=100, frequency=1.0, phase_shift=0.0, amplitude_multiplier=1.0, wave_type=0):
    """
    Simuliert eine Texturprojektion basierend auf dem Eingabebild und der Textur-Referenz.

    :param img: Das Eingabebild (Pillow Image), auf das die Textur projiziert wird.
    :param simulate_mode: Der Simulationsmodus (z. B. 'water', 'lava').
    :param frame_count: Anzahl der Frames in der Animation (standard: 1).
    :param amplitude: Amplitude der Wellenbewegung.
    :param frequency: Frequenz der Wellenbewegung.
    :param phase_shift: Phasenverschiebung der Wellenbewegung.
    :param amplitude_multiplier: Multiplikator zur Verstärkung der Amplitude.
    :param wave_type: Der Typ der Welle ('sin' oder 'cos').
    :return: Einzelnes Bild (Pillow Image) bei frame_count=1, sonst Liste von Frames (Pillow Images).
    """

    # Ensure the input image is a NumPy array
    if isinstance(img, Image.Image):
        img = np.array(img)

    if not isinstance(img, np.ndarray):
        raise TypeError("Input image must be a PIL.Image or a NumPy array.")

    # Verzeichnis für den Modus
    mode_name = SIMULATE_MODE_MAPPING.get(simulate_mode, None)
    if mode_name is None or mode_name == "none":
        raise ValueError(f"Ungültiger oder deaktivierter Modus: {simulate_mode}")

    # Verzeichnis für den Modus
    mode_dir = os.path.join(ASSETS_DIR, mode_name)

    # Überprüfen, ob das Verzeichnis existiert
    if not os.path.exists(mode_dir):
        raise ValueError(f"Das Verzeichnis für den Modus '{mode_name}' existiert nicht.")

    # Lade zufällig eine Schwarz-Weiß-Referenz aus dem Ordner
    texture_files = glob.glob(os.path.join(mode_dir, "*.jpg"))
    if not texture_files:
        raise ValueError(f"Keine Texturen für den Modus '{mode_name}' gefunden.")

    # Zufällige Auswahl einer Textur
    bw_reference = Image.open(random.choice(texture_files)).convert("L")
    img_array = np.array(img)
    bw_array = np.array(bw_reference)
    bw_normalized = bw_array / 255.0

    # Animationslogik basierend auf dem Modus
    if simulate_mode == 1:  # Wellenanimation
        # Skaliere die Höhenwerte
        height_map = bw_normalized * amplitude
        return create_wave_animation(img_array, height_map, frame_count, frequency, phase_shift, amplitude_multiplier, wave_type)

    # Weitere Modi können hier hinzugefügt werden
    raise ValueError(f"Animationsmodus für simulate_mode={simulate_mode} nicht implementiert.")
