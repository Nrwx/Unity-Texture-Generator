from PIL import Image
import numpy as np
import torch
import multiprocessing
import time


def process_frame_gpu(t, img_tensor, height_map_tensor, frame_count, frequency, phase_shift, amplitude_multiplier, wave_type, device):
    """Verarbeitet einen Frame auf der GPU."""
    time_factor = (t / max(frame_count, 1)) * 2 * np.pi * frequency
    time_factor_tensor = torch.tensor(time_factor, device=device, dtype=torch.float32)

    # Erstelle Koordinatensystem
    y_coords, x_coords = torch.meshgrid(
        torch.arange(img_tensor.shape[1], device=device, dtype=torch.float32),
        torch.arange(img_tensor.shape[2], device=device, dtype=torch.float32),
        indexing='ij'
    )

    if wave_type == 0:  # Sinuswelle
        offsets_x = height_map_tensor * torch.sin(2 * np.pi * y_coords / img_tensor.shape[1] + time_factor_tensor + phase_shift) * amplitude_multiplier
        offsets_y = height_map_tensor * torch.sin(2 * np.pi * x_coords / img_tensor.shape[2] + time_factor_tensor + phase_shift) * amplitude_multiplier
    elif wave_type == 1:  # Cosinuswelle
        offsets_x = height_map_tensor * torch.cos(2 * np.pi * y_coords / img_tensor.shape[1] + time_factor_tensor + phase_shift) * amplitude_multiplier
        offsets_y = height_map_tensor * torch.cos(2 * np.pi * x_coords / img_tensor.shape[2] + time_factor_tensor + phase_shift) * amplitude_multiplier
    elif wave_type == 2:  # Kombination aus Sinus und Cosinus
        offsets_x = height_map_tensor * (torch.sin(2 * np.pi * y_coords / img_tensor.shape[1] + time_factor_tensor + phase_shift) +
                                         torch.cos(2 * np.pi * x_coords / img_tensor.shape[2] + time_factor_tensor + phase_shift)) * amplitude_multiplier
        offsets_y = height_map_tensor * (torch.cos(2 * np.pi * y_coords / img_tensor.shape[1] + time_factor_tensor + phase_shift) +
                                         torch.sin(2 * np.pi * x_coords / img_tensor.shape[2] + time_factor_tensor + phase_shift)) * amplitude_multiplier
    elif wave_type == 3:  # Welle von innen nach außen
        center_y = img_tensor.shape[1] / 2
        center_x = img_tensor.shape[2] / 2
        dist_y = y_coords - center_y
        dist_x = x_coords - center_x
        distance = torch.sqrt(dist_x**2 + dist_y**2)
        offsets_x = height_map_tensor * torch.sin(distance / img_tensor.shape[1] * 2 * np.pi + time_factor_tensor + phase_shift) * amplitude_multiplier
        offsets_y = height_map_tensor * torch.sin(distance / img_tensor.shape[2] * 2 * np.pi + time_factor_tensor + phase_shift) * amplitude_multiplier
    elif wave_type == 4:  # Welle von außen nach innen
        center_y = img_tensor.shape[1] / 2
        center_x = img_tensor.shape[2] / 2
        dist_y = y_coords - center_y
        dist_x = x_coords - center_x
        distance = torch.sqrt(dist_x**2 + dist_y**2)
        offsets_x = height_map_tensor * torch.cos(distance / img_tensor.shape[1] * 2 * np.pi + time_factor_tensor + phase_shift) * amplitude_multiplier
        offsets_y = height_map_tensor * torch.cos(distance / img_tensor.shape[2] * 2 * np.pi + time_factor_tensor + phase_shift) * amplitude_multiplier
    elif wave_type == 5:  # Zufällige Wellen
        offsets_x = torch.randn_like(height_map_tensor) * amplitude_multiplier
        offsets_y = torch.randn_like(height_map_tensor) * amplitude_multiplier
    else:
        raise ValueError("Ungültiger wave_type. Verwende 0 für sin, 1 für cos oder 2 für sin+cos.")

    # Neue Koordinaten berechnen und beschneiden
    new_x = torch.clamp((x_coords + offsets_x).long(), 0, img_tensor.shape[2] - 1)
    new_y = torch.clamp((y_coords + offsets_y).long(), 0, img_tensor.shape[1] - 1)

    # Erzeuge das verzerrte Bild
    distorted_img = img_tensor[:, new_y, new_x]
    return distorted_img


