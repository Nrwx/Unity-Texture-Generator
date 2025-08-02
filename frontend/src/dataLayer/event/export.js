export const exportEvent = (route) => ({
    "export:mode": async (payload) => {
        route.exportData.value.mode = payload;
        if (payload === 1) {
            route.emit('export:type', 'SVG')
        } else if (payload === 2) {
            route.emit('export:type', 'PDF')
        } else {
            route.emit('export:type', 'PNG')
        }
    },
    "export:quality": async (payload) => {
        route.exportData.value.quality = payload;
    },
    "export:type": async (payload) => {
        route.exportData.value.type = payload;
        console.log(route.exportData.value.type)
    },
    "export:dds-compress": async (payload) => {
        route.exportData.value.ddsCompress = payload;
        console.log(route.exportData.value.type)
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
    "export:update": async (payload) => {
        const data = {
            mode: payload.mode,
            quality: payload.quality,
            type: payload.type.value,
            dpi: payload.dpi,
            title: payload.title,
            compress: payload.compress,
            inlineCss: payload.inlineCss,
            paperSize: payload.paperSize,
            landscape: payload.landscape,
            margin: payload.margin,
            mipmap: payload.mipmap,
            ddsCompress: payload.ddsCompress
        };

        console.log(data)

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