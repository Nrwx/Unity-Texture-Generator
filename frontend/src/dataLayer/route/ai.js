import api from "@/dataLayer/api";

/**
 * Bild über Flask-Backend generieren lassen
 * Entscheidet automatisch zwischen OpenAI und Local AI
 *
 * @param {string} prompt
 * @param {string} model
 * @param {string} size
 * @param {number} layerType
 * @returns {Promise<boolean>}
 */
export const generateImage = async (
    prompt,
    model,
    size = "512x512",
    layerType = 0
) => {
    try {
        const localModels = ["sd15", "sdxl"];
        const isLocalModel = localModels.includes(model);

        const endpoint = isLocalModel
            ? "/local-ai/generateImage/"
            : "/ai/generateImage/";

        const formData = new FormData();
        formData.append("method", "prompt_img");
        formData.append("prompt", prompt);
        formData.append("model", model);

        // nur für lokale AI mitsenden, falls deine OpenAI-API diese Felder nicht erwartet
        if (isLocalModel) {
            formData.append("size", size);
            formData.append("layer_type", layerType);
        }

        const response = await api.post(endpoint, formData);

        if (response) {
            console.log("Bildantwort:", response);
            return true;
        }

        return false;
    } catch (error) {
        console.error("Fehler bei der Bildgenerierung:", error.response?.data || error.message);
        throw new Error(error.response?.data?.error || "Bildgenerierung fehlgeschlagen");
    }
};