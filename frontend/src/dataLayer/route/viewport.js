import api from "@/dataLayer/api";

export const viewportSetup = async (payload) => {
    try {
        const formData = new FormData();
        formData.append('method', "set");
        formData.append('mode', payload.mode);
        formData.append('name', payload.title);
        formData.append('width', payload.width);
        formData.append('height', payload.height);
        formData.append('dpi', payload.dpi);
        formData.append('unit', payload.unit);
        formData.append('sync', payload.sync);
        formData.append('layer', payload.layer);

        const response = await api.post('/viewport', formData, {
            headers: {'Content-Type': 'multipart/form-data'},
        });

        if (response) {
            return response
        }
    } catch (error) {
        console.error('Error adding layer:', error);
    }
    return false;
};

export const fetchViewport = async () => {
    try {
        const data = await api.get('/viewport');
        if(data) {
            return data
        }
    } catch (err) {
        console.error('Fehler beim Abrufen der Einstellungen:', err);
    }
};