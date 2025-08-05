import api from "@/dataLayer/api";

export const renderer = async (config) => {
    try {
        const formData = new FormData();
        formData.append("method", config.mode);
        formData.append("id", config.id);

        const response = await api.post("/renderer", formData, {
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
