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
        const { key, data } = payload;
        const bs = route.brushSettings.value;
        switch (key) {
            case 'size':
                bs.size = data;
                break;
            case 'opacity':
                bs.opacity = data;
                break;
            case 'blendMode':
                bs.blendMode = data;
                break;
            case 'jitter':
                bs.jitter = data;
                break;
            case 'angle':
                bs.angle = data;
                break;
            case 'sizeDynamics':
                bs.sizeDynamics = data;
                break;
            case 'opacityDynamics':
                bs.opacityDynamics = data;
                break;
            case 'angleDynamics':
                bs.angleDynamics = data;
                break;
            case 'rotationRandom':
                bs.rotationRandom = data;
                break;
            case 'scatter':
                bs.scatter = data;
                break;
            case 'flipX':
                bs.flipX = data;
                break;
            case 'flipY':
                bs.flipY = data;
                break;
            case 'fadeDynamics':
                bs.fadeDynamics = data;
                break;
            default:
                console.warn(`Unknown brush-setting key: ${key}`);
        }
    }
})