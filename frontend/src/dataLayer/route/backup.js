import api from "@/dataLayer/api";

// --- GLOBAL BACKUP ---

export const createGlobalBackup = async (state) => {
    try {
        const formData = new FormData();
        formData.append("method", "create_global");
        formData.append("state", JSON.stringify(state));

        const response = await api.post("/backup", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
    } catch (error) {
        console.error("Fehler beim Erstellen des globalen Backups:", error.response?.data || error.message);
        throw error;
    }
};

export const undoGlobalBackup = async () => {
    try {
        const formData = new FormData();
        formData.append("method", "undo");

        const response = await api.post("/backup", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
    } catch (error) {
        console.error("Fehler beim Undo:", error.response?.data || error.message);
        throw error;
    }
};

export const redoGlobalBackup = async () => {
    try {
        const formData = new FormData();
        formData.append("method", "redo");

        const response = await api.post("/backup", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
    } catch (error) {
        console.error("Fehler beim Redo:", error.response?.data || error.message);
        throw error;
    }
};

export const jumpToGlobalBackup = async (index) => {
    try {
        const formData = new FormData();
        formData.append("method", "jump");
        formData.append("index", index);

        const response = await api.post("/backup", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
    } catch (error) {
        console.error("Fehler beim Sprung zum Backup:", error.response?.data || error.message);
        throw error;
    }
};

// **neu**: GET statt POST
export const listGlobalBackups = async () => {
    try {
        const response = await api.get("/backup/global/list");
        return response.data;
    } catch (error) {
        console.error("Fehler beim Auflisten der globalen Backups:", error.response?.data || error.message);
        throw error;
    }
};

// **neu**: GET statt POST
export const getCurrentGlobalBackup = async () => {
    try {
        const response = await api.get("/backup/global");
        return response.data;
    } catch (error) {
        console.error("Fehler beim Holen des aktuellen globalen States:", error.response?.data || error.message);
        throw error;
    }
};

// --- LAYER BACKUP ---

export const createLayerBackup = async (id) => {
    try {
        const formData = new FormData();
        formData.append("method", "create");
        formData.append("id", id);

        const response = await api.post("/backup", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
    } catch (error) {
        console.error("Fehler beim Erstellen des Layer-Backups:", error.response?.data || error.message);
        throw error;
    }
};

export const restoreLayerBackup = async (id) => {
    try {
        const formData = new FormData();
        formData.append("method", "restore");
        formData.append("id", id);

        const response = await api.post("/backup", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
    } catch (error) {
        console.error("Fehler beim Wiederherstellen des Layer-Backups:", error.response?.data || error.message);
        throw error;
    }
};

export const previousLayerBackup = async (id) => {
    try {
        const formData = new FormData();
        formData.append("method", "previous");
        formData.append("id", id);

        const response = await api.post("/backup", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
    } catch (error) {
        console.error("Fehler beim Zurückspringen im Layer-Backup:", error.response?.data || error.message);
        throw error;
    }
};

export const forwardLayerBackup = async (id) => {
    try {
        const formData = new FormData();
        formData.append("method", "forward");
        formData.append("id", id);

        const response = await api.post("/backup", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
    } catch (error) {
        console.error("Fehler beim Vorspringen im Layer-Backup:", error.response?.data || error.message);
        throw error;
    }
};

// **neu**: GET statt POST
export const listLayerBackups = async (id) => {
    try {
        const response = await api.get(`/backup/layer/${id}/list`);
        return response.data;
    } catch (error) {
        console.error("Fehler beim Auflisten der Layer-Backups:", error.response?.data || error.message);
        throw error;
    }
};

// Optional: GET aktuellen Index + Liste
export const getCurrentLayerBackup = async (id) => {
    try {
        const response = await api.get(`/backup/layer/${id}/current`);
        return response.data;
    } catch (error) {
        console.error("Fehler beim Holen des aktuellen Layer-Backup-States:", error.response?.data || error.message);
        throw error;
    }
};