def process_frame_cpu(t, img_array, height_map, frame_count, frequency, phase_shift, amplitude_multiplier, wave_type):
    time_factor = (t / max(frame_count, 1)) * 2 * np.pi * frequency
    distorted_img = np.zeros_like(img_array)

    for y in range(img_array.shape[0]):
        for x in range(img_array.shape[1]):
            if wave_type == 0:
                offset_x = int(height_map[y, x] * np.sin(2 * np.pi * y / img_array.shape[0] + time_factor + phase_shift) * amplitude_multiplier)
                offset_y = int(height_map[y, x] * np.sin(2 * np.pi * x / img_array.shape[1] + time_factor + phase_shift) * amplitude_multiplier)
            elif wave_type == 1:
                offset_x = int(height_map[y, x] * np.cos(2 * np.pi * y / img_array.shape[0] + time_factor + phase_shift) * amplitude_multiplier)
                offset_y = int(height_map[y, x] * np.cos(2 * np.pi * x / img_array.shape[1] + time_factor + phase_shift) * amplitude_multiplier)
            elif wave_type == 2:
                offset_x = int(height_map[y, x] * (np.sin(2 * np.pi * y / img_array.shape[0] + time_factor + phase_shift) + np.cos(2 * np.pi * x / img_array.shape[1] + time_factor + phase_shift)) * amplitude_multiplier)
                offset_y = int(height_map[y, x] * (np.cos(2 * np.pi * y / img_array.shape[0] + time_factor + phase_shift) + np.sin(2 * np.pi * x / img_array.shape[1] + time_factor + phase_shift)) * amplitude_multiplier)
            elif wave_type == 3:  # Welle von innen nach außen
                center_y = img_array.shape[0] / 2
                center_x = img_array.shape[1] / 2
                dist_y = y - center_y
                dist_x = x - center_x
                distance = np.sqrt(dist_x**2 + dist_y**2)
                offset_x = int(height_map[y, x] * np.sin(distance / img_array.shape[0] * 2 * np.pi + time_factor + phase_shift) * amplitude_multiplier)
                offset_y = int(height_map[y, x] * np.sin(distance / img_array.shape[1] * 2 * np.pi + time_factor + phase_shift) * amplitude_multiplier)
            elif wave_type == 4:  # Welle von außen nach innen
                center_y = img_array.shape[0] / 2
                center_x = img_array.shape[1] / 2
                dist_y = y - center_y
                dist_x = x - center_x
                distance = np.sqrt(dist_x**2 + dist_y**2)
                offset_x = int(height_map[y, x] * np.cos(distance / img_array.shape[0] * 2 * np.pi + time_factor + phase_shift) * amplitude_multiplier)
                offset_y = int(height_map[y, x] * np.cos(distance / img_array.shape[1] * 2 * np.pi + time_factor + phase_shift) * amplitude_multiplier)
            elif wave_type == 5:  # Zufällige Wellen
                offset_x = int(np.random.randn() * amplitude_multiplier)
                offset_y = int(np.random.randn() * amplitude_multiplier)
            else:
                raise ValueError("Ungültiger wave_type. Verwende Werte von 0 bis 5.")

            new_x = np.clip(x + offset_x, 0, img_array.shape[1] - 1)
            new_y = np.clip(y + offset_y, 0, img_array.shape[0] - 1)

            distorted_img[y, x] = img_array[new_y, new_x]

    return distorted_img


def create_wave_animation(settings, img_array, height_map, frame_count, frequency=1.0, phase_shift=0.0, amplitude_multiplier=1.0, wave_type=0):
    start_time = time.time()
    print("Starte Berechnung der Wellenanimation...")

    use_gpu = settings.get("use_gpu", False)
    cpu_threads = settings.get("cpu_threads", multiprocessing.cpu_count())

    frames = []

    if frame_count > 1:
        if use_gpu:
            print("Verwenden der GPU für Berechnungen.")
            device = torch.device("cuda")

            # Daten auf die GPU übertragen
            img_tensor = torch.tensor(img_array, device=device).permute(2, 0, 1).float()  # HWC -> CHW
            height_map_tensor = torch.tensor(height_map, device=device, dtype=torch.float32)

            # Frames berechnen
            for t in range(frame_count):
                frame = process_frame_gpu(t, img_tensor, height_map_tensor, frame_count, frequency, phase_shift, amplitude_multiplier, wave_type, device)
                frames.append(frame.cpu().numpy().astype(np.uint8).transpose(1, 2, 0))  # CHW -> HWC
        else:
            print("Verwenden der CPU für Berechnungen.")
            with multiprocessing.Pool(processes=cpu_threads) as pool:
                frames = pool.starmap(process_frame_cpu, [
                    (t, img_array, height_map, frame_count, frequency, phase_shift, amplitude_multiplier, wave_type)
                    for t in range(frame_count)
                ])

        print("Frames erfolgreich berechnet.")
        print(f"Verwendete Zeit für die Animation mit {frame_count} Frames: {time.time() - start_time:.2f} Sekunden")

        return [Image.fromarray(frame) for frame in frames]
    else:
        if use_gpu:
            print("Verwenden der GPU für 1 Frame.")
            device = torch.device("cuda")
            img_tensor = torch.tensor(img_array, device=device).permute(2, 0, 1).float()  # HWC -> CHW
            height_map_tensor = torch.tensor(height_map, device=device, dtype=torch.float32)
            frame = process_frame_gpu(0, img_tensor, height_map_tensor, frame_count, frequency, phase_shift, amplitude_multiplier, wave_type, device)
            frame = frame.cpu().numpy().astype(np.uint8).transpose(1, 2, 0)  # CHW -> HWC
        else:
            print("Verwenden der CPU für 1 Frame.")
            frame = process_frame_cpu(0, img_array, height_map, frame_count, frequency, phase_shift, amplitude_multiplier, wave_type)

        print(f"Verwendete Zeit für 1 Frame: {time.time() - start_time:.2f} Sekunden")
        return frame
