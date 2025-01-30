import api from "@/dataLayer/api";
import {osSettings} from "@/dataLayer/setting";

const fetchOsSettings = async () => {
    try {
        // Daten über die `api.get`-Methode abrufen
        const data = await api.get('/settings');
        // Die aktuellen Einstellungen in die `osSettings` Variable einfügen
        if(data) {
            return data
        }
    } catch (err) {
        console.error('Fehler beim Abrufen der Einstellungen:', err);
    }
};

const saveOsSettings = async () => {
    try {
        // Einstellungen mit der `api.post`-Methode speichern
        const data = await api.post('/settings', { ...osSettings });
        if(data) {
            return data
        }
    } catch (err) {
        console.error('Fehler beim Speichern der Einstellungen:', err);
    }
};

export { fetchOsSettings, saveOsSettings };
