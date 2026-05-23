# Definition der Eingabeparameter und deren Standardwerte
PARAMETERS = {
    "ai": {
        "method": {"type": str, "required": True},
        "prompt": {"type": str, "required": True},
        "model": {"type": str, "required": True},
    },
    "local_ai": {
        "method": {"type": str, "required": True},
        "prompt": {"type": str, "required": True},
        "model": {"type": str, "required": True},
        "size": {"type": str, "required": False},
        "layer_type": {"type": int, "required": False},
    },
    "plugin": {
        "method": {"type": str, "required": True},
        "pluginId": {"type": str, "required": False}
    },
    "task": {
        "method": {"type": str, "required": True},
        "meta": {"type": bool, "default": False},
        "id": {"type": str, "default": None},
        "active": {"type": bool, "default": False},
        "state": {"type": str, "default": None},
        "time_val": {"type": int, "default": 0},
        "type": {"type": str, "default": None},
        "delay": {"type": int, "default": None},
        "progress": {"type": int, "default": 0},
        "default": {"type": bool, "default": False},
        "module": {"type": str, "default": None},
        "custom": {"type": list, "default": []},
        "customId": {"type": str, "default": None},
        "created": {"type": int, "default": None},
        "updated": {"type": int, "default": None}
    },
    "cursor": {
        "method": {"type": str, "required": True},
        "id": {"type": str, "required": True},
        "size": {"type": int, "required": True},
        "rotation": {"type": float, "required": True},
        "opacity": {"type": float, "required": True},
    },
    "channel": {
        "method": {"type": str, "required": True},
        "id": {"type": str, "required": False},
        "ids": {"type": list, "required": False},
        "state": {"type": bool, "required": False},
        "channel": {"type": str, "required": False}
    },
    "settings": {
        "method": {"type": str, "required": True},
        "id": {"type": str, "default": "Unknown"},
        "os_type": {"type": str, "default": "Unknown"},
        "os_arch": {"type": str, "default": "x64"},
        "os_cpu": {"type": str, "default": "Unknown CPU"},
        "os_memory": {"type": int, "default": 0},  # in GB
        "use_gpu": {"type": bool, "default": False},
        "gpu_name": {"type": str, "default": "None"},
        "gpu_memory_mb": {"type": int, "default": 0},
        "preferred_unit": {"type": str, "default": "CPU"},
        "cpu_threads": {"type": int, "default": 1},
        "system_score": {"type": float, "default": 0.0},
        "system_rating": {"type": str, "default": "Unknown"},
        "recommended_ram_gb": {"type": int, "default": 0},
        "recommended_cpu_threads": {"type": int, "default": 0},
        "recommended_gpu_gb": {"type": int, "default": 0},
    },
    "viewport": {
        "method": {"type": str, "required": True},
        "mode": {"type": int, "default": 1},
        "width": {"type": int, "default": 2048},
        "height": {"type": int, "default": 2048},
        "unit": {"type": str, "default": "px"},
        "dpi": {"type": int, "default": 70},
        "sync": {"type": bool, "default": False},
        "title": {"type": str, "default": "Unknown"},
        "layer": {"type": str, "default": "Layer"},
    },
    "backup": {
        "method": {"type": str, "required": True},
        "title": {"type": str},
        "state": {"type": (dict, list)},
        "index": {"type": int},
        "id": {"type": str}
    },
    "upload": {
        "method": {"type": str, "required": True},
        # STANDARD METHODS PARAMS START
        "selectedMaps": {"type": list, "default": []},
        "cropLeft": {"type": int, "default": 0},
        "cropTop": {"type": int, "default": 0},
        "cropRight": {"type": int, "default": 0},
        "cropBottom": {"type": int, "default": 0},
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
        "x": {"type": float, "default": 0},
        "y": {"type": float, "default": 0},
        "rotate": {"type": float, "default": 0},
        "order": {"type": int, "default": 0},
        "hidden": {"type": int, "default": 0},
        "opacity": {"type": float, "default": 1},
        "blend_mode": {"type": int, "default": 0},
        "color": {"type": str, "default": "#000000"},
        "mask": {"type": str, "default": ""},
        "ids": {"type": list, "default": []},
        "group": {"type": str, "default": None},
        "reset": {"type": bool, "default": False},
        "channel": {"type": dict, "default": {}},
        "keyframes": {"type": list, "default": []},

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

        # PathLayer spezifisch
        "stroke": {"type": str, "default": "#000000"},
        "strokeWidth": {"type": float, "default": 1.5},
        "strokeDash": {"type": float, "default": 0},
        "strokeDashType": {"type": str, "default": ""},
        "strokeDashArray": {"type": list, "default": []},
        "fill": {"type": str, "default": "#ffffff"},
        "fillOpacity": {"type": float, "default": 1.0},
        "points": {"type": list, "default": []},
        "connections": {"type": list, "default": []},
        "gradient": {"type": dict, "default": {}},
        "closed": {"type": bool, "default": False},
    },
    "modifier": {
        "method": {"type": str, "required": True},
        # shared
        "id": {"type": str, "default": ""},
        # fill
        "x": {"type": int, "default": 0},
        "y": {"type": int, "default": 0},
        "color": {"type": str, "default": "#000000"},
        "tolerance": {"type": int, "default": 0},
        # crop
        "crop_left": {"type": int, "default": 0},
        "crop_top": {"type": int, "default": 0},
        "crop_right": {"type": int, "default": 0},
        "crop_bottom": {"type": int, "default": 0},
        # resize
        "resize_index": {"type": int, "default": 0},
        "resize_width": {"type": int, "default": 0},
        "resize_height": {"type": int, "default": 0},
        "resize_keep_aspect_ratio": {"type": int, "default": 1},
        "resize_is_custom": {"type": int, "default": 0},
        "resize_mode": {"type": int, "default": 0},
        "upscale_method": {"type": int, "default": 1},
        # cutout
        "cutout": {"type": int, "default": 0},
        # none | layer | select
        "mask_type": {"type": str, "default": "none"},
        # select mask data
        "select_mask_x": {"type": int, "default": 0},
        "select_mask_y": {"type": int, "default": 0},
        "select_mask_width": {"type": int, "default": 0},
        "select_mask_height": {"type": int, "default": 0},
        "select_mask_shape": {"type": str, "default": "rectangle"},
        # COLOR MODIFIER PARAMS START
        "brightness": {"type": int, "default": 100},
        "contrast": {"type": int, "default": 50},
        "color_shift": {"type": int, "default": 0},
        "hue_variation": {"type": int, "default": 0},
        "invert_colors": {"type": bool, "default": False},
        "color_lookup": {"type": int, "default": 0},
        # COLOR MODIFIER PARAMS END
        # DETAILS MODIFIER
        "details_effect": {"type": str, "default": "sharpness"},
        "sharpness": {"type": float, "default": 1.5},
        "blur": {"type": float, "default": 5},
        "blur_mode": {"type": int, "default": 1},
        "blur_radius": {"type": int, "default": 15},
        "blur_falloff_mode": {"type": int, "default": 1},
        "blur_type": {"type": int, "default": 1},
        "edge_detection": {"type": bool, "default": True},
        "edge_method": {"type": str, "default": "canny"},
        "edge_threshold1": {"type": int, "default": 50},
        "edge_threshold2": {"type": int, "default": 150},
        "edge_kernel_size": {"type": int, "default": 3},
        "edge_alpha": {"type": float, "default": 0.5},
        "edge_threshold_min": {"type": int, "default": 1},
        "edge_threshold_max": {"type": int, "default": 250},
        "mask_expand": {"type": float, "default": 1.5},
        "sharpness_boost": {"type": float, "default": 1.2},
        "blending_intensity": {"type": float, "default": 50},
        # POINT INFLUENCE
        "points": {"type": str, "default": "[]"},
        "point_radius": {"type": int, "default": 35},
        "point_falloff": {"type": str, "default": "radial"},
        "point_strength": {"type": float, "default": 1.0},
        "point_chain": {"type": bool, "default": True},
        # EFFECTS MODIFIER
        "effects_effect": {"type": str, "default": "noise"},
        "noise_level": {"type": int, "default": 10},
        "pixel_size": {"type": int, "default": 10},
        "glass_effect_type": {"type": int, "default": 1},
        "glass_frost_strength": {"type": int, "default": 5},
        "glass_frost_mode": {"type": int, "default": 1},
        "glass_blur_radius": {"type": int, "default": 5},
        "glass_crack_intensity": {"type": int, "default": 10},
        "glass_reflection_strength": {"type": float, "default": 0.5},
        "deepness_factor": {"type": float, "default": 1.0},
        "highness_factor": {"type": float, "default": 1.0},
        "falloff_custom_enabled": {"type": bool, "default": False},
        "falloff_custom_points": {"type": str, "default": "[]"},
        "falloff_preset": {"type": str, "default": "smooth"},
        "falloff_radius": {"type": int, "default": 100},
        "falloff_strength": {"type": float, "default": 1.0},
        "falloff_center_x": {"type": float, "default": 0.5},
        "falloff_center_y": {"type": float, "default": 0.5},
        "falloff_inverted": {"type": bool, "default": False},
        "falloff_random_seed": {"type": int, "default": 1},
        # DISTORT MODIFIER
        "distort_effect": {"type": str, "default": "distort"},
        "distortion_factor": {"type": float, "default": 0.2},
        "wave_strength": {"type": float, "default": 5},
        "wave_frequency": {"type": float, "default": 5},
        "wave_axis": {"type": str, "default": "vertical"},
        "max_shift_ratio": {"type": float, "default": 0.1}
    },
    "export": {
        "method": {"type": str, "required": True},
        "mode": {"type": int, "default": 0},
        "quality": {"type": int, "default": 80},
        "type": {"type": str, "default": "PNG"},
        "dpi": {"type": int, "default": 70},
        "title": {"type": str, "default": ""},
        "compress": {"type": bool, "default": False},
        "ddsCompress": {"type": str, "default": "DTX3"},
        "mipmap": {"type": bool, "default": True},
        #SVG EXPORT
        "inlineCss": {"type": bool, "default": False},
        #PDF EXPORT
        "paperSize": {"type": str, "default": ""},
        "landscape": {"type": bool, "default": False},
        "raster": {"type": bool, "default": True},
        "pdfFitMode": {"type": str, "default": "contain"},
        "margin": {"type": int, "default": 10},
    },
    "render": {
        "method": {"type": str, "required": True},
        "id": {"type": str, "default": ""},
        "image_base64": {"type": str, "default": ""},
        "size": {"type": int, "default": 128},

        # COLOR MODIFIER PREVIEW
        "brightness": {"type": int, "default": 100},
        "contrast": {"type": int, "default": 50},
        "color_shift": {"type": int, "default": 0},
        "hue_variation": {"type": int, "default": 0},
        "invert_colors": {"type": bool, "default": False},
        "color_lookup": {"type": int, "default": 0},

        # MASK
        "mask_type": {"type": str, "default": "none"},
        "select_mask_x": {"type": int, "default": 0},
        "select_mask_y": {"type": int, "default": 0},
        "select_mask_width": {"type": int, "default": 0},
        "select_mask_height": {"type": int, "default": 0},
        "select_mask_shape": {"type": str, "default": "rectangle"},

        # DETAILS MODIFIER PREVIEW
        "details_effect": {"type": str, "default": "sharpness"},
        "sharpness": {"type": float, "default": 1.5},
        "blur": {"type": float, "default": 5},
        "blur_mode": {"type": int, "default": 1},
        "blur_radius": {"type": int, "default": 15},
        "blur_falloff_mode": {"type": int, "default": 1},
        "blur_type": {"type": int, "default": 1},
        "edge_detection": {"type": bool, "default": True},
        "edge_method": {"type": str, "default": "canny"},
        "edge_threshold1": {"type": int, "default": 50},
        "edge_threshold2": {"type": int, "default": 150},
        "edge_kernel_size": {"type": int, "default": 3},
        "edge_alpha": {"type": float, "default": 0.5},
        "edge_threshold_min": {"type": int, "default": 1},
        "edge_threshold_max": {"type": int, "default": 250},
        "mask_expand": {"type": float, "default": 1.5},
        "sharpness_boost": {"type": float, "default": 1.2},
        "blending_intensity": {"type": float, "default": 50},

        # POINT INFLUENCE
        "points": {"type": str, "default": "[]"},
        "point_radius": {"type": int, "default": 35},
        "point_falloff": {"type": str, "default": "radial"},
        "point_strength": {"type": float, "default": 1.0},
        "point_chain": {"type": bool, "default": True},

        # EFFECTS MODIFIER PREVIEW
        "effects_effect": {"type": str, "default": "noise"},

        # noise
        "noise_level": {"type": int, "default": 10},

        # pixelate
        "pixel_size": {"type": int, "default": 10},

        # glass
        "glass_effect_type": {"type": int, "default": 1},
        "glass_frost_strength": {"type": int, "default": 5},
        "glass_frost_mode": {"type": int, "default": 1},
        "glass_blur_radius": {"type": int, "default": 5},
        "glass_crack_intensity": {"type": int, "default": 10},
        "glass_reflection_strength": {"type": float, "default": 0.5},

        # deepness / highness
        "deepness_factor": {"type": float, "default": 1.0},
        "highness_factor": {"type": float, "default": 1.0},

        # falloff editor
        "falloff_custom_enabled": {"type": bool, "default": False},
        "falloff_custom_points": {"type": str, "default": "[]"},
        "falloff_preset": {"type": str, "default": "smooth"},
        "falloff_radius": {"type": int, "default": 100},
        "falloff_strength": {"type": float, "default": 1.0},
        "falloff_center_x": {"type": float, "default": 0.5},
        "falloff_center_y": {"type": float, "default": 0.5},
        "falloff_inverted": {"type": bool, "default": False},
        "falloff_random_seed": {"type": int, "default": 1},

        # DISTORT MODIFIER PREVIEW
        "distort_effect": {"type": str, "default": "distort"},

        # apply_distort.py
        "distortion_factor": {"type": float, "default": 0.2},

        # apply_wave.py
        "wave_strength": {"type": float, "default": 5},
        "wave_frequency": {"type": float, "default": 5},
        "wave_axis": {"type": str, "default": "vertical"},

        # apply_random_shift.py
        "max_shift_ratio": {"type": float, "default": 0.1},
        # material preview
        "source_layer_id": {"type": str, "default": ""},
        "name": {"type": str, "default": "Cube Material"},
        "surface": {"type": dict, "default": {}},
        "geometry": {"type": dict, "default": {}},
        "mesh": {"type": dict, "default": {}},
        "bitmap_maps": {"type": dict, "default": {}},
        "uv": {"type": dict, "default": {}},
        "particle_system": {"type": dict, "default": {}},
        "shader_graph": {"type": dict, "default": {}},
        "cube_size": {"type": float, "default": 256.0},
        "rotate_preview": {"type": bool, "default": True},
        "wireframe_preview": {"type": bool, "default": False},
        "faces_preview": {"type": bool, "default": False},
        "vertices_preview": {"type": bool, "default": False},
        "fluid_mesh_preview": {"type": bool, "default": True},
        "fluid_particle_preview": {"type": bool, "default": True},
        "blend_mode": {"type": str, "default": "BLEND"},
        "shadow_method": {"type": str, "default": "HASHED"},
        "use_nodes": {"type": bool, "default": True},
        "texture_size": {"type": str, "default": "Original"},
        "values": {"type": dict, "default": {}}
    },
    "material": {
        "method": {"type": str, "required": True},
        "id": {"type": str, "default": ""},
        "source_layer_id": {"type": str, "default": ""},
        "name": {"type": str, "default": "Cube Material"},
        "surface": {"type": dict, "default": {}},
        "geometry": {"type": dict, "default": {}},
        "mesh": {"type": dict, "default": {}},
        "bitmap_maps": {"type": dict, "default": {}},
        "uv": {"type": dict, "default": {}},
        "particle_system": {"type": dict, "default": {}},
        "shader_graph": {"type": dict, "default": {}},
        "cube_size": {"type": float, "default": 256.0},
        "rotate_preview": {"type": bool, "default": True},
        "wireframe_preview": {"type": bool, "default": False},
        "faces_preview": {"type": bool, "default": False},
        "vertices_preview": {"type": bool, "default": False},
        "fluid_mesh_preview": {"type": bool, "default": True},
        "fluid_particle_preview": {"type": bool, "default": True},
        "blend_mode": {"type": str, "default": "BLEND"},
        "shadow_method": {"type": str, "default": "HASHED"},
        "use_nodes": {"type": bool, "default": True},
        "texture_size": {"type": str, "default": "Original"},
        "values": {"type": dict, "default": {}}
    },
    "path": {
        "method": {"type": str, "required": True},
        "name": {"type": str, "default": ""},
        "id": {"type": str, "default": ""},
        "stroke": {"type": str, "default": "#000000"},
        "strokeWidth": {"type": float, "default": 1.5},
        "strokeDash": {"type": float, "default": 0},
        "strokeDashType": {"type": str, "default": ""},
        "strokeDashArray": {"type": list, "default": []},
        "fill": {"type": str, "default": "#ffffff"},
        "fillOpacity": {"type": float, "default": 1.0},
        "points": {"type": list, "default": []},
        "connections": {"type": list, "default": []},
        "gradient": {"type": dict, "default": {}},
        "closed": {"type": bool, "default": False},
        "edit": {"type": bool, "default": True},
        "width": {"type": int, "default": 0},
        "height": {"type": int, "default": 0}
    },
}
