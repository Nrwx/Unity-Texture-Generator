import numpy as np
from PIL import Image

def hex_to_rgba(hex_color):
    """Konvertiert einen Hex-Wert in RGBA, wobei der Alpha-Wert berücksichtigt wird."""
    if not isinstance(hex_color, str):
        raise ValueError("Der Eingabewert für hex_color muss ein gültiger Hex-String sein.")

    hex_color = hex_color.lstrip('#')  # Entfernen des "#" Zeichens

    if len(hex_color) == 8:
        r, g, b, a = [int(hex_color[i:i+2], 16) for i in (0, 2, 4, 6)]  # RGBA
    elif len(hex_color) == 6:
        r, g, b = [int(hex_color[i:i+2], 16) for i in (0, 2, 4)]  # RGB ohne Alpha
        a = 255  # Wenn kein Alpha angegeben ist, setzen wir ihn auf 255 (vollständig opak)
    else:
        raise ValueError("Ungültiges Hex-Format. Verwenden Sie entweder #RRGGBB oder #RRGGBBAA.")

    return np.array([r, g, b, a])

def apply_normal(base, alpha):
    """
    Normaler Überlagerungseffekt, der nur das 'base'-Bild und den 'alpha'-Wert verwendet.
    Der Alpha-Wert steuert die Intensität des Effekts.
    """
    # Berechnung des normalen Mischverhältnisses mit dem Alpha-Wert
    result = base * (alpha / 255.0)

    # Sicherstellen, dass die Werte im Bereich [0, 255] bleiben
    return np.clip(result, 0, 255).astype(np.uint8)


def apply_sprenkeln(base, overlay, alpha):
    """Fügt zufälliges Rauschen zum Bild hinzu, um einen Sprenkeleffekt zu erzeugen."""

    # Erzeuge zufälliges Rauschen im Bereich [0, 255]
    noise = np.random.randint(0, 256, base.shape, dtype=np.uint8)

    # Wende den Alpha-Wert an, um die Intensität des Rauschens zu steuern
    noise = np.clip(noise * (alpha / 255.0), 0, 255)  # Alpha skaliert das Rauschen

    # Kombiniere das Basisbild mit dem Rauschen
    result = np.clip(base + noise, 0, 255)  # Das Rauschen wird zum Basisbild hinzugefügt

    return result.astype(np.uint8)


def apply_darken(base, overlay, alpha):
    """
    Dunkelt das Bild flächig wie ein Lichtpunkt-Effekt und verwendet das Overlay-Bild,
    wobei dunkle Bereiche des Basisbildes stärker beeinflusst werden.
    Der Alpha-Wert steuert die Intensität des Dunkelungseffekts.
    """
    # Berechne den Dunkelungseffekt: Wenn die Basisfarbe dunkel ist, wird sie stärker beeinflusst
    result = np.where(base < 128, np.minimum(base, overlay), base)

    # Füge einen kleinen Dimmeffekt für alle Bereiche hinzu
    dimming_factor = 0.8  # Ein Wert für den allgemeinen Dimm-Effekt
    result = result * dimming_factor

    # Wende den Alpha-Wert an, um die Intensität des Effekts zu steuern
    result = np.clip(result * (alpha / 255.0), 0, 255)

    # Sicherstellen, dass die Werte im Bereich [0, 255] bleiben
    return np.clip(result, 0, 255).astype(np.uint8)

def apply_multiply(base, overlay, alpha):
    """Wendet den Multiplizieren-Effekt an: (base * overlay) / 255 und verwendet den Alpha-Wert."""

    # Anwendung des Multiplizieren-Effekts
    result = (base * overlay) / 255.0

    # Anwendung des Alpha-Werts
    result = result * (alpha / 255.0)

    # Sicherstellen, dass die Werte im Bereich [0, 255] bleiben
    return np.clip(result, 0, 255).astype(np.uint8)

