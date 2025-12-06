import api from "@/dataLayer/api";

export const fetchChannel = async (payload) => {
    try {
        const formData = new FormData();
        formData.append("method", 'fetch');
        if (payload?.id) formData.append("id", payload.id);
        if (payload?.ids?.length) formData.append("ids", JSON.stringify(payload?.ids));

        const response = await api.post("/channel", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        if(response) {
            return response;
        }
    } catch (error) {
        console.error("Fehler beim Rendern:", error.response?.data || error.message);
        throw error;
    }
};

export const toggleChannel = async (payload) => {
    try {
        const formData = new FormData();
        formData.append("method", 'toggle');
        formData.append("channel", payload?.channel);
        formData.append("state", payload?.state);
        if (payload?.ids?.length) formData.append("ids", JSON.stringify(payload?.ids));

        const response = await api.post("/channel", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        if (response) {
            return true;
        }
    } catch (error) {
        console.error("Fehler beim Toggle des Channels:", error.response?.data || error.message);
        throw error;
    }
};

// API Call für ChannelModel.setting
export const channelSettings = async (payload) => {
    try {
        const formData = new FormData();
        formData.append("method", 'setting');
        if (payload?.ids?.length) formData.append("ids", JSON.stringify(payload?.ids));

        const response = await api.post("/channel", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        if (response) {
            return response;
        }
    } catch (error) {
        console.error("Fehler beim Abrufen der Channel-Settings:", error.response?.data || error.message);
        throw error;
    }
};

// -------------------------------------------------------------
// CREATE NEW CHANNEL
// -------------------------------------------------------------
export const createChannel = async (payload) => {
    try {
        const formData = new FormData();
        formData.append("method", 'create');
        if (payload?.ids?.length) formData.append("ids", JSON.stringify(payload.ids));
        if (payload?.key) formData.append("key", payload.key);
        if (payload?.name) formData.append("name", payload.name);
        if (payload?.imageId) formData.append("imageId", payload.imageId);

        const response = await api.post("/channel", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        return response;
    } catch (error) {
        console.error("Fehler beim Erstellen des Channels:", error.response?.data || error.message);
        throw error;
    }
};

// -------------------------------------------------------------
// ACTIVATE EXISTING CHANNEL
// -------------------------------------------------------------
export const activateChannel = async (payload) => {
    try {
        const formData = new FormData();
        formData.append("method", 'activate');
        if (payload?.id) formData.append("id", payload.id);
        if (payload?.ids?.length) formData.append("ids", JSON.stringify(payload.ids));

        const response = await api.post("/channel", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        return !!response;
    } catch (error) {
        console.error("Fehler beim Aktivieren des Channels:", error.response?.data || error.message);
        throw error;
    }
};

// -------------------------------------------------------------
// DELETE CHANNEL
// -------------------------------------------------------------
export const deleteChannel = async (payload) => {
    try {
        const formData = new FormData();
        formData.append("method", 'delete');
        if (payload?.id) formData.append("id", payload.id);
        if (payload?.ids?.length) formData.append("ids", JSON.stringify(payload.ids));

        const response = await api.post("/channel", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        return !!response;
    } catch (error) {
        console.error("Fehler beim Löschen des Channels:", error.response?.data || error.message);
        throw error;
    }
};