# Definition der Eingabeparameter und deren Standardwerte
PARAMETERS = {
    "ai": {
        "prompt": {"type": str, "required": True},
        "model": {"type": str, "required": True},
    },
    "viewport": {
        "mode": {"type": int, "default": 1},
        "width": {"type": int, "default": 2048},
        "height": {"type": int, "default": 2048},
        "title": {"type": str, "default": "Unknown"},
        "layer": {"type": str, "default": "Layer"},
    },
    "backup": {
        "title": {"type": str},
        "state": {"type": str},
        "index": {"type": int},
        "id": {"type": str}
    },
    "upload": {
        # STANDARD METHODS PARAMS START
        "selectedMaps": {"type": list, "default": []},
        "cropLeft": {"type": int, "default": 0},
        "cropTop": {"type": int, "default": 0},
        "cropRight": {"type": int, "default": 0},
        "cropBottom": {"type": int, "default": 0},
        "method": {"type": int, "default": 0},
        "output_format": {"type": str, "default": "PNG"},
        "quality": {"type": int, "default": 80},
        "editFile": {"type": str, "default": ""},
        # STANDARD METHODS PARAMS END

        # BOOL HANDLER START
        "edge_detection": {"type": bool, "default": False},
        "invert_colors": {"type": bool, "default": False},
        # BOOL HANDLER END

        # UPLOAD HANDLER START
        "resize_index": {"type": int, "default": 0},
        "resize_mode": {"type": int, "default": 0},
        "upscale_method": {"type": int, "default": 1},
        "rgb_mode": {"type": int, "default": 0},
        "rgba_mode": {"type": int, "default": 0},
        # UPLOAD HANDLER END

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
        "color_overlay": {"type": str, "default": "#000000"},
        "color_overlay_mode": {"type": int, "default": 1},
        "color_lookup": {"type": int, "default": 0},
        "color_shift": {"type": int, "default": 0},
        "hue_variation": {"type": int, "default": 0},
        # COLOR PARAMS END

        # EDIT PARAMS START
        "cut_out": {"type": int, "default": 0},
        # EDIT PARAMS END

        # NOISE PARAMS START
        "noise_level": {"type": int, "default": 0},
        # NOISE PARAMS END

        # SIMULATE PARAMS START
        "simulate_mode": {"type": int, "default": 0},
        "amplitude": {"type": int, "default": 50},
        "frame_count": {"type": int, "default": 1},
        "frequency": {"type": float, "default": 0},
        "phase_shift": {"type": float, "default": 0},
        "amplitude_multiplier": {"type": float, "default": 0},
        "wave_type": {"type": int, "default": 0},
        # SIMULATE PARAMS END

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
    "layer": {
        "method": {"type": str, "required": True},
        "type": {"type": int, "default": 0},
        "name": {"type": str, "default": ""},
        "width": {"type": int, "default": 1024},
        "height": {"type": int, "default": 1024},
        "id": {"type": str, "default": ""},
        "id2": {"type": str, "default": ""},
        "url": {"type": str, "default": ""},
        "a": {"type": float, "default": 1},
        "b": {"type": float, "default": 0},
        "c": {"type": float, "default": 0},
        "d": {"type": float, "default": 1},
        "x": {"type": int, "default": 0},
        "y": {"type": int, "default": 0},
        "rotate": {"type": float, "default": 0},
        "order": {"type": int, "default": 0},
        "hidden": {"type": int, "default": 0},
        "opacity": {"type": float, "default": 1},
        "blend_mode": {"type": int, "default": 0},
        "color": {"type": str, "default": "#000000"},
        "mask": {"type": str, "default": ""},

        # TextLayer spezifisch
        "font": {"type": str, "default": ""},
        "fontFamily": {"type": str, "default": "sans-serif"},
        "fontSize": {"type": int, "default": 16},
        "fontWeight": {"type": str, "default": "normal"},
        "initFontSize": {"type": int, "default": 16},
        "initHeight": {"type": int, "default": 0},
        "initWidth": {"type": int, "default": 0},
        "letterSpacing": {"type": float, "default": 0.0},
        "lineHeight": {"type": float, "default": 1.4},
        "text": {"type": str, "default": ""},
        "textAlign": {"type": str, "default": "left"},
        "textDecoration": {"type": str, "default": "none"},
        "textTransform": {"type": str, "default": "none"},
    },
    "modifier": {
            "method": {"type": str, "required": True},
            "id": {"type": str, "default": ""},
            "x": {"type": int, "default": 0},
            "y": {"type": int, "default": 0},
            "color": {"type": str, "default": "#000000"},
        },
}