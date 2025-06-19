import api from "@/dataLayer/api";

/**
 * Bild über eigenes Flask-Backend generieren lassen
 * @param {string} prompt - Beschreibung des Bildes
 * @returns {Promise<boolean>} - Base64 oder Pfad des generierten Bildes
 */
export const generateImage = async (prompt, mode) => {
    try {
        const response = await api.post('/ai/generateImage/', {
            prompt,
            mode
        });

        console.log("Bildantwort:", response);

        // Wenn dein Backend Base64 zurückgibt:
        return true;

        // Alternativ, wenn dein Backend eine URL/Pfad zurückgibt:
        // return response.data.url;
    } catch (error) {
        console.error("Fehler bei der Bildgenerierung:", error.response?.data || error.message);
        throw new Error(error.response?.data?.error || "Bildgenerierung fehlgeschlagen");
    }
};
