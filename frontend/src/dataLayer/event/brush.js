export const brushEvent = (route) => ({
    "fetch-brush": async () => {
        route.localData.loading.value = true;
        const response = await route.api.fetchBrush();
        if (response) {
            route.localData.brush.value = response
            route.localData.loading.value = false
        }
    },
    "brush:save-preset": async (payload) => {
        route.localData.brushPreset.value = payload
    }
})