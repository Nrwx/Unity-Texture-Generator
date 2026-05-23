import api from "@/dataLayer/api";

export const renderer = async (config) => {
    try {
        const formData = new FormData();
        formData.append("method", config.mode);
        formData.append("id", config.id);

        const response = await api.post("/renderer", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        if(response) {
            return response;
        }
    } catch (error) {
        console.error("Fehler beim Rendern:", error.response?.data || error.message);
        throw error;
    }
};

export const colorPreview = async (payload = {}) => {
    const { layer, values, mask } = payload;

    if (!layer?.id || !values) {
        return null;
    }

    const formData = new FormData();

    formData.append("method", "color-preview");
    formData.append("id", layer.id);

    formData.append("brightness", values.brightness);
    formData.append("contrast", values.contrast);
    formData.append("color_shift", values.color_shift);
    formData.append("hue_variation", values.hue_variation);
    formData.append("invert_colors", values.invert_colors ? "true" : "false");
    formData.append("color_lookup", values.color_lookup);

    formData.append("mask_type", mask?.type || "none");
    formData.append("select_mask_x", mask?.select?.x || 0);
    formData.append("select_mask_y", mask?.select?.y || 0);
    formData.append("select_mask_width", mask?.select?.width || 0);
    formData.append("select_mask_height", mask?.select?.height || 0);
    formData.append("select_mask_shape", mask?.shape || "rectangle");

    const response = await api.post("/renderer", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

    return response?.data || response;
};

export const detailsPreview = async (payload = {}) => {
    const { layer, values } = payload;

    if (!layer?.id || !values) {
        return null;
    }

    const formData = new FormData();

    formData.append("method", "details-preview");
    formData.append("id", layer.id);

    formData.append("details_effect", values.details_effect);

    formData.append("sharpness", values.sharpness);

    formData.append("blur", values.blur);
    formData.append("blur_mode", values.blur_mode);
    formData.append("blur_radius", values.blur_radius);
    formData.append("blur_falloff_mode", values.blur_falloff_mode);
    formData.append("blur_type", values.blur_type);

    formData.append("edge_detection", values.edge_detection ? "true" : "false");
    formData.append("edge_method", values.edge_method);
    formData.append("edge_threshold1", values.edge_threshold1);
    formData.append("edge_threshold2", values.edge_threshold2);
    formData.append("edge_kernel_size", values.edge_kernel_size);
    formData.append("edge_alpha", values.edge_alpha);

    formData.append("edge_threshold_min", values.edge_threshold_min);
    formData.append("edge_threshold_max", values.edge_threshold_max);
    formData.append("mask_expand", values.mask_expand);
    formData.append("sharpness_boost", values.sharpness_boost);

    formData.append("blending_intensity", values.blending_intensity);

    formData.append("points", JSON.stringify(values.points || []));
    formData.append("point_radius", values.point_radius);
    formData.append("point_falloff", values.point_falloff);
    formData.append("point_strength", values.point_strength);
    formData.append("point_chain", values.point_chain ? "true" : "false");

    const response = await api.post("/renderer", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

    return response?.data || response;
};

export const effectsPreview = async (payload = {}) => {
    const { layer, values } = payload;

    if (!layer?.id || !values) {
        return null;
    }

    const formData = new FormData();

    formData.append("method", "effects-preview");
    formData.append("id", layer.id);

    formData.append("effects_effect", values.effects_effect);

    formData.append("noise_level", values.noise_level);

    formData.append("pixel_size", values.pixel_size);

    formData.append("glass_effect_type", values.glass_effect_type);
    formData.append("glass_frost_strength", values.glass_frost_strength);
    formData.append("glass_frost_mode", values.glass_frost_mode);
    formData.append("glass_blur_radius", values.glass_blur_radius);
    formData.append("glass_crack_intensity", values.glass_crack_intensity);
    formData.append("glass_reflection_strength", values.glass_reflection_strength);

    formData.append("deepness_factor", values.deepness_factor);
    formData.append("highness_factor", values.highness_factor);

    formData.append("falloff_custom_enabled", values.falloff_custom_enabled ? "true" : "false");
    formData.append("falloff_custom_points", JSON.stringify(values.falloff_custom_points || []));
    formData.append("falloff_preset", values.falloff_preset);
    formData.append("falloff_radius", values.falloff_radius);
    formData.append("falloff_strength", values.falloff_strength);
    formData.append("falloff_center_x", values.falloff_center_x);
    formData.append("falloff_center_y", values.falloff_center_y);
    formData.append("falloff_inverted", values.falloff_inverted ? "true" : "false");
    formData.append("falloff_random_seed", values.falloff_random_seed);

    const response = await api.post("/renderer", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

    return response?.data || response;
};

export const distortPreview = async (payload = {}) => {
    const { layer, values } = payload;

    if (!layer?.id || !values) {
        return null;
    }

    const formData = new FormData();

    formData.append("method", "distort-preview");
    formData.append("id", layer.id);

    formData.append("distort_effect", values.distort_effect);

    formData.append("distortion_factor", values.distortion_factor);

    formData.append("wave_strength", values.wave_strength);
    formData.append("wave_frequency", values.wave_frequency);
    formData.append("wave_axis", values.wave_axis);

    formData.append("max_shift_ratio", values.max_shift_ratio);

    formData.append("falloff_preset", values.falloff_preset);
    formData.append("falloff_radius", values.falloff_radius);
    formData.append("falloff_strength", values.falloff_strength);
    formData.append("falloff_center_x", values.falloff_center_x);
    formData.append("falloff_center_y", values.falloff_center_y);
    formData.append("falloff_inverted", values.falloff_inverted ? "true" : "false");
    formData.append("falloff_random_seed", values.falloff_random_seed);

    formData.append("falloff_custom_enabled", values.falloff_custom_enabled ? "true" : "false");
    formData.append("falloff_custom_points", JSON.stringify(values.falloff_custom_points || []));

    const response = await api.post("/renderer", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

    return response?.data || response;
};