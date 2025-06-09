export const viewportEvent = (route) => ({
    "viewport-setup": async (payload) => {
        const response = await route.api.viewportSetup(payload);
        if (response) {
            await route.emit("fetch-layer");
            route.localData.viewport.value = response.viewport;
            route.windowStates.viewport = false;
        }
    },
    "viewport-setting": (payload) => {
        route.localData.viewport.value = payload;
    }
});
