export const viewportEvent = (route) => ({
    "viewport:setup": async (payload) => {
        const response = await route.api.viewportSetup(payload);
        if (response) {
            await route.emit("fetch-viewport");
            await route.emit("viewport-state", false);
        }
    },

    "fetch-viewport": async () => {
        const response = await route.api.fetchViewport();
        if (response) {
            route.localData.viewport.value = {
                ...route.localData.viewport.value,
                ...response,
            };
        }
    },

    "viewport:preset": (payload) => {
        route.localData.viewport.value.preset = payload;
    },

    "viewport:title": (payload) => {
        route.localData.viewport.value.title = payload;
    },

    "viewport:width": (payload) => {
        route.localData.viewport.value.width = Number(payload) || 0;
    },

    "viewport:height": (payload) => {
        route.localData.viewport.value.height = Number(payload) || 0;
    },

    "viewport:mode": (payload) => {
        route.localData.viewport.value.mode = payload;
    },

    "viewport:dpi": (payload) => {
        route.localData.viewport.value.dpi = Number(payload) || 72;
    },

    "viewport:unit": (payload) => {
        route.localData.viewport.value.unit = payload;
    },

    "viewport:sync": (payload) => {
        route.localData.viewport.value.sync = !!payload;
    },

    "viewport:layer": (payload) => {
        route.localData.viewport.value.layer = payload;
    },

    "viewport:orientation": (payload) => {
        route.localData.viewport.value.orientation = payload;
    },

    "viewport:background": (payload) => {
        route.localData.viewport.value.background = payload;
    },

    "viewport:ratio-lock": (payload) => {
        route.localData.viewport.value.lockRatio = !!payload;
    },

    "viewport:grid": (payload) => {
        route.localData.viewport.value.grid = !!payload;
    },

    "viewport:safe-area": (payload) => {
        route.localData.viewport.value.safeArea = !!payload;
    },

    "viewport:project-type": (payload) => {
        route.localData.viewport.value.projectType = payload;
    },

    "viewport:reset": () => {
        // optional hook
    },
});