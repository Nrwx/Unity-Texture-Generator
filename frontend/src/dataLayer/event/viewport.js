export const viewportEvent = (route) => ({
    "viewport-setup": async (payload) => {
        const data = { ...payload };
        const response = await route.api.viewportSetup(data);
        if (response) {
            await route.emit("fetch-layer");
            route.localData.viewport.value = data;
            route.windowStates.viewport = false;
        }
    },
    "viewport-settings": (payload) => {
        route.localData.viewport.value = route.localData.viewport.value[payload];
    }
});
