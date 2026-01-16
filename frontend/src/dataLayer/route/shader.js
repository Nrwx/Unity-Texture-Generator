import api from "@/dataLayer/api";

export const fetchShader = async () => {
    try {
        // Daten über die `api.get`-Methode abrufen
        const data = await api.get('/shader');
        if(data) {
            return data
        }
    } catch (err) {
        console.error('Fehler beim Abrufen der Fonts:', err);
    }
};