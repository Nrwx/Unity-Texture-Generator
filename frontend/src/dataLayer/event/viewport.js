export const viewportEvent = (route) => ({
    "viewport-setup": async (payload) => {
        const data = {...payload}
        const response = await route.api.viewportSetup(data);
        if (response) {
            await route.emit('fetch-viewport')
            route.windowStates.viewport = false;
        }
    },
    "fetch-viewport": async () => {
        const response = await route.api.fetchViewport();
        if (response) {
            route.localData.viewport.value = response
            console.log(response, 'VIEWPORT')
        }
    },
    "viewport:title": (payload) => {
        route.localData.viewport.value.title = payload;
    },
    "viewport:unit": (payload) => {
        route.localData.viewport.value.unit = payload;
    },
});
