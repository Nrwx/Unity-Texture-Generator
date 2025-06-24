export const brushEvent = (route) => ({
    "fetch-brush": async () => {
        route.localData.loading.value = true;
        const response = await route.api.fetchBrush();
        if (response) {
            route.localData.brush.value = response
            route.localData.loading.value = false
            console.log(route.localData.brush.value)
        }
    },
    "brush:save-preset": async (payload) => {
        route.localData.brushPreset.value = payload
    },
    "update:selected-brush": async (payload) => {
        route.brushSettings.value.url = payload.imageUrl
    },
    "update:brush-settings": async (payload) => {
        if(payload.key === 'size') {
            route.brushSettings.value.size = payload.data
        } else if (payload.key === 'spacing') {
            route.brushSettings.value.spacing = payload.data
        } else if (payload.key === 'opacity') {
            route.brushSettings.value.opacity = payload.data
        } else if (payload.key === 'flow') {
            route.brushSettings.value.flow = payload.data
        } else if (payload.key === 'mode') {
            route.brushSettings.value.blendMode = payload.data
        } else if (payload.key === 'jitter') {
            route.brushSettings.value.jitter = payload.data
        } else if (payload.key === 'angle') {
            route.brushSettings.value.angle = payload.data
        } else if (payload.key === 'randomize') {
            route.brushSettings.value.randomize = payload.data
        } else if (payload.key === 'layout') {
            route.brushSettings.value.layout = payload.data
        }
    }
})