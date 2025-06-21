import api from "@/dataLayer/api";

export const createBackup = async (id, state, title) => {
    try {
        const formData = new FormData();
        formData.append("method", "create");
        if(state) {
            const data = {
                type: state.type,
                id: state.id,
                url: state.url,
                width: state.width,
                height: state.height,
                order: state.order,
                name: state.name,
                hidden: state.hidden,
                opacity: state.opacity,
                color: state.color,
                matrix: state.matrix,
                mask: state.mask,
                time: state.time,
                source: state.source,
                blend_mode: state.blend_mode
            }
            if(state.type === 1) {
                const mergedData = {
                    ...data,
                    fontFamily: state.fontFamily,
                    font: state.font,
                    fontSize: state.fontSize,
                    fontWeight: state.fontWeight,
                    initFontSize: state.initFontSize,
                    initHeight: state.initHeight,
                    initWidth: state.initWidth,
                    letterSpacing: state.letterSpacing,
                    lineHeight: state.lineHeight,
                    text: state.text,
                    textAlign: state.textAlign,
                    textDecoration: state.textDecoration,
                    textTransform: state.textTransform,
                }

                formData.append("state", JSON.stringify(mergedData));
            } else {
                formData.append("state", JSON.stringify(data));
            }

        }
        formData.append("id", id);
        formData.append("title", title);

        const response = await api.post("/backup", formData);
        if(response) {
            return true;
        }
    } catch (error) {
        console.error("Fehler beim Erstellen des Backups:", error.response?.data || error.message);
        throw error;
    }
};

export const jumpToBackup = async (id, index) => {
    try {
        const formData = new FormData();
        formData.append("method", "jump");
        formData.append("index", index);
        formData.append("id", id);

        const response = await api.post("/backup", formData);
        if(response) {
            return true;
        }
    } catch (error) {
        console.error("Fehler beim Sprung zum Backup:", error.response?.data || error.message);
        throw error;
    }
};

export const fetchBackupList = async () => {
    try {
        const response = await api.get('/backup');
        return response;
    } catch (error) {
        console.error("Fehler beim Auflisten der Backups:", error.response?.data || error.message);
        throw error;
    }
};
