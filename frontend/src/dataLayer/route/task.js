// src/dataLayer/taskApi.js
import api from "@/dataLayer/api";

/**
 * API helpers for tasks — same scheme as your backup example (FormData + "method")
 */

/* create task
   payload: object with fields type, active, state, time, module, custom (optional array)
*/
export const createTask = async (payload) => {
    try {
        const formData = new FormData();
        formData.append("method", "create");
        formData.append("active", payload?.active);
        formData.append("state", payload?.state);
        formData.append("time_val", payload?.time_val);
        formData.append("type", payload?.type);
        formData.append("custom", payload?.custom);
        formData.append("module", payload?.module);

        const response = await api.post("/task", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        if (response) {
            return response;
        }
    } catch (error) {
        console.error("Fehler beim Erstellen des Tasks:", error.response?.data || error.message);
        throw error;
    }
};

/* update task
   id: task id
   payload: fields to update (type, active, state, time, module, custom, progress...)
*/
export const updateTask = async (payload) => {
    try {
        const formData = new FormData();
        formData.append("method", "update");
        formData.append("id", payload?.id);
        formData.append("active", payload?.active);
        formData.append("state", payload?.state);
        formData.append("time_val", payload?.time_val);
        formData.append("type", payload?.type);
        formData.append("progress", payload?.progress);
        formData.append("default", payload?.default);
        formData.append("custom", payload?.custom);
        formData.append("customId", payload?.customId);
        formData.append("module", payload?.module);

        const response = await api.post("/task", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        if (response) {
            return response;
        }
    } catch (error) {
        console.error("Fehler beim Aktualisieren des Tasks:", error.response?.data || error.message);
        throw error;
    }
};

/* delete task
   id: task id
*/
export const deleteTask = async (payload) => {
    try {
        const formData = new FormData();
        formData.append("method", "delete");
        formData.append("id", payload?.id);

        const response = await api.post("/task", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        if (response) {
            return true;
        }
    } catch (error) {
        console.error("Fehler beim Löschen des Tasks:", error.response?.data || error.message);
        throw error;
    }
};

/* run task by id */
export const runTask = async (payload) => {
    try {
        const formData = new FormData();
        formData.append("method", "run");
        formData.append("id", payload?.id);

        const response = await api.post("/task", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        if (response) {
            return true;
        }
    } catch (error) {
        console.error("Fehler beim Starten des Tasks:", error.response?.data || error.message);
        throw error;
    }
};

/* schedule task by id with optional delay (seconds) */
export const scheduleTask = async (payload) => {
    try {
        const formData = new FormData();
        formData.append("method", "schedule");
        formData.append("id", payload?.id);
        formData.append("delay", payload?.delay);

        const response = await api.post("/task", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        if (response) {
            return true;
        }
    } catch (error) {
        console.error("Fehler beim Planen des Tasks:", error.response?.data || error.message);
        throw error;
    }
};

/* stop / terminate task by id */
export const stopTask = async (payload) => {
    try {
        const formData = new FormData();
        formData.append("method", "stop");
        formData.append("id", payload?.id);

        const response = await api.post("/task", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        if (response) {
            return true;
        }
    } catch (error) {
        console.error("Fehler beim Stoppen des Tasks:", error.response?.data || error.message);
        throw error;
    }
};


export const fetchTask = async (payload) => {
    try {
        let uri = ""
        uri = "/task"
        if (payload?.id) {
            uri += `/${payload?.id}`
        }
        if (payload?.meta) {
            uri += `/meta`
        }
        const response = await api.get(uri);

        if (response) {
            return response;
        }
    } catch (error) {
        console.error(
            "Fehler beim Abrufen eines Tasks:",
            error.response?.data || error.message
        );
        throw error;
    }
};