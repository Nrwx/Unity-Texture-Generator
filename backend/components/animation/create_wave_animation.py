from PIL import Image, ImageOps
import numpy as np
import torch
import time
import multiprocessing
from config.app.app_settings import ANIMATION_SETTINGS  # Deine Animationseinstellungen laden

def process_frame(t, img_array, height_map, frame_count, frequency, phase_shift, amplitude_multiplier, wave_type):
    """
    Berechnet das verzerrte Bild für ein einzelnes Frame.

    :param t: Der Index des aktuellen Frames.
    :param img_array: NumPy-Array des Eingabebildes.
    :param height_map: Höhenkarte als NumPy-Array.
    :param frame_count: Anzahl der Frames.
    :param frequency: Frequenz der Wellenbewegung.
    :param phase_shift: Phasenverschiebung der Wellenbewegung.
    :param amplitude_multiplier: Multiplikator zur Verstärkung der Amplitude.
    :param wave_type: Der Typ der Welle (0 = sin, 1 = cos, 2 = sin+cos).
    :return: Verzerrtes Bild für das aktuelle Frame (NumPy-Array).
    """
    distorted_img = np.zeros_like(img_array)
    time_factor = (t / max(frame_count, 1)) * 2 * np.pi * frequency  # Zeitschritt basierend auf der Frequenz

    for y in range(img_array.shape[0]):
        for x in range(img_array.shape[1]):
            if wave_type == 0:  # Sinuswelle
                offset_x = int(height_map[y, x] * np.sin(2 * np.pi * y / img_array.shape[0] + time_factor + phase_shift) * amplitude_multiplier)
                offset_y = int(height_map[y, x] * np.sin(2 * np.pi * x / img_array.shape[1] + time_factor + phase_shift) * amplitude_multiplier)
            elif wave_type == 1:  # Kosinuswelle
                offset_x = int(height_map[y, x] * np.cos(2 * np.pi * y / img_array.shape[0] + time_factor + phase_shift) * amplitude_multiplier)
                offset_y = int(height_map[y, x] * np.cos(2 * np.pi * x / img_array.shape[1] + time_factor + phase_shift) * amplitude_multiplier)
            elif wave_type == 2:  # Sinus und Kosinus kombiniert
                offset_x = int(height_map[y, x] * (np.sin(2 * np.pi * y / img_array.shape[0] + time_factor + phase_shift) + np.cos(2 * np.pi * x / img_array.shape[1] + time_factor + phase_shift)) * amplitude_multiplier)
                offset_y = int(height_map[y, x] * (np.cos(2 * np.pi * y / img_array.shape[0] + time_factor + phase_shift) + np.sin(2 * np.pi * x / img_array.shape[1] + time_factor + phase_shift)) * amplitude_multiplier)
            else:
                raise ValueError("Ungültiger wave_type. Verwende 0 für sin, 1 für cos oder 2 für sin+cos.")

            new_x = np.clip(x + offset_x, 0, img_array.shape[1] - 1)
            new_y = np.clip(y + offset_y, 0, img_array.shape[0] - 1)

            distorted_img[y, x] = img_array[new_y, new_x]

    return distorted_img

def create_wave_animation(img_array, height_map, frame_count, frequency=1.0, phase_shift=0.0, amplitude_multiplier=1.0, wave_type=0):
    """
    Erstellt eine Wellenanimation basierend auf der Höhenkarte mit zusätzlicher Feinjustierung.

    :param img_array: NumPy-Array des Eingabebildes.
    :param height_map: Höhenkarte als NumPy-Array.
    :param frame_count: Anzahl der Frames.
    :param frequency: Frequenz der Wellenbewegung.
    :param phase_shift: Phasenverschiebung der Wellenbewegung.
    :param amplitude_multiplier: Multiplikator zur Verstärkung der Amplitude.
    :param wave_type: Der Typ der Welle (0 = sin, 1 = cos, 2 = sin+cos).
    :return: Liste von Frames (Pillow Images).
    """

    # Tracking der Startzeit
    start_time = time.time()
    print("Starte Berechnung der Wellenanimation...")

    # CPU-Kern-Auslastung
    cpu_count = multiprocessing.cpu_count()
    print(f"Verfügbare CPU-Kerne: {cpu_count}")
    print(f"Verwendete CPU-Kerne: {ANIMATION_SETTINGS['cpu_threads']}")

    # Wenn frame_count > 1, verwenden wir multiprocessing für die parallele Verarbeitung der Frames
    if frame_count > 1:
        with multiprocessing.Pool(processes=ANIMATION_SETTINGS["cpu_threads"]) as pool:
            frames = pool.starmap(process_frame, [(t, img_array, height_map, frame_count, frequency, phase_shift, amplitude_multiplier, wave_type) for t in range(frame_count)])

        # Wenn GPU aktiviert ist, konvertieren wir die Frames mit Torch auf die GPU
        if ANIMATION_SETTINGS["use_gpu"]:
            print("Verwenden der GPU für Berechnungen.")
            for idx, frame in enumerate(frames):
                # Verwandelt NumPy Array in Tensor und überträgt es auf die GPU, wenn verfügbar
                frames[idx] = torch.tensor(frame).to(torch.device("cuda" if ANIMATION_SETTINGS["use_gpu"] else "cpu")).cpu().numpy()

        # Konvertiere jedes berechnete Frame zu einem Pillow Image
        print("Frames erfolgreich berechnet.")
        print(f"Verwendete Zeit für die Animation mit {frame_count} Frames: {time.time() - start_time:.2f} Sekunden")

        return [Image.fromarray(frame) for frame in frames]

    # Falls nur ein Frame benötigt wird
    else:
        distorted_img = process_frame(0, img_array, height_map, frame_count, frequency, phase_shift, amplitude_multiplier, wave_type)
        distorted_img = np.array(distorted_img)  # Zurückgeben eines leeren Arrays für das einzelne Frame
        print(f"Verwendete Zeit für 1 Frame: {time.time() - start_time:.2f} Sekunden")
        return distorted_img  # Das verzerrte Bild als NumPy-Array zurückgeben
