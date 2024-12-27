from PIL import Image, ImageOps
import numpy as np

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
    if frame_count == 1:
        distorted_img = np.zeros_like(img_array)
        for y in range(img_array.shape[0]):
            for x in range(img_array.shape[1]):
                if wave_type == 0:  # Sinuswelle
                    offset_x = int(height_map[y, x] * np.sin(frequency * 2 * np.pi * y / img_array.shape[0] + phase_shift))
                    offset_y = int(height_map[y, x] * np.sin(frequency * 2 * np.pi * x / img_array.shape[1] + phase_shift))
                elif wave_type == 1:  # Kosinuswelle
                    offset_x = int(height_map[y, x] * np.cos(frequency * 2 * np.pi * y / img_array.shape[0] + phase_shift))
                    offset_y = int(height_map[y, x] * np.cos(frequency * 2 * np.pi * x / img_array.shape[1] + phase_shift))
                elif wave_type == 2:  # Sinus und Kosinus kombiniert
                    offset_x = int(height_map[y, x] * (np.sin(frequency * 2 * np.pi * y / img_array.shape[0] + phase_shift) + np.cos(frequency * 2 * np.pi * x / img_array.shape[1] + phase_shift)))
                    offset_y = int(height_map[y, x] * (np.cos(frequency * 2 * np.pi * y / img_array.shape[0] + phase_shift) + np.sin(frequency * 2 * np.pi * x / img_array.shape[1] + phase_shift)))
                else:
                    raise ValueError("Ungültiger wave_type. Verwende 0 für sin, 1 für cos oder 2 für sin+cos.")

                new_x = np.clip(x + offset_x, 0, img_array.shape[1] - 1)
                new_y = np.clip(y + offset_y, 0, img_array.shape[0] - 1)

                distorted_img[y, x] = img_array[new_y, new_x]

        return distorted_img

    frames = []
    for t in range(frame_count):
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

        frame = Image.fromarray(distorted_img)
        frames.append(frame)

    return frames
