import api from "@/dataLayer/api";
import {ref} from "vue";

export const addLayer = async (layer) => {
    try {
        const formData = new FormData();
        formData.append("method", "add");
        formData.append("name", layer.name);
        formData.append("width", layer.width);
        formData.append("height",  layer.height);

        const response = await api.post('/layer', formData, {
            headers: {'Content-Type': 'multipart/form-data'},
        });

        if(response) {
            return true
        }
    } catch (error) {
        console.error("Error adding layer:", error.response?.data || error.message);
    }
};

export const fetchLayers = async () => {
    try {
        const formData = new FormData();
        formData.append("method", "list");

        const response = await api.post('/layer', formData, {
            headers: {'Content-Type': 'multipart/form-data'},
        });
        if (response) {
            return response
        }
    } catch (error) {
        console.error("Error fetching layers:", error.response?.data || error.message);
    }
};

export const updateLayer = async (layer) => {
    try {
        const formData = new FormData();
        formData.append("method", "update");
        formData.append("name", layer.name);
        formData.append("width", layer.width);
        formData.append("height", layer.height);
        formData.append("id", layer.id);
        formData.append("x", layer.x);
        formData.append("y", layer.y);
        formData.append("rotate", layer.rotate);

        const response = await api.post('/layer', formData, {
            headers: {'Content-Type': 'multipart/form-data'},
        });

        if (response) {
            return true
        }
    } catch (error) {
        console.error("Error updating layer:", error.response?.data || error.message);
    }
};

// Layer löschen
export const deleteLayer = async (layers) => {
    if (layers.length === 0) return;

    try {
        const state = ref(false);
        for (const id of layers) {
            state.value = false;
            const formData = new FormData();
            formData.append("method", "delete");
            formData.append("id", id);

            const response = await api.post('/layer', formData, {
                headers: {'Content-Type': 'multipart/form-data'},
            });

            if(response) {
                state.value = true
            }
        }

        if(state.value) {
            return state.value
        }
    } catch (error) {
        console.error("Error deleting layers:", error.response?.data || error.message);
    }
};

export const previewLayers = async () => {
    try {
        const formData = new FormData();
        formData.append("method", "preview");

        const response = await api.post('/layer', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response) {
            return response
        }
    } catch (error) {
        console.error("Error fetching preview layers:", error.response?.data || error.message);
    }
};