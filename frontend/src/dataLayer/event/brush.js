import {nextTick} from "vue";

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
    "brush:pressure": async (payload) => {
        route.brushSettings.value.pressure = payload
    },
    "update:selected-brush": async (payload) => {
        route.brushSettings.value.url = payload.imageUrl
        route.brushSettings.value.id = payload.childId
        await nextTick()
        const bs = route.brushSettings.value;
        const cursor = {
            id: bs.id,
            rotation: bs.angle,
            size: bs.size,
            opacity: bs.opacity
        }
        if(cursor) {
            await route.emit("generate:cursor", cursor);
        }
    },
    "update:brush-settings": async (payload) => {
        const { key, data } = payload;
        switch (key) {
            case 'size':
                route.brushSettings.value.size = data;
                break;
            case 'opacity':
                route.brushSettings.value.opacity = data;
                break;
            case 'blendMode':
                route.brushSettings.value.blendMode = data;
                break;
            case 'jitter':
                route.brushSettings.value.jitter = data;
                break;
            case 'angle':
                route.brushSettings.value.angle = data;
                break;
            case 'pressure':
                route.brushSettings.value.pressure = data;
                break;
            case 'sizeDynamics':
                route.brushSettings.value.sizeDynamics = data;
                break;
            case 'opacityDynamics':
                route.brushSettings.value.opacityDynamics = data;
                break;
            case 'angleDynamics':
                route.brushSettings.value.angleDynamics = data;
                break;
            case 'rotationRandom':
                route.brushSettings.value.rotationRandom = data;
                break;
            case 'scatter':
                route.brushSettings.value.scatter = data;
                break;
            case 'flipX':
                route.brushSettings.value.flipX = data;
                break;
            case 'flipY':
                route.brushSettings.value.flipY = data;
                break;
            case 'fadeDynamics':
                route.brushSettings.value.fadeDynamics = data;
                break;
            default:
                console.warn(`Unknown brush-setting key: ${key}`);
        }
        const cursor = {
            id: route.brushSettings.value.id,
            rotation: route.brushSettings.value.angle,
            size: route.brushSettings.value.size,
            opacity: route.brushSettings.value.opacity
        }
        if(cursor) {
            await route.emit("generate:cursor", cursor);
        }
    }
})