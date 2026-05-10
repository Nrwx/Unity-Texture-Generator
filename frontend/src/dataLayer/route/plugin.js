import api from "@/dataLayer/api";

export const fetchPlugin = async () => {
    try {
        const data = await api.get("/plugin");
        if (data) {
            return data;
        }
    } catch (err) {
        console.error("Fehler beim Abrufen der Plugins:", err);
    }
};

export const scanPlugin = async () => {
    try {
        const formData = new FormData();
        formData.append("method", "scan");

        const data = await api.post("/plugin", formData);
        if (data) {
            return data;
        }
    } catch (err) {
        console.error("Fehler beim Scannen der Plugins:", err);
    }
};

export const pausePlugin = async (pluginId) => {
    try {
        const formData = new FormData();
        formData.append("method", "pause");
        formData.append("pluginId", pluginId);

        const data = await api.post("/plugin", formData);
        if (data) {
            return data;
        }
    } catch (err) {
        console.error(`Fehler beim Pausieren des Plugins '${pluginId}':`, err);
    }
};

export const repairPlugin = async (pluginId) => {
    try {
        const formData = new FormData();
        formData.append("method", "repair");
        formData.append("pluginId", pluginId);

        const data = await api.post("/plugin", formData);
        if (data) {
            return data;
        }
    } catch (err) {
        console.error(`Fehler beim Reparieren des Plugins '${pluginId}':`, err);
    }
};

export const uninstallPlugin = async (pluginId) => {
    try {
        const formData = new FormData();
        formData.append("method", "uninstall");
        formData.append("pluginId", pluginId);

        const data = await api.post("/plugin", formData);
        if (data) {
            return data;
        }
    } catch (err) {
        console.error(`Fehler beim Deinstallieren des Plugins '${pluginId}':`, err);
    }
};

export const togglePlugin = async (pluginId) => {
    try {
        const formData = new FormData();
        formData.append("method", "toggle");
        formData.append("pluginId", pluginId);

        const data = await api.post("/plugin", formData);
        if (data) {
            return data;
        }
    } catch (err) {
        console.error(`Fehler beim Umschalten des Plugins '${pluginId}':`, err);
    }
};

export const installAllPlugin = async () => {
    try {
        const formData = new FormData();
        formData.append("method", "installAll");

        const data = await api.post("/plugin", formData);
        if (data) {
            return data;
        }
    } catch (err) {
        console.error("Fehler beim Installieren/Vorbereiten der Plugins:", err);
    }
};

export const installPlugin = async (pluginId) => {
    try {
        const formData = new FormData();
        formData.append("method", "install");
        formData.append("pluginId", pluginId);

        const data = await api.post("/plugin", formData);
        if (data) {
            return data;
        }
    } catch (err) {
        console.error(`Fehler beim Installieren des Plugins '${pluginId}':`, err);
    }
};

export const uploadPlugin = async (file) => {
    try {
        const formData = new FormData();
        formData.append("method", "upload");
        formData.append("file", file);

        const data = await api.post("/plugin", formData);
        if (data) {
            return data;
        }
    } catch (err) {
        console.error("Fehler beim Hochladen des Plugins:", err);
    }
};