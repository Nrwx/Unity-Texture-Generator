import api from "@/dataLayer/api";

export const createCursor = async (cursorData) => {
    try {
        const formData = new FormData();

        // Methode fest auf "create" setzen
        formData.append('method', 'create');

        // Restliche Daten hinzufügen
        Object.entries(cursorData).forEach(([key, value]) => {
            formData.append(key, value);
        });

        const data = await api.post('/cursor', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        if (data) {
            return data;
        }
    } catch (err) {
        console.error('Fehler beim Erstellen des Cursors:', err);
    }
};
