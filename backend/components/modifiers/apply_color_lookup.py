from PIL import Image, ImageEnhance, ImageFilter
import random
import cv2
import numpy as np
from scipy.ndimage import map_coordinates

def apply_color_lookup(image, color_lookup_mode: int):
    # Prüfen, ob das Bild ein PIL Image ist
    if isinstance(image, Image.Image):
        img = np.array(image)  # Konvertiere PIL Image in NumPy Array
    elif isinstance(image, np.ndarray):
        img = image  # Falls es schon ein NumPy Array ist, nutze es direkt
    else:
        raise TypeError("Das Bild muss entweder ein PIL Image oder ein NumPy Array sein.")

    # Bildgröße
    height, width = img.shape[:2]

    # Sicherstellen, dass das Bild im RGBA-Format ist
    img = Image.fromarray(img).convert("RGBA")
    np_img = np.array(img)

    # Alpha-Kanal extrahieren und eine Maske erstellen
    alpha = np_img[:, :, 3]  # Extrahiert den Alpha-Kanal
    alpha_mask = alpha / 255.0  # Maske (normalisiert auf [0, 1])

    # Farboperationen je nach color_lookup_mode
    if color_lookup_mode == 0:  # Neutral
        return img
    elif color_lookup_mode == 1:  # Warm
        gamma = 1.2  # Wert für die Gamma-Korrektur
        np_img = np_img / 255.0  # Bild auf den Bereich [0, 1] skalieren
        np_img = np_img ** gamma  # Anwendung der Gamma-Korrektur
        np_img = np_img * 255.0  # Zurück auf den Bereich [0, 255] skalieren
        np_img[:, :, 0] = np_img[:, :, 0] * 1.25  # Rotkanal (stärker betonen)
        np_img[:, :, 1] = np_img[:, :, 1] * 1.05  # Grünton leicht anheben
        np_img[:, :, 2] = np_img[:, :, 2] * 0.85  # Blauen Anteil verringern
        np_img = cv2.GaussianBlur(np_img, (5, 5), 0)  # Sanftere Übergänge durch Weichzeichnung
    elif color_lookup_mode == 2:  # Cold
        gamma = 1.2  # Wert für die Gamma-Korrektur
        np_img = np_img / 255.0  # Bild auf den Bereich [0, 1] skalieren
        np_img = np_img ** gamma  # Anwendung der Gamma-Korrektur
        np_img = np_img * 255.0  # Zurück auf den Bereich [0, 255] skalieren
        np_img[:, :, 0] = np_img[:, :, 0] * 0.9
        np_img[:, :, 1] = np_img[:, :, 1] * 0.9
        np_img[:, :, 2] = np_img[:, :, 2] * 1.2
        np_img = cv2.GaussianBlur(np_img, (5, 5), 0)  # Sanftere Übergänge durch Weichzeichnung
    elif color_lookup_mode == 3:  # Sepia
        gamma = 1.2  # Wert für die Gamma-Korrektur
        np_img = np_img / 255.0  # Bild auf den Bereich [0, 1] skalieren
        np_img = np_img ** gamma  # Anwendung der Gamma-Korrektur
        np_img = np_img * 255.0  # Zurück auf den Bereich [0, 255] skalieren
        np_img[:, :, 0] = np_img[:, :, 0] * 1.2  # Rottöne stärker betonen
        np_img[:, :, 1] = np_img[:, :, 1] * 0.8  # Grüntöne etwas dämpfen
        np_img[:, :, 2] = np_img[:, :, 2] * 0.6  # Blautöne weiter verringern
        np_img = cv2.GaussianBlur(np_img, (5, 5), 0)  # Sanftere Übergänge durch Weichzeichnung
    elif color_lookup_mode == 4:  # Black & White
        grayscale_img = np.dot(np_img[..., :3], [0.2989, 0.5870, 0.1140])
        grayscale_img = cv2.GaussianBlur(grayscale_img.astype(np.uint8), (5, 5), 0)
        grayscale_img = np.clip(grayscale_img, 0, 255).astype(np.uint8)
        return grayscale_img
    elif color_lookup_mode == 5:  # High Contrast
        gray_img = cv2.cvtColor(np_img, cv2.COLOR_RGB2GRAY)
        contrast_img = np.clip(gray_img * 1.5, 0, 255).astype(np.uint8)
        np_img[:, :, 0] = np.clip(np_img[:, :, 0] * (contrast_img / 255.0), 0, 255)
        np_img[:, :, 1] = np.clip(np_img[:, :, 1] * (contrast_img / 255.0), 0, 255)
        np_img[:, :, 2] = np.clip(np_img[:, :, 2] * (contrast_img / 255.0), 0, 255)
        np_img = cv2.GaussianBlur(np_img, (5, 5), 0)
    elif color_lookup_mode == 6:  # Vintage
        gamma = 1.3  # Gamma-Wert für das Aufhellen des Bildes
        np_img = np_img / 255.0  # Bild auf den Bereich [0, 1] skalieren
        np_img = np_img ** gamma  # Gamma-Korrektur anwenden
        np_img = np_img * 255.0  # Bild zurück auf den Bereich [0, 255] skalieren
        np_img[:, :, 0] = np_img[:, :, 0] * 1.1  # Rot-Kanal leicht verstärken (warmer Vintage-Ton)
        np_img[:, :, 1] = np_img[:, :, 1] * 1.0  # Grün-Kanal beibehalten (neutraler)
        np_img[:, :, 2] = np_img[:, :, 2] * 0.8  # Blau-Kanal leicht dämpfen (verblasster Look)
        np_img = cv2.GaussianBlur(np_img, (5, 5), 0)
    elif color_lookup_mode == 7:  # Night Vision (Green)
        np_img[:, :, 0] = np_img[:, :, 0] * 0.5  # Rot-Kanal reduzieren
        np_img[:, :, 1] = np_img[:, :, 1] * 1.0  # Grün-Kanal beibehalten
        np_img[:, :, 2] = np_img[:, :, 2] * 0.5  # Blau-Kanal reduzieren
        gamma = 1.2  # Gamma-Wert, um die dunklen Bereiche stärker herauszustellen
        np_img = np_img / 255.0  # Bild auf den Bereich [0, 1] skalieren
        np_img = np_img ** gamma  # Gamma-Korrektur anwenden
        np_img = np_img * 255.0  # Bild zurück auf den Bereich [0, 255] skalieren
        return np_img
    elif color_lookup_mode == 8:  # Sunset
        np_img[:, :, 0] = np_img[:, :, 0] * 1.3  # Rot-Kanal verstärken
        np_img[:, :, 1] = np_img[:, :, 1] * 1.1  # Grün-Kanal leicht verstärken
        np_img[:, :, 2] = np_img[:, :, 2] * 0.6  # Blau-Kanal sanfter dämpfen
        gamma = 1.3  # Höherer Gamma-Wert für stärkere Helligkeit
        np_img = np_img / 255.0  # Bild auf den Bereich [0, 1] skalieren
        np_img = np_img ** gamma  # Gamma-Korrektur anwenden
        np_img = np_img * 255.0  # Bild zurück auf den Bereich [0, 255] skalieren
        np_img = np_img.astype(np.uint8)
        glow = np_img * 1.5  # Verstärkter Glüheffekt (stärker aufhellen)
        glow = np.clip(glow, 0, 255)  # Sicherstellen, dass die Werte im Bereich [0, 255] bleiben
        np_img = cv2.addWeighted(np_img, 0.6, glow.astype(np.uint8), 0.4, 0)  # Glow wird stärker betont
        blue_overdrive = np_img[:, :, 2] * 1.5  # Blau-Kanal stärker übersteuern
        blue_overdrive = np.clip(blue_overdrive, 0, 255)  # Sicherstellen, dass keine Werte über 255 gehen
        np_img[:, :, 2] = cv2.addWeighted(np_img[:, :, 2], 0.6, blue_overdrive.astype(np.uint8), 0.4, 0)
        img_pil = cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR)  # Umwandlung zu BGR für PIL-Kompatibilität
        pil_img = cv2.cvtColor(img_pil, cv2.COLOR_BGR2RGB)  # Zurück zu RGB für PIL
        enhancer = ImageEnhance.Contrast(Image.fromarray(pil_img))
        pil_img = enhancer.enhance(1.3)  # Kontrast um den Faktor 1.3 erhöhen
        np_img = np.array(pil_img)  # Zurück zu NumPy-Array konvertieren
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)
        np_img = cv2.GaussianBlur(np_img, (5, 5), 0)
        return np_img
    elif color_lookup_mode == 9:  # Blueish
        np_img[:, :, 0] = np_img[:, :, 0] * 0.7  # Rot-Kanal abschwächen
        np_img[:, :, 1] = np_img[:, :, 1] * 0.7  # Grün-Kanal abschwächen
        np_img[:, :, 2] = np_img[:, :, 2] * 1.3  # Blau-Kanal verstärken
        gamma = 1.2  # Höherer Gamma-Wert, um das Bild insgesamt aufzuhellen
        np_img = np_img / 255.0  # Bild auf den Bereich [0, 1] skalieren
        np_img = np_img ** gamma  # Gamma-Korrektur anwenden
        np_img = np_img * 255.0  # Bild zurück auf den Bereich [0, 255] skalieren
        np_img = np_img.astype(np.uint8)
        img_pil = cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR)  # Umwandlung zu BGR für PIL-Kompatibilität
        pil_img = cv2.cvtColor(img_pil, cv2.COLOR_BGR2RGB)  # Zurück zu RGB für PIL
        enhancer = ImageEnhance.Contrast(Image.fromarray(pil_img))
        pil_img = enhancer.enhance(1.2)  # Kontrast um den Faktor 1.2 erhöhen
        np_img = np.array(pil_img)  # Zurück zu NumPy-Array konvertieren
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)
        np_img = cv2.GaussianBlur(np_img, (5, 5), 0)
        return np_img
    elif color_lookup_mode == 10:  # Overexposed
        np_img = np_img + 40
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)
        gamma = 1.1  # Etwas höhere Gamma-Werte, um das Bild weiter aufzuhellen
        np_img = np_img / 255.0  # Bild auf den Bereich [0, 1] skalieren
        np_img = np_img ** gamma  # Gamma-Korrektur anwenden
        np_img = np_img * 255.0  # Bild zurück auf den Bereich [0, 255] skalieren
        return np_img
    elif color_lookup_mode == 11:  # Muted
        np_img[:, :, 0] = np_img[:, :, 0] * 0.85  # Rot-Kanal leicht reduzieren
        np_img[:, :, 1] = np_img[:, :, 1] * 0.85  # Grün-Kanal leicht reduzieren
        np_img[:, :, 2] = np_img[:, :, 2] * 0.85  # Blau-Kanal leicht reduzieren
        gamma = 1.3  # Gamma-Wert für eine sanftere Dunkelung
        np_img = np_img / 255.0  # Bild auf den Bereich [0, 1] skalieren
        np_img = np_img ** gamma  # Gamma-Korrektur anwenden
        np_img = np_img * 255.0  # Bild zurück auf den Bereich [0, 255] skalieren
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)
        np_img = cv2.GaussianBlur(np_img, (5, 5), 0)
        return np_img
    elif color_lookup_mode == 12:  # Retro
        np_img[:, :, 0] = np_img[:, :, 0] * 1.2  # Rot-Kanal leicht verstärken
        np_img[:, :, 1] = np_img[:, :, 1] * 1.0  # Grün-Kanal bleibt unverändert
        np_img[:, :, 2] = np_img[:, :, 2] * 0.8  # Blau-Kanal leicht dämpfen
        gamma = 1.2  # Gamma-Wert für eine sanfte Aufhellung
        np_img = np_img / 255.0  # Bild auf den Bereich [0, 1] skalieren
        np_img = np_img ** gamma  # Gamma-Korrektur anwenden
        np_img = np_img * 255.0  # Bild zurück auf den Bereich [0, 255] skalieren
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)
        np_img = cv2.GaussianBlur(np_img, (5, 1), 0)
        return np_img
    elif color_lookup_mode == 13:  # Dramatic
        np_img[:, :, 0] = np_img[:, :, 0] * 1.3  # Rot-Kanal verstärken
        np_img[:, :, 1] = np_img[:, :, 1] * 1.3  # Grün-Kanal verstärken
        np_img[:, :, 2] = np_img[:, :, 2] * 1.0  # Blau-Kanal bleibt gleich
        gamma = 1.2  # Gamma-Wert für stärkere Mitteltöne
        np_img = np_img / 255.0  # Bild auf den Bereich [0, 1] skalieren
        np_img = np_img ** gamma  # Gamma-Korrektur anwenden
        np_img = np_img * 255.0  # Zurück zu [0, 255] skalieren
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)  # Werte begrenzen
        img_pil = Image.fromarray(cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR))  # PIL benötigt BGR-Format
        enhancer = ImageEnhance.Contrast(img_pil)
        img_pil = enhancer.enhance(1.5)  # Kontrastverstärkung um den Faktor 1.5
        np_img = np.array(img_pil)  # Zurück zu NumPy-Array konvertieren
        np_img = cv2.cvtColor(np_img, cv2.COLOR_BGR2RGB)  # Zurück zu RGB konvertieren
        rows, cols, _ = np_img.shape
        X_resultant_kernel = cv2.getGaussianKernel(cols, cols / 2)
        Y_resultant_kernel = cv2.getGaussianKernel(rows, rows / 2)
        resultant_kernel = Y_resultant_kernel * X_resultant_kernel.T
        mask = 255 * resultant_kernel / np.linalg.norm(resultant_kernel)
        vignette = np.zeros_like(np_img, dtype=np.float32)
        for i in range(3):  # Auf alle Kanäle anwenden
            vignette[:, :, i] = np_img[:, :, i] * mask
        np_img = np.clip(vignette, 0, 255).astype(np.uint8)
        return np_img
    elif color_lookup_mode == 14:  # Faded
        gamma = 0.9  # Reduziert die Intensität von Tiefen
        np_img = np_img / 255.0  # Skalieren auf [0, 1]
        np_img = np_img ** gamma  # Gamma-Korrektur anwenden
        np_img = np_img * 255.0  # Skalieren zurück auf [0, 255]
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)  # Werte begrenzen
        img_pil = Image.fromarray(cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR))  # PIL benötigt BGR-Format
        enhancer = ImageEnhance.Color(img_pil)
        img_pil = enhancer.enhance(0.6)  # Farbintensität auf 60% reduzieren
        np_img = np.array(img_pil)  # Zurück zu NumPy-Array konvertieren
        np_img = cv2.cvtColor(np_img, cv2.COLOR_BGR2RGB)  # Zurück zu RGB konvertieren
        enhancer = ImageEnhance.Contrast(Image.fromarray(np_img))
        img_pil = enhancer.enhance(0.8)  # Kontrast um 80% verringern
        np_img = np.array(img_pil)  # Zurück zu NumPy-Array konvertieren
        # Schritt 4: Optionale Tönung (hier leicht warm)
        tint = np.array([1.1, 1.05, 1.0])  # Verstärkt Rot und Grün minimal
        np_img = np_img * tint[np.newaxis, np.newaxis, :]
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)  # Begrenzung auf gültige Pixelwerte
        return np_img
    elif color_lookup_mode == 15:  # Soft
        if np_img.shape[2] == 4:  # RGBA-Bild
            alpha_channel = np_img[:, :, 3]  # Alpha-Kanal separat speichern
            np_img = np_img[:, :, :3]  # Nur RGB verarbeiten
        gamma = 1.1  # Leichte Aufhellung
        np_img = np_img / 255.0  # Skalieren auf [0, 1]
        np_img = np_img ** gamma  # Gamma-Korrektur anwenden
        np_img = np_img * 255.0  # Skalieren zurück auf [0, 255]
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)
        tint = np.array([1.0, 1.2, 1.0])  # Nur der Grün-Kanal wird verstärkt
        np_img = np_img * tint[np.newaxis, np.newaxis, :]
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)
        np_img = cv2.GaussianBlur(np_img, (7, 7), 0)
        glow = cv2.GaussianBlur(np_img, (15, 15), 0)  # Noch stärker weichgezeichnet
        np_img = cv2.addWeighted(np_img, 0.8, glow, 0.2, 0)  # Überblendung
        img_pil = Image.fromarray(cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR))  # PIL benötigt BGR
        enhancer = ImageEnhance.Contrast(img_pil)
        img_pil = enhancer.enhance(1.05)  # Kontrast leicht verstärken (5%)
        np_img = np.array(img_pil)  # Zurück zu NumPy-Array konvertieren
        np_img = cv2.cvtColor(np_img, cv2.COLOR_BGR2RGB)  # Zurück zu RGB für Konsistenz
        if 'alpha_channel' in locals():
            np_img = np.dstack((np_img, alpha_channel))
        return np_img
    elif color_lookup_mode == 16:  # Icy Film Look
        if np_img.shape[2] == 4:  # RGBA-Bild
            alpha_channel = np_img[:, :, 3]  # Alpha-Kanal separat speichern
            np_img = np_img[:, :, :3]  # Nur RGB verarbeiten
        gamma = 1.2  # Leichte Verdunkelung
        np_img = np_img / 255.0  # Auf [0, 1] skalieren
        np_img = np_img ** gamma  # Gamma-Korrektur anwenden
        np_img = np_img * 255.0  # Zurück auf [0, 255] skalieren
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)
        tint = np.array([0.7, 0.8, 1.2])  # Rot: weniger, Grün: neutral, Blau: stärker
        np_img = np_img * tint[np.newaxis, np.newaxis, :]
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)
        img_pil = Image.fromarray(cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR))  # PIL erwartet BGR
        enhancer = ImageEnhance.Contrast(img_pil)
        img_pil = enhancer.enhance(1.1)  # Kontrast leicht verstärken (10%)
        np_img = np.array(img_pil)  # Zurück zu NumPy-Array konvertieren
        np_img = cv2.cvtColor(np_img, cv2.COLOR_BGR2RGB)  # RGB für Konsistenz
        np_img = cv2.GaussianBlur(np_img, (5, 5), 0)
        glow = cv2.GaussianBlur(np_img, (15, 15), 0)  # Intensiverer Blur
        np_img = cv2.addWeighted(np_img, 0.85, glow, 0.15, 0)  # Weicher Glow
        if 'alpha_channel' in locals():
            np_img = np.dstack((np_img, alpha_channel))
        return np_img
    elif color_lookup_mode == 17:  # Sandig
       # Höhe, Breite und Kanäle extrahieren
        height, width, channels = np_img.shape

        # Schritt 1: Alpha-Kanal prüfen und extrahieren
        if channels == 4:  # RGBA-Bild
            alpha_channel = np_img[:, :, 3]  # Alpha-Kanal extrahieren
            np_img = np_img[:, :, :3]  # Nur RGB für Verarbeitung
        else:
            alpha_channel = np.zeros((height, width), dtype=np.float32)

        # Schritt 2: Grund-Look (Sandige Farbtöne)
        gamma = 1.1  # Leichte Aufhellung
        np_img = np_img / 255.0
        np_img = np_img ** gamma
        np_img = np_img * 255.0
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)

        # Farbton-Verstärkung für den sandigen Look
        tint = np.array([1.3, 1.1, 0.8])  # Sandfarbene Töne
        np_img = np_img * tint
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)

        # Schritt 3: Körnige Maske generieren
        grain_mask = np.random.uniform(0.8, 1.2, size=(height, width))  # Zufälliges Rauschmuster
        grain_mask = cv2.GaussianBlur(grain_mask, (5, 5), 0)  # Weichzeichnen für realistische Körnung
        grain_mask = (grain_mask * 255).astype(np.uint8)  # Skalieren auf [0, 255]

        # Schritt 4: Farbverlauf erstellen (sandiger Verlauf)
        gradient = np.linspace(0.35, 0.35, height).reshape(-1, 1)  # Vertikaler Verlauf von dunklerem Sand zu hellerem
        gradient = np.tile(gradient, (1, width))  # Verlauf auf die Bildbreite ausdehnen

        gradient_color = np.stack([
            gradient * 255 * 1.3,  # Rot-Kanal (verstärkt)
            gradient * 255 * 1.1,  # Grün-Kanal (neutral)
            gradient * 255 * 0.8   # Blau-Kanal (gedämpft)
        ], axis=-1).astype(np.uint8)

        # Schritt 5: Körnige Maske mit Farbverlauf färben
        grain_mask_color = np.stack([grain_mask] * 3, axis=-1)  # Körnige Maske in drei Kanäle kopieren
        grain_mask_color = grain_mask_color * (gradient_color / 255.0)  # Mit Farbverlauf multiplizieren
        grain_mask_color = np.clip(grain_mask_color, 0, 255).astype(np.uint8)

        # Schritt 6: Körnige Maske mit Bild überlagern
        alpha_norm = alpha_channel / 255.0  # Normalisierte Alpha-Werte
        alpha_mask = np.stack([alpha_norm] * 3, axis=-1)  # Erstellen einer 3-Kanal-Maske basierend auf Alpha

        # Überlagern der Körnung mit Farbverlauf auf das Bild
        np_img = cv2.addWeighted(
            np_img.astype(np.float32), 0.8,  # Originalbild mit 80% Gewichtung
            (grain_mask_color * alpha_mask).astype(np.float32), 0.4,  # Körnige Maske mit Verlauf
            0
        ).astype(np.uint8)

        # Schritt 7: Sättigung und Glow für den sandigen Look
        img_pil = Image.fromarray(cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR))
        enhancer = ImageEnhance.Color(img_pil)
        img_pil = enhancer.enhance(1.2)  # Sättigung um 20% erhöhen
        np_img = np.array(img_pil)
        np_img = cv2.cvtColor(np_img, cv2.COLOR_BGR2RGB)

        # Weichzeichnung für finalen Look
        np_img = cv2.GaussianBlur(np_img, (5, 5), 0)

        # Schritt 8: Alpha-Kanal wieder hinzufügen
        if alpha_channel is not None:
            np_img = np.dstack((np_img, alpha_channel))

        return np_img
    elif color_lookup_mode == 18:  # Flüssig
        height, width, channels = np_img.shape

        # Schritt 1: Erzeugen der Wellen/Verzerrungen (gleiche wie vorher)
        dx = np.sin(np.linspace(0, 2 * np.pi, width)) * 10  # Sinuswelle für die X-Verschiebung
        dy = np.cos(np.linspace(0, 2 * np.pi, height)) * 10  # Cosinuswelle für die Y-Verschiebung

        # Erstellen eines Gitterkoordinatensystems für die Verzerrung
        x, y = np.meshgrid(np.arange(width), np.arange(height))

        # Verzerrung anwenden: Koordinaten um die Sinus- und Cosinuswellen verschieben
        distorted_x = x + dx
        distorted_y = y + dy

        # Anwendung der Verzerrung auf das Bild mit map_coordinates
        np_img_distorted = map_coordinates(np_img, [distorted_y, distorted_x, np.zeros_like(distorted_x)], order=1, mode='reflect')

        # Schritt 2: Laden der Wassertextur
        water_texture = cv2.imread('water_texture.jpg')  # Hier den Pfad zur Wassertextur angeben
        water_texture = cv2.resize(water_texture, (width, height))  # Anpassen der Texturgröße an das Bild
        water_texture = water_texture.astype(np.float32)  # In den Bereich [0, 255] umwandeln

        # Schritt 3: Verzerrung auf die Textur anwenden, um Wellen zu erzeugen
        water_texture_distorted = map_coordinates(water_texture, [distorted_y, distorted_x, np.zeros_like(distorted_x)], order=1, mode='reflect')

        # Schritt 4: Mischen der Textur mit dem Bild
        alpha = 0.3  # Wie stark soll die Textur überlagert werden
        np_img_with_texture = cv2.addWeighted(np_img_distorted.astype(np.uint8), 1 - alpha, water_texture_distorted.astype(np.uint8), alpha, 0)

        # Schritt 5: Erzeugen des Glas- und Chrom-Effekts (Reflexion)
        reflection = np_img_with_texture * 0.7  # Spiegelung durch Multiplizieren mit einem Wert < 1
        reflection = np.clip(reflection, 0, 255)

        # Mischung der Reflexion mit dem verzerrten Bild
        np_img_with_texture = cv2.addWeighted(np_img_with_texture.astype(np.uint8), 0.7, reflection.astype(np.uint8), 0.3, 0)

        # Schritt 6: Anpassen des Glanzes und der Helligkeit (Chrom-Effekt)
        np_img_with_texture = np_img_with_texture * 1.1  # Erhöht den Glanz, indem wir die Bildwerte leicht anheben
        np_img_with_texture = np.clip(np_img_with_texture, 0, 255)  # Sicherstellen, dass keine Werte über 255 hinausgehen

        # Schritt 7: Optional: Weichzeichnung hinzufügen, um den Flüssigkeitseffekt noch glatter zu machen
        np_img_with_texture = cv2.GaussianBlur(np_img_with_texture, (5, 5), 0)

        return np_img
    elif color_lookup_mode == 19:  # Verdreht
        np_img = np_img + np.sin(np_img) * 30  # Verzerrungseffekt
        np_img = np.clip(np_img, 0, 255)
    elif color_lookup_mode == 20:  # Verbrannt mit Glühen und Transparenz
        np_img = np_img.astype(np.float32)  # Verwenden von float32 für genauere Berechnungen
        num_burns = random.randint(1, 3)  # Anzahl der zufälligen Brandstellen
        burn_radius = random.randint(30, 60)  # Zufälliger Radius für die Verbrennung
        for _ in range(num_burns):
            # Zufällige Position für die Verbrennung
            burn_x = random.randint(0, np_img.shape[1] - burn_radius)
            burn_y = random.randint(0, np_img.shape[0] - burn_radius)
            for y in range(burn_y, burn_y + burn_radius):
                for x in range(burn_x, burn_x + burn_radius):
                    # Berechne die Distanz vom Mittelpunkt der Verbrennung (für den Fade-Effekt)
                    dist = np.sqrt((x - (burn_x + burn_radius / 2)) ** 2 + (y - (burn_y + burn_radius / 2)) ** 2)
                    if dist < burn_radius:
                        intensity = max(0, 1 - dist / burn_radius)
                        np_img[y, x, 0] = np_img[y, x, 0] * (1 - 0.5 * intensity) + 255 * 0.5 * intensity  # Rot-Kanal
                        np_img[y, x, 1] = np_img[y, x, 1] * (1 - 0.3 * intensity) + 165 * 0.3 * intensity  # Grün-Kanal
                        np_img[y, x, 2] = np_img[y, x, 2] * (1 - 0.2 * intensity) + 85 * 0.2 * intensity  # Blau-Kanal
                        np_img[y, x, 3] = np_img[y, x, 3] * (1 - intensity) + intensity  # Transparenz von 0 bis 1
        np_img = np.clip(np_img, 0, 255).astype(np.uint8)
    elif color_lookup_mode == 21:  # Nass
        np_img[:, :, 0] = np_img[:, :, 0] * 1.0
        np_img[:, :, 1] = np_img[:, :, 1] * 1.1
        np_img[:, :, 2] = np_img[:, :, 2] * 1.2
    elif color_lookup_mode == 22:  # Glass
        np_img = np_img + np.random.normal(0, 10, np_img.shape)  # Glas-Effekt
        np_img = np.clip(np_img, 0, 255)
    elif color_lookup_mode == 23:  # Milchglas
        img = img.filter(ImageFilter.GaussianBlur(5))  # Milchglas mit Unschärfe
        np_img = np.clip(img, 0, 255).astype(np.uint8)
        return np_img
    elif color_lookup_mode == 24:  # Galaxie
        np_img[:, :, 0] = np_img[:, :, 0] * 1.0
        np_img[:, :, 1] = np_img[:, :, 1] * 0.5
        np_img[:, :, 2] = np_img[:, :, 2] * 1.5
    elif color_lookup_mode == 25:  # Große Tropfen
        np_img = np_img + np.random.normal(0, 30, np_img.shape)  # Tropfen-Effekt
        np_img = np.clip(np_img, 0, 255)

    np_img = np.clip(np_img, 0, 255).astype(np.uint8)
    # Überlagerung mit der Alpha-Maske
    np_img[:, :, :3] = np_img[:, :, :3] * alpha_mask[:, :, np.newaxis]  # Anwenden der Alpha-Maske auf RGB-Kanäle
    np_img[:, :, 3] = alpha  # Den Original-Alpha-Wert wiederherstellen


    return np_img
