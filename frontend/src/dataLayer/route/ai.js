import api from "@/dataLayer/api";

/**
 * Bild über eigenes Flask-Backend generieren lassen
 * @param method
 * @param {string} prompt - Beschreibung des Bildes
 * @param mode - Img Model
 * @returns {Promise<boolean>} - Base64 oder Pfad des generierten Bildes
 */
export const generateImage = async (prompt, mode) => {
    try {
        const formData = new FormData();
        formData.append("method", 'prompt_img');
        formData.append("prompt", prompt);
        formData.append("model", mode);

        const response = await api.post('/ai/generateImage/', formData);

        if(response) {
            console.log("Bildantwort:", response);
            return true;
        }

        // Alternativ, wenn dein Backend eine URL/Pfad zurückgibt:
        // return response.data.url;
    } catch (error) {
        console.error("Fehler bei der Bildgenerierung:", error.response?.data || error.message);
        throw new Error(error.response?.data?.error || "Bildgenerierung fehlgeschlagen");
    }
};
