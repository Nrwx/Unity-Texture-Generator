export const exportEvent = (route) => ({
    "export:mode": async (payload) => {
        route.exportData.mode.value = payload;
        if (payload === 1) {
            route.exportData.type.value = 'SVG';
        } else if (payload === 2) {
            route.exportData.type.value = 'PDF';
        } else {
            route.exportData.type.value = 'PNG';
        }
        console.log(payload)
    },
    "export:quality": async (payload) => {
        route.exportData.quality.value = payload;
    },
    "export:type": async (payload) => {
        route.exportData.type.value = payload;
    },
    "export:dpi": async (payload) => {
        route.exportData.dpi.value = payload;
    },
    "export:title": async (payload) => {
        route.exportData.title.value = payload;
    },
    "export:compress": async (payload) => {
        route.exportData.compress.value = payload;
    },
    "export:inlineCss": async (payload) => {
        route.exportData.inlineCss .value= payload;
    },
    "export:paperSize": async (payload) => {
        route.exportData.paperSize.value = payload;
    },
    "export:landscape": async (payload) => {
        route.exportData.landscape.value = payload;
    },
    "export:margin": async (payload) => {
        route.exportData.margin.value = payload;
    },
    "export:update": async (payload) => {
        const data = {
            mode: payload.mode,
            quality: payload.quality,
            type: payload.type,
            dpi: payload.dpi,
            title: payload.title,
            compress: payload.compress,
            inlineCss: payload.inlineCss,
            paperSize: payload.paperSize,
            landscape: payload.landscape,
            margin: payload.margin
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