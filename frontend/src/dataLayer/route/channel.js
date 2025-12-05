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

