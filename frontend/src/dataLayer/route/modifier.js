import api from "@/dataLayer/api";

export const fillModifier = async (data) => {
    try {
        const formData = new FormData();
        formData.append("method", "fill");
        formData.append("id", data.id);
        formData.append("x", data.x);
        formData.append("y", data.y);
        formData.append("color", data.color);

        const response = await api.post("/modifier", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        if (response) {
            console.log(response, 'THIS IS RESPONSE')
            return response;
        }
    } catch (error) {
        console.error("Fehler beim Farbausfüllen:", error.response?.data || error.message);
        throw error;
    }
};

const resolveMaskType = ({ layer, selectMask }) => {
    if (selectMask && selectMask.width > 0 && selectMask.height > 0) {
        return "select";
    }

    if (layer?.mask) {
        return "layer";
    }

    return "none";
};

export const resizeModifier = async ({ layer, crop, resize, cutout, selectMask, selectMaskShape }) => {
    try {
        const maskType = resolveMaskType({ layer, selectMask });

        const formData = new FormData();

        formData.append("method", "resize");
        formData.append("id", layer.id);

        formData.append("crop_left", crop.left);
        formData.append("crop_top", crop.top);
        formData.append("crop_right", crop.right);
        formData.append("crop_bottom", crop.bottom);

        formData.append("resize_index", resize.index);
        formData.append("resize_width", resize.width || 0);
        formData.append("resize_height", resize.height || 0);
        formData.append("resize_keep_aspect_ratio", resize.keepAspectRatio ? 1 : 0);
        formData.append("resize_is_custom", resize.isCustom ? 1 : 0);
        formData.append("resize_mode", resize.mode);
        formData.append("upscale_method", resize.upscaleMethod);

        formData.append("cutout", cutout && maskType !== "none" ? 1 : 0);
        formData.append("mask_type", maskType);

        formData.append("select_mask_x", selectMask?.x || 0);
        formData.append("select_mask_y", selectMask?.y || 0);
        formData.append("select_mask_width", selectMask?.width || 0);
        formData.append("select_mask_height", selectMask?.height || 0);
        formData.append("select_mask_shape", selectMaskShape || "rectangle");

        const response = await api.post("/modifier", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        if (response) {
            console.log(response, 'THIS IS RESPONSE')
            return response;
        }
    } catch (error) {
        console.error("Fehler beim bearbeiten der Bildgröße:", error.response?.data || error.message);
        throw error;
    }
};

export const colorModifier = async (payload = {}) => {
    const { layer, values, mask } = payload;

    if (!layer?.id || !values) {
        return null;
    }

    const formData = new FormData();

    formData.append("method", "color");
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

    const response = await api.post("/modifier", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

    return response?.data || response;
};