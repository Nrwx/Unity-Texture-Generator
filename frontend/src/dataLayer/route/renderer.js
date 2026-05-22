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
    const { layer, values } = payload;

    if (!layer?.id || !values) {
        return null;
    }

    try {
        const formData = new FormData();

        formData.append("method", "color-preview");
        formData.append("id", layer.id);

        formData.append("brightness", values.brightness);
        formData.append("contrast", values.contrast);
        formData.append("color_shift", values.color_shift);
        formData.append("hue_variation", values.hue_variation);
        formData.append("invert_colors", values.invert_colors ? "true" : "false");
        formData.append("color_lookup", values.color_lookup);

        const response = await api.post("/renderer", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        return response?.data || response;
    } catch (error) {
        console.error(
            "Fehler bei Color Preview:",
            error.response?.data || error.message
        );

        throw error;
    }
};
