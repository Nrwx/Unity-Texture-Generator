export const pathEvent = (route) => ({
    "path:add": async (payload) => {
        const exists = route.localData.paths.value.some(p => p.id === payload.id);
        if (exists) return;
        const response = await route.api.addPath(payload);
        if (response) {
            await route.emit("path:fetch");
        }
    },

    "path:update": async (payload) => {
        const response = await route.api.updatePath(payload);
        if (response) {
            await route.emit("path:fetch");
        }
    },

    "path:delete": async (payload) => {
        const response = await route.api.deletePath(payload);
        if (response) {
            await route.emit("path:fetch");
        }
    },

    "path:fetch": async (payload = null) => {
        const response = payload ? await route.api.fetchPath(payload) : await route.api.fetchPath();
        if (response) {
            if (payload) {
                route.localData.selectedPath.value = response;
            } else {
                route.localData.paths.value = response;
            }
        }
    },

    "path:select": async (payload) => {
        route.localData.selectedPath.value = payload;
    },
});
