export const viewportEvent = (route) => ({
    "viewport-setup": async (payload) => {
        const data = {...payload}
        const response = await route.api.viewportSetup(data);
        if (response) {
            route.localData.viewport.value = data;
            route.windowStates.viewport = false;
        }
    },
    "viewport-setting": (payload) => {
        route.localData.viewport.value = payload;
    }
});