def apply_linear_burn(base, overlay, alpha):
    """Wendet den Color Burn-Effekt an: 255 - ((255 - base) / overlay) * 255 und verwendet den Alpha-Wert."""

    # Vermeide Division durch Null, indem Overlay auf mindestens 1 gesetzt wird
    overlay = np.clip(overlay, 1, 255)  # Sicherstellen, dass Overlay niemals 0 ist

    # Anwendung der Color Burn Formel:
    result = 255 - np.clip((255 - base) / overlay * 255, 0, 255)

    # Anwendung des Alpha-Werts (normalisiert auf den Bereich [0, 1])
    result = result * (alpha / 255.0)

    # Sicherstellen, dass die Werte im Bereich [0, 255] bleiben
    return np.clip(result, 0, 255).astype(np.uint8)

def apply_color_dodge(base, overlay, alpha):
    """Wendet den Linear Burn-Effekt an, ähnlich wie in Photoshop."""

    # Linear Burn: Subtrahiere 255 von der Summe der Basis- und Overlay-Werte
    result = base + overlay - 255

    # Wende den Alpha-Wert an, um die Intensität des Effekts zu steuern
    result = result * (alpha / 255.0)

    # Sicherstellen, dass die Werte im Bereich [0, 255] bleiben
    return np.clip(result, 0, 255).astype(np.uint8)

def apply_lighten(base, overlay, alpha):
    """Wendet den Lighten-Effekt an, wobei der Fokus auf der Alpha-Maske liegt und dunkle Bereiche ausgeblendet werden."""

    # Normalisiere den Alpha-Wert (Alpha-Wert zwischen 0 und 255)
    alpha_normalized = alpha / 255.0

    # Lighten: Verstärke den Overlay-Bereich in den helleren Bereichen der Alpha-Maske
    result = np.where(alpha_normalized > 0.5, np.maximum(base, overlay), base)

    # Wende den Alpha-Wert auf das Resultat an, um die Intensität zu steuern
    result = result * alpha_normalized

    # Sicherstellen, dass die Werte im Bereich [0, 255] bleiben
    return np.clip(result, 0, 255).astype(np.uint8)

def apply_negate_multiply(base, overlay, alpha):
    return np.clip(255 - base * (255 - overlay) / 255.0, 0, 255) * (alpha / 255.0)

def apply_color_burn(base, overlay, alpha):
    """Wendet den Color Burn-Effekt an, um das Basisbild basierend auf dem Overlay zu verdunkeln."""

    # Berechne Color Burn: (base / (255 - overlay))
    result = np.divide(base, (255 - overlay), where=(overlay < 255))

    # Wende den Alpha-Wert an, um die Intensität des Effekts zu steuern
    result = np.clip(result * (alpha / 1), 0, 255)

    # Sicherstellen, dass die Werte im Bereich [0, 255] bleiben
    return np.clip(result, 0, 255).astype(np.uint8)

def apply_linear_dodge(base, overlay, alpha):
    """Wendet den Linear Dodge-Effekt an, um die Basisfarbe mit der Overlay-Farbe zu addieren."""

    # Berechne Linear Dodge: base + overlay
    result = np.add(base, overlay)

    # Wende den Alpha-Wert an, um die Intensität des Effekts zu steuern
    result = np.clip(result * (alpha / 255.0), 0, 255)

    # Sicherstellen, dass die Werte im Bereich [0, 255] bleiben
    return np.clip(result, 0, 255).astype(np.uint8)

def apply_lighter_color(base, overlay, alpha):
    return np.clip(np.maximum(base, overlay), 0, 255) * (alpha / 255.0)

def apply_overlay(base, overlay, alpha):
    """Wendet den Overlay-Effekt an, wie er in Photoshop verwendet wird."""

    # Berechnung der Overlay-Mischung: Kombination von Multiply und Screen
    result = np.where(base < 128, 2 * base * overlay / 255.0, 255 - 2 * (255 - base) * (255 - overlay) / 255.0)

    # Wende den Alpha-Wert an, um die Intensität des Effekts zu steuern
    result = np.clip(result * (alpha / 255.0), 0, 255)

    # Sicherstellen, dass die Werte im Bereich [0, 255] bleiben
    return np.clip(result, 0, 255).astype(np.uint8)

