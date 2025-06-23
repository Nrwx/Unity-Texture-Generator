import api from "@/dataLayer/api";

export const fetchBrush = async () => {
    try {
        // Daten über die `api.get`-Methode abrufen
        const data = await api.get('/brush');
        if(data) {
            return data
        }
    } catch (err) {
        console.error('Fehler beim Abrufen der Brushes:', err);
    }
};