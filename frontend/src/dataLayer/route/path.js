import api from "@/dataLayer/api";

const buildFormData = (config, method) => {
    const formData = new FormData();
    formData.append("method", method);

    const fields = [
        "name", "id", "stroke", "strokeWidth", "strokeDash", "strokeDashType",
        "strokeDashArray", "fill", "fillOpacity", "points", "connections",
        "gradient", "closed", "edit", "width", "height"
    ];

    fields.forEach((key) => {
        if (config[key] !== undefined && config[key] !== null) {
            const value = typeof config[key] === "object"
                ? JSON.stringify(config[key])
                : config[key];
            formData.append(key, value);
        }
    });

    return formData;
};

// ✅ Add Path
export const addPath = async (payload) => {
    try {
        const formData = buildFormData(payload, "add");
        const response = await api.post("/path", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response;
    } catch (error) {
        console.error("Fehler beim Hinzufügen eines Pfads:", error.response?.data || error.message);
        throw error;
    }
};

// ✅ Update Path
export const updatePath = async (payload) => {
    try {
        const formData = buildFormData(payload, "update");
        const response = await api.post("/path", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response;
    } catch (error) {
        console.error("Fehler beim Aktualisieren eines Pfads:", error.response?.data || error.message);
        throw error;
    }
};

// ✅ Delete Path
export const deletePath = async (payload) => {
    try {
        const formData = buildFormData({ id: payload }, "delete");
        const response = await api.post("/path", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response;
    } catch (error) {
        console.error("Fehler beim Löschen eines Pfads:", error.response?.data || error.message);
        throw error;
    }
};

export const fetchPath = async (payload) => {
    try {
        const id = payload?.id;

        const response = await api.get("/path", {
            params: { id }
        });

        return response;
    } catch (error) {
        console.error(
            "Fehler beim Abrufen eines Pfads:",
            error.response?.data || error.message
        );
        throw error;
    }
};