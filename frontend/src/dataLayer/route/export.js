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
        formData.append("raster", data.raster);
        formData.append("pdfFitMode", data.pdfFitMode);
        formData.append("landscape", data.landscape);
        formData.append("margin", data.margin);
        formData.append("mipmap", data.mipmap);
        formData.append("ddsCompress", data.ddsCompress);
        formData.append("useTimeline", data.useTimeline);
        formData.append("timelineStart", data.timelineStart);
        formData.append("timelineEnd", data.timelineEnd);
        formData.append("timelineTime", data.timelineTime);
        formData.append("exportStart", data.exportStart);
        formData.append("exportEnd", data.exportEnd);
        formData.append("timelineFps", data.timelineFps);
        formData.append("videoResolution", data.videoResolution);
        formData.append("videoProfile", data.videoProfile);
        formData.append("videoPreset", data.videoPreset);
        formData.append("videoEncoding", data.videoEncoding);
        formData.append("videoBitrate", data.videoBitrate);
        formData.append("videoCrf", data.videoCrf);
        formData.append("useFileSystem", data.useFileSystem);

        const response = await api.post("/export", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        return response;
    } catch (error) {
        console.error("Fehler beim Export:", error.response?.data || error.message);
        throw error;
    }
};

export const startMp4Export = async (data) => {
    try {
        const formData = new FormData();
        formData.append("method", "start-mp4");
        formData.append("title", data.title);
        formData.append("timelineFps", data.timelineFps);
        formData.append("frameCount", data.frameCount);
        formData.append("videoResolution", data.videoResolution);
        formData.append("videoProfile", data.videoProfile);
        formData.append("videoPreset", data.videoPreset);
        formData.append("videoEncoding", data.videoEncoding);
        formData.append("videoBitrate", data.videoBitrate);
        formData.append("videoCrf", data.videoCrf);
        formData.append("useFileSystem", data.useFileSystem);

        return await api.post("/export", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    } catch (error) {
        console.error("Fehler beim MP4-Export-Start:", error.response?.data || error.message);
        throw error;
    }
};

export const appendMp4Frame = async (data) => {
    try {
        const formData = new FormData();
        formData.append("method", "append-mp4-frame");
        formData.append("sessionId", data.sessionId);
        formData.append("frameIndex", data.frameIndex);
        formData.append("frameTime", data.frameTime);
        formData.append("frame", data.frame, `frame_${String(data.frameIndex).padStart(6, "0")}.png`);

        return await api.post("/export", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    } catch (error) {
        console.error("Fehler beim MP4-Frame-Upload:", error.response?.data || error.message);
        throw error;
    }
};

export const finishMp4Export = async (data) => {
    try {
        const formData = new FormData();
        formData.append("method", "finish-mp4");
        formData.append("sessionId", data.sessionId);

        return await api.post("/export", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    } catch (error) {
        console.error("Fehler beim MP4-Export-Finish:", error.response?.data || error.message);
        throw error;
    }
};
