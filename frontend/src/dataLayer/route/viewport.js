import api from "@/dataLayer/api";

export const viewportSetup = async (viewport) => {
    try {
        const formData = new FormData();
        formData.append('mode', viewport.mode);
        formData.append('name', viewport.title);
        formData.append('width', viewport.width);
        formData.append('height', viewport.height);
        formData.append('layer', viewport.layer);

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