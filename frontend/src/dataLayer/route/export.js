import api from "@/dataLayer/api";

export const updateExport = async (data) => {
    try {
        const formData = new FormData();
        formData.append("method", "update");
        formData.append("mode", data.mode);
        formData.append("quality", data.quality);
        formData.append("type", data.type);
        formData.append("dpi", data.dpi);
        formData.append("title", data.title);
        formData.append("compress", data.compress);
        formData.append("inlineCss", data.inlineCss);
        formData.append("paperSize", data.paperSize);
        formData.append("landscape", data.landscape);
        formData.append("margin", data.margin);
        formData.append("mipmap", data.mipmap);
        formData.append("ddsCompress", data.ddsCompress);

        const response = await api.post("/export", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        return response;
    } catch (error) {
        console.error("Fehler beim Export:", error.response?.data || error.message);
        throw error;
    }
};
