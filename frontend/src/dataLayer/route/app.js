import api from "@/dataLayer/api";

export const queueStatus = async () => {
    try {
        const data = await api.get('/queue');
        if(data) {
            return data
        }
    } catch (err) {
        console.error('Fehler beim Abrufen des Queue-Status:', err);
    }
};