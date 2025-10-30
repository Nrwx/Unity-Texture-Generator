import api from "@/dataLayer/api";

export const fetchOsSettings = async () => {
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

export const clearCache = async (payload) => {
    try {
        const formData = new FormData();
        formData.append("method", "clear");
        formData.append("id", payload);


        const response = await api.post("/settings", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        if (response) {
            return response;
        }
    } catch (error) {
        console.error("Fehler beim löschen des Caches:", error.response?.data || error.message);
    }
};

export const saveOsSettings = async (settings) => {
    try {
        const formData = new FormData();
        formData.append("method", "update");

        // Settings-Felder dynamisch anhängen
        Object.entries(settings).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                formData.append(key, value);
            }
        });

        const response = await api.post("/settings", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        if (response) {
            return response;
        }
    } catch (error) {
        console.error("Fehler beim Speichern der Einstellungen:", error.response?.data || error.message);
    }
};