def apply_soft_light(base, overlay, alpha):
    """Wendet den Soft Light-Effekt an, wie er in Photoshop verwendet wird."""

    # Berechne den Soft Light-Effekt
    result = base + (overlay / 255.0) * base * (1 - base / 255.0)

    # Wende den Alpha-Wert an, um die Intensität des Effekts zu steuern
    result = np.clip(result * (alpha / 255.0), 0, 255)

    # Sicherstellen, dass die Werte im Bereich [0, 255] bleiben
    return np.clip(result, 0, 255).astype(np.uint8)

def apply_hard_light(base, overlay, alpha):
    """Wendet einen leuchtenderen Hard Light-Effekt an, wie er in Photoshop verwendet wird."""

    # Leuchtender Hard Light-Effekt: Anwendung von Screen und Multiply mit stärkerem Einfluss der helleren Bereiche
    result = np.where(base < 128, overlay * (base / 255.0), 255 - 2 * (255 - overlay) * (255 - base) / 255.0)

    # Wende den Alpha-Wert an, um die Intensität des Effekts zu steuern
    result = np.clip(result * (alpha / 255.0), 0, 255)

    # Sicherstellen, dass die Werte im Bereich [0, 255] bleiben
    return np.clip(result, 0, 255).astype(np.uint8)

def apply_vivid_light(base, overlay, alpha):
    """Wendet den Vivid Light-Effekt an, wobei der Alpha-Wert als Maske fungiert."""

    # Normalisiere Alpha-Wert (0 bis 1)
    alpha_mask = alpha / 255.0

    # Berechne den Dodge- oder Burn-Effekt
    result = np.where(overlay < 128, base / (255 - overlay), 255 - (255 - base) / overlay)

    # Wende den Alpha-Masken-Effekt an
    result = np.clip(result * alpha, 0, 255)

    return np.clip(result, 0, 255).astype(np.uint8)

