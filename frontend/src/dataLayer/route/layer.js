import api from "@/dataLayer/api";
import {ref} from "vue";

export const addLayer = async (layer) => {
    try {
        const formData = new FormData();
        formData.append("method", "add");
        formData.append("name", layer.name);
        formData.append("type", layer.type);
        formData.append("width", layer.width);
        formData.append("height",  layer.height);
        if(layer.id) {
            formData.append("id",  layer.id);
        }

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


export const addTextLayer = async (layer) => {
    try {
        const formData = new FormData();
        formData.append("method", "addText");
        formData.append("type", layer.type);
        formData.append("order", layer.order);
        formData.append("name", layer.name);
        formData.append("hidden",  layer.hidden);
        formData.append("opacity",  layer.opacity);
        formData.append("color", layer.color);
        formData.append("fontFamily", layer.fontFamily);
        formData.append("font", layer.font);
        formData.append("fontSize", layer.fontSize);
        formData.append("fontWeight",  layer.fontWeight);
        formData.append("initFontSize", layer.initFontSize);
        formData.append("initHeight", layer.initHeight);
        formData.append("initWidth", layer.initWidth);
        formData.append("letterSpacing",  layer.letterSpacing);
        formData.append("lineHeight", layer.lineHeight);
        formData.append("text", layer.text);
        formData.append("textAlign", layer.textAlign);
        formData.append("textDecoration",  layer.textDecoration);
        formData.append("textTransform", layer.textTransform);
        formData.append("width", layer.width);
        formData.append("height", layer.height);
        formData.append("x", layer.x);
        formData.append("y",  layer.y);
        formData.append("mask",  layer.mask);

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

export const addPathLayer = async (layer) => {
    try {
        const formData = new FormData();
        formData.append("method", "addPath");
        formData.append("name", layer.name || "");
        formData.append("closed", layer.closed);
        // Komplexe Daten als JSON-Strings
        formData.append("points", JSON.stringify(layer.points));
        formData.append("connections", JSON.stringify(layer.connections));
        formData.append("gradient", JSON.stringify(layer.gradient));
        formData.append("strokeDashArray", JSON.stringify(layer.strokeDashArray));

        formData.append("stroke", layer.stroke);
        formData.append("strokeWidth", layer.strokeWidth);
        formData.append("strokeDash", layer.strokeDash);
        formData.append("strokeDashType", layer.strokeDashType);
        formData.append("fill", layer.fill);
        formData.append("fillOpacity", layer.fillOpacity);

        const response = await api.post('/layer', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (response) {
            return true;
        }
    } catch (error) {
        console.error("Error adding path layer:", error.response?.data || error.message);
    }
};

export const fetchLayers = async () => {
    try {
        const data = await api.get('/layer');
        if(data) {
            console.log(data)
            return data
        }
    } catch (err) {
        console.error('Fehler beim Abrufen der Einstellungen:', err);
    }
};

export const updateLayer = async (layer) => {
    try {
        if (layer.base64) {
            const base64Response = await api.post("/renderer", {
                method: "base64",
                id: layer.id,
                image_base64: layer.base64
            }, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            if (base64Response?.url) {
                layer.url = base64Response.url;
                console.log(layer.url)
                delete layer.base64; // Base64-Daten entfernen, nicht erneut mitschicken
            } else {
                console.error("Fehler beim Konvertieren von Base64 zu URL");
                return false;
            }
        }

        // 2️⃣ Layer-Daten normal speichern
        const formData = new FormData();
        formData.append("method", "update");
        formData.append("type", layer.type);
        formData.append("name", layer.name);
        formData.append("width", layer.width);
        formData.append("height", layer.height);
        formData.append("id", layer.id);
        formData.append("url", layer.url);
        formData.append("a", layer.matrix.a);
        formData.append("b", layer.matrix.b);
        formData.append("c", layer.matrix.c);
        formData.append("d", layer.matrix.d);
        formData.append("x", layer.matrix.x);
        formData.append("y", layer.matrix.y);
        formData.append("rotate", layer.matrix.rotate);
        formData.append("order", layer.order);
        formData.append("hidden", layer.hidden);
        formData.append("opacity", layer.opacity);
        formData.append("color", layer.color);
        formData.append("mask", layer.mask);

        const response = await api.post("/layer", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        return !!response;
    } catch (error) {
        console.error("Error updating layer:", error.response?.data || error.message);
        return false;
    }
};

// Layer löschen
export const deleteLayer = async (layers) => {
    if (layers.length === 0) return;

    try {
        const state = ref(false);
        for (const layer of layers) {
            state.value = false;
            const formData = new FormData();
            formData.append("method", "delete");
            if(layer.id) {
                formData.append("id", layer.id);
            } else {
                formData.append("id", layer);
            }

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

// Layer gruppieren
export const groupLayer = async (payload) => {
    if (!payload.ids || payload.ids.length === 0) return;

    try {
        const formData = new FormData();
        formData.append("method", "group");

        // Entweder einzelne ID oder Liste übergeben
        formData.append("ids", JSON.stringify(payload.ids));

        if (payload.group) {
            formData.append("group", payload.group);
        }

        if (payload.reset) {
            formData.append("reset", payload.reset);
        }

        console.log(payload)

        const response = await api.post('/layer', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        if(response) return true
    } catch (error) {
        console.error("Error grouping layers:", error.response?.data || error.message);
    }
};


export const pasteLayer = async (layer) => {
    try {
        const formData = new FormData();
        formData.append("method", "paste");
        formData.append("id", layer.id);

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

export const orderLayers = async (layer) => {
    try {
        const formData = new FormData();
        formData.append("method", "order");
        formData.append("id", layer.id);
        formData.append("order", layer.order);

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

export const hideLayer = async (layer) => {
    try {
        const formData = new FormData();
        formData.append("method", "hide");
        formData.append("id", layer.id);
        formData.append("hidden", layer.hidden);

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

export const blendLayer = async (layer) => {
    try {
        const formData = new FormData();
        formData.append("method", "blend");
        formData.append("id", layer.id);
        formData.append("blend_mode", layer.blend_mode);
        formData.append("color", layer.color);

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

export const maskLayer = async (id, id2) => {
    try {
        const formData = new FormData();
        formData.append("method", "mask");
        formData.append("id", id);
        formData.append("id2", id2);

        const response = await api.post('/layer', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (response) {
            return response;
        }
    } catch (error) {
        console.error("Fehler beim Maskieren:", error.response?.data || error.message);
    }
};

export const maskedLayer = async (id, id2) => {
    try {
        const formData = new FormData();
        formData.append("method", "masked");
        formData.append("id", id);
        formData.append("id2", id2);

        const response = await api.post('/layer', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (response) {
            return response;
        }
    } catch (error) {
        console.error("Fehler beim Maskieren:", error.response?.data || error.message);
    }
};


export const updateChannel = async () => {
    try {
        const formData = new FormData();
        formData.append("method", "update:channel");

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