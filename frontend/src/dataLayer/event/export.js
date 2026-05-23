const optionValue = value => value && typeof value === "object" && "value" in value ? value.value : value;

export const exportEvent = (route) => ({
    "export:mode": async (payload) => {
        const mode = optionValue(payload);
        route.exportData.value.mode = mode;
        if (mode === 1) {
            route.emit('export:type', 'SVG')
        } else if (mode === 2) {
            route.emit('export:type', 'PDF')
        } else if (mode === 3) {
            route.emit('export:type', 'MP4')
        } else {
            route.emit('export:type', 'PNG')
        }
    },
    "export:quality": async (payload) => {
        route.exportData.value.quality = payload;
    },
    "export:type": async (payload) => {
        route.exportData.value.type = optionValue(payload);
    },
    "export:dds-compress": async (payload) => {
        route.exportData.value.ddsCompress = optionValue(payload);
    },
    "export:dpi": async (payload) => {
        route.exportData.value.dpi = payload;
    },
    "export:title": async (payload) => {
        route.exportData.value.title = payload;
    },
    "export:compress": async (payload) => {
        route.exportData.value.compress = payload;
    },
    "export:mipmap": async (payload) => {
        route.exportData.value.mipmap = payload;
    },
    "export:inlineCss": async (payload) => {
        route.exportData.value.inlineCss= payload;
    },
    "export:paperSize": async (payload) => {
        route.exportData.value.paperSize = payload;
    },
    "export:landscape": async (payload) => {
        route.exportData.value.landscape = payload;
    },
    "export:margin": async (payload) => {
        route.exportData.value.margin = payload;
    },
    "export:raster": async (payload) => {
        route.exportData.value.raster = payload;
    },
    "export:pdfFitMode": async (payload) => {
        route.exportData.value.pdfFitMode = optionValue(payload);
    },
    "export:useTimeline": async (payload) => {
        route.exportData.value.useTimeline = optionValue(payload);
    },
    "export:start": async (payload) => {
        route.exportData.value.exportStart = payload;
    },
    "export:end": async (payload) => {
        route.exportData.value.exportEnd = payload;
    },
    "export:fps": async (payload) => {
        route.exportData.value.timelineFps = payload;
    },
    "export:update": async (payload) => {
        const type = optionValue(payload.type);
        const timeline = route.timelineData?.value || {};
        const data = {
            mode: optionValue(payload.mode),
            quality: payload.quality,
            type,
            dpi: payload.dpi,
            title: payload.title,
            compress: payload.compress,
            inlineCss: payload.inlineCss,
            paperSize: payload.paperSize,
            raster: optionValue(payload.raster),
            pdfFitMode: optionValue(payload.pdfFitMode),
            landscape: optionValue(payload.landscape),
            margin: payload.margin,
            mipmap: payload.mipmap,
            ddsCompress: optionValue(payload.ddsCompress),
            useTimeline: optionValue(payload.useTimeline),
            timelineStart: timeline.startTime ?? -100,
            timelineEnd: timeline.endTime ?? 100,
            timelineTime: timeline.time ?? 0,
            exportStart: payload.exportStart,
            exportEnd: payload.exportEnd,
            timelineFps: payload.timelineFps,
        };

        const res = await route.api.updateExport(data);

        if (res) {
            route.previewData.value.mode = 0
            route.previewData.value.title = res.title
            route.previewData.value.id = res.id
            route.previewData.value.src =  res.src
            route.previewData.value.file =  res.file
        }
    }
})
