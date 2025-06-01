import api from "@/dataLayer/api";

export const fillModifier = async (data) => {
    try {
        const formData = new FormData();
        formData.append("method", "fill");
        formData.append("id", data.id);
        formData.append("x", data.x);
        formData.append("y", data.y);
        formData.append("color", data.color);

        const response = await api.post("/modifier", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        if (response) {
            console.log(response, 'THIS IS RESPONSE')
            return response;
        }
    } catch (error) {
        console.error("Fehler beim Farbausfüllen:", error.response?.data || error.message);
        throw error;
    }
};
