export const viewportEvent = (route) => ({
    "viewport-setup": async (payload) => {
        const data = {...payload}
        const response = await route.api.viewportSetup(data);
        if (response) {
            route.localData.viewport.value = data;
            route.windowStates.viewport = false;
        }
    },
    "viewport:title": (payload) => {
        route.localData.viewport.value.title = payload;
    },
    "viewport:unit": (payload) => {
        route.localData.viewport.value.unit = payload;
    },
});