def apply_linear_light(base, overlay, alpha):
    """Erzeuge einen aufhellenden linearen Lichteffekt mit quadratischem Fade-Effekt, bei dem das Schwarz im Fade aufgehellt wird."""

    # Berechne die Höhe und Breite des Bildes
    height, width = base.shape[:2]

    # Berechne die quadratische Maskierung (Basierend auf der horizontalen und vertikalen Distanz)
    horizontal_dist = np.abs(np.arange(width) - width // 2)  # Horizontale Distanz zum Zentrum
    vertical_dist = np.abs(np.arange(height) - height // 2)  # Vertikale Distanz zum Zentrum

    # Erstelle eine Meshgrid für die quadratische Maske
    x, y = np.meshgrid(horizontal_dist, vertical_dist)

    # Berechne die quadratische Maske basierend auf der Distanz (stärkster Effekt in der Mitte)
    square_fade_mask = np.exp(-((x + y) / (width // 2 + height // 2)))  # Quadratischer Fade-Effekt

    # Wende den "aufhellenden" Effekt an: Helle Bereiche werden stärker betont
    result = np.clip(base + overlay, 0, 255)  # Ähnlich wie ein "Screen" oder "Dodge"-Effekt

    # Skaliere das Ergebnis mit der quadratischen Fade-Maske
    result = result * square_fade_mask

    # Aufhellen des schwarzen Bereichs: Verhindert, dass Schwarz im Fade-Bereich bleibt
    # Alle Schwarzwerte im Ergebnis aufhellen, um den Fade-Effekt zu verstärken
    result = np.clip(result + (1 - square_fade_mask) * 255, 0, 255)

    # Wende den Alpha-Wert an, um die Intensität des Effekts zu steuern
    result = np.clip(result * (alpha / 255.0), 0, 255)

    # Sicherstellen, dass die Werte im Bereich von 0 bis 255 bleiben
    return np.clip(result, 0, 255).astype(np.uint8)

def apply_lighting_spot(base, overlay, alpha):
    """Erzeuge einen intensiven Lichteffekt (Lighting Spot), der aus der Mitte heraus aufhellt und mit einer Alpha-Maske multipliziert wird."""

    # Berechne den Mittelpunkt des Bildes
    height, width = base.shape[:2]
    center_x, center_y = width // 2, height // 2

    # Erstelle eine Maske, die den Abstand zum Mittelpunkt darstellt
    y, x = np.indices((height, width))
    distance = np.sqrt((x - center_x)**2 + (y - center_y)**2)

    # Normalisiere die Distanz (je größer die Distanz, desto schwächer der Effekt)
    max_distance = np.sqrt(center_x**2 + center_y**2)  # Maximale Distanz zum Mittelpunkt
    fade_mask = 1 - (distance / max_distance)  # Fade-Werte zwischen 0 und 1

    # Erstelle eine "aufhellende" Maske, die am Rand intensiver wird
    lighten_mask = np.power(fade_mask, 2)  # Aufhellen-Effekt: Quadratische Kurve, damit die Ränder heller werden

    # Wende den Aufhellen-Effekt an
    result = base + lighten_mask * overlay  # Das Overlay wird intensiver, je weiter es vom Zentrum entfernt ist

    # Wende den Alpha-Wert an, um die Intensität des Effekts zu steuern
    result = np.clip(result * (alpha / 255.0), 0, 255)

    # Sicherstellen, dass der Effekt nur auf sichtbare Bereiche angewendet wird
    result = np.where(base > 0, result, base)

    return np.clip(result, 0, 255).astype(np.uint8)

def apply_hard_mix(base, overlay, alpha):
    """
    Wendet den Hard Mix-Effekt an, wie er in Photoshop verwendet wird, mit Aufhellen der dunklen Bereiche.
    """

    # Hard Mix: Wenn die Summe von base und overlay 255 überschreitet, setze es auf 255 (aufhellen),
    # sonst auf 0 (dunkeln). Dies wendet den typischen Hard Mix-Effekt mit Kontrast an.
    result = np.where(base + overlay >= 255, 255, base + overlay * 0.1)  # 0.3 für Aufhellen

    # Wende den Alpha-Wert an, um die Intensität des Effekts zu steuern
    result = np.clip(result * (alpha / 255.0), 0, 255)

    # Sicherstellen, dass die Werte im Bereich [0, 255] bleiben
    return np.clip(result, 0, 255).astype(np.uint8)

def apply_difference(base, overlay, alpha):
    """
    Wendet den Differenz-Effekt an, wie er in Photoshop verwendet wird.
    Der Effekt berechnet den absoluten Unterschied zwischen Basis- und Overlay-Bild.
    """

    # Berechne den absoluten Unterschied zwischen den Farbwerten von Base und Overlay
    result = np.abs(base - overlay)

    # Wende den Alpha-Wert an, um die Intensität des Effekts zu steuern
    result = np.clip(result * (alpha / 255.0), 0, 255)

    # Sicherstellen, dass die Werte im Bereich [0, 255] bleiben
    return np.clip(result, 0, 255).astype(np.uint8)

def apply_subtract(base, overlay, alpha):
    """
    Wendet den Subtraktions-Effekt an, wobei das Overlay direkt vom Basiswert subtrahiert wird.
    Der Alpha-Wert steuert die Intensität des Effekts.
    """

    # Verstärkter Subtraktions-Effekt
    result = base - (overlay * 0.7)  # Overlay wird mit einem Faktor skaliert, um die Wirkung zu verstärken

    # Sicherstellen, dass keine negativen Werte entstehen
    result = np.clip(result, 0, 255)

    # Wende den Alpha-Wert an, um die Intensität des Effekts zu steuern
    result = np.clip(result * (alpha / 255.0), 0, 255)

    return result.astype(np.uint8)

def apply_divide(base, overlay, alpha):
    """
    Wendet den Divide-Effekt an, orientiert an der Differenz-Funktion,
    jedoch stärker fokussiert auf die Division der Farbkanäle, ähnlich wie bei der Differenz.
    """

    # Berechne den Divide-Effekt basierend auf den Differenzen zwischen den Farbwerten
    result = np.clip(base - (overlay / 255.0) * base, 0, 255)

    # Verwende den Alpha-Wert, um die Intensität des Effekts zu steuern
    result = np.clip(result * (alpha / 255.0), 0, 255)

    return result.astype(np.uint8)

def apply_hue(base, overlay, alpha):
    """
    Ändert den Farbton des Basisbildes (base) basierend auf einer Alpha-Maske (overlay).
    Der Alpha-Wert steuert die Intensität des Farbtonwechsels.
    """
    # Sicherstellen, dass overlay die gleichen Dimensionen wie base hat
    if base.shape != overlay.shape:
        raise ValueError("base und overlay müssen die gleiche Form haben")

    # Berechne den Unterschied im Farbton
    hue_difference = overlay - base

    # Berechne den Alpha-Wert basierend auf der Overlay-Maske
    alpha_mask = base / 255.0  # Umwandlung von Overlay in einen Bereich von 0 bis 1

    # Skaliere den Farbtonunterschied basierend auf der Alpha-Maske und dem Alpha-Wert
    hue_shift = hue_difference * alpha_mask * (alpha / 255.0)

    # Wende den Farbtonunterschied an
    result = np.clip(base + hue_shift, 0, 255)

    return result.astype(np.uint8)

def apply_saturation(base, overlay, alpha):
    """
    Ändert die Sättigung des Basisbildes basierend auf einer Overlay-Maske.
    Der Alpha-Wert steuert die Intensität der Sättigungsänderung.
    """
    # Sicherstellen, dass base und overlay die gleiche Form haben
    if base.shape != overlay.shape:
        raise ValueError("base und overlay müssen die gleiche Form haben")

    # Berechne den Unterschied in der Sättigung
    saturation_difference = overlay - base

    # Berechne den Alpha-Wert basierend auf der Overlay-Maske
    alpha_mask = base / 50  # Umwandlung von Overlay in einen Bereich von 0 bis 1

    # Skaliere den Sättigungsunterschied basierend auf der Alpha-Maske und dem Alpha-Wert
    saturation_shift = saturation_difference * alpha_mask * (alpha / 255.0)

    # Wende den Sättigungsunterschied an
    result = np.clip(base + saturation_shift, 0, 255)

    return result.astype(np.uint8)

def apply_colored(base, overlay, alpha):
    """
    Ändert den Farbton und die Sättigung basierend auf der Mischung von 'base' und 'overlay'.
    Der Alpha-Wert steuert die Intensität der Farbänderung.
    """
    # Sicherstellen, dass base und overlay die gleiche Form haben
    if base.shape != overlay.shape:
        raise ValueError("base und overlay müssen die gleiche Form haben")

    # Berechne den Farbdifferenz zwischen base und overlay
    color_difference = overlay - base

    # Mische die Farben basierend auf dem Alpha-Wert
    color_shift = color_difference * (base / 255.0)

    # Wende die Farbänderung auf das Basisbild an
    result = np.clip(base + color_shift, 0, 255)

    return result.astype(np.uint8)

def apply_luminance(base, overlay, alpha):
    """Ändert die Helligkeit ohne den Farbton zu verändern."""
    # Berechne die Helligkeit von Basis und Overlay
    base_luminance = np.mean(base)  # Durchschnittlicher RGB-Wert als Helligkeit
    overlay_luminance = np.mean(overlay)

    # Mische die Helligkeit basierend auf dem Alpha-Wert
    new_luminance = base_luminance + (overlay_luminance - base_luminance) * (alpha / 255.0)

    # Wende die neue Helligkeit auf das Basisbild an (RGB bleibt erhalten)
    scale = new_luminance / base_luminance
    new_rgb = np.clip(base * scale, 0, 255)
    return new_rgb

def apply_color_filter(base, overlay, mode, alpha):
    """Wendet den gewählten Blend-Modus an unter Berücksichtigung des Alpha-Werts."""
    blend_modes = {
        0: apply_normal,
        1: apply_sprenkeln,
        2: apply_darken,
        3: apply_multiply,
        4: apply_color_dodge,
        5: apply_linear_burn,
        6: apply_lighten,
        7: apply_negate_multiply,
        8: apply_color_burn,
        9: apply_linear_dodge,
        10: apply_lighter_color,
        11: apply_overlay,
        12: apply_soft_light,
        13: apply_hard_light,
        14: apply_vivid_light,
        15: apply_linear_light,
        16: apply_lighting_spot,
        17: apply_hard_mix,
        18: apply_difference,
        19: apply_subtract,
        20: apply_divide,
        21: apply_hue,
        22: apply_saturation,
        23: apply_colored,
        24: apply_luminance
    }

    if mode not in blend_modes:
        raise ValueError("Ungültiger Modus. Wählen Sie eine Zahl von 0 bis 24.")

    return blend_modes[mode](base, overlay, alpha)

def apply_color(img_array, color_overlay, mode=1):
    """Wendet eine Farbüberlagerung mit dem angegebenen Blend-Modus und Alpha-Wert an."""
    # Hex zu RGBA konvertieren
    color = hex_to_rgba(color_overlay)
    r, g, b, a = color  # Extrahieren der RGBA-Werte

    # Erstelle das Overlay mit der gewählten Farbe und dem Alpha-Wert
    overlay = np.ones_like(img_array, dtype=np.uint8) * color[:3]  # Nur RGB für das Overlay

    # Um den Alpha-Wert direkt zu integrieren, erstellen wir ein neues Overlay, das den Alpha-Wert aus dem Hex-Code nutzt.
    overlay_alpha = np.dstack((overlay, np.full((overlay.shape[0], overlay.shape[1]), a, dtype=np.uint8)))  # Overlay mit Alpha

    # Erstelle die Alphamap (Schwarz/Weiß)
    alpha_map = np.full((img_array.shape[0], img_array.shape[1]), a, dtype=np.uint8)  # Alphawert auf die gesamte Fläche anwenden
    alpha_map = np.clip(alpha_map, 0, 255)  # Sicherstellen, dass es im Bereich 0-255 bleibt

    # Wende den Filter auf die Alphamap an
    img_array_rgb = np.zeros_like(img_array, dtype=np.uint8)
    for i in range(3):  # RGB-Kanäle durchlaufen
        img_array_rgb[..., i] = apply_color_filter(img_array[..., i], overlay_alpha[..., i], mode, alpha_map)

    return img_array_rgb

def apply_blend_layer(img_array, color_overlay, alpha_channel, mode=1):
    """
    Wendet eine Farbüberlagerung auf ein Bildarray an, wobei color_overlay und alpha_channel ebenfalls Arrays sind.

    Parameter:
    - img_array: np.ndarray, Form (H, W, 3)
    - color_overlay: np.ndarray, Form (H, W, 3)
    - alpha_channel: np.ndarray, Form (H, W)
    - mode: Blend-Modus

    Rückgabe:
    - Ergebnisbild als np.ndarray (H, W, 3)
    """

    # Sicherstellen, dass alpha_channel Werte zwischen 0 und 255 hat
    alpha_map = np.clip(alpha_channel, 0, 255).astype(np.uint8)

    # Ergebnisbild vorbereiten
    img_array_rgb = np.zeros_like(img_array, dtype=np.uint8)

    # RGB-Kanäle einzeln verarbeiten
    for i in range(3):
        img_array_rgb[..., i] = apply_color_filter(
            img_array[..., i],
            color_overlay[..., i],
            mode,
            alpha_map
        )

    return img_array_rgb
