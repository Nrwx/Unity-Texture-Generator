const asArray = payload => Array.isArray(payload) ? payload : [payload].filter(Boolean);

export const meshEvent = (route) => ({
    "mesh:fetch": async (payload = {}) => {
        return await route.api.fetchMesh(payload);
    },

    "mesh:create": async (payload) => {
        const response = await route.api.createMesh(payload);

        if (response) {
            await route.emit("fetch-layer");
            await route.emit("backup:fetch-list");
        }

        return response;
    },

    "mesh:update": async (payload) => {
        const response = await route.api.updateMesh(payload);

        if (response) {
            await route.emit("fetch-layer");
        }

        return response;
    },

    "mesh:delete": async (payload) => {
        let changed = false;

        for (const layer of asArray(payload)) {
            const response = await route.api.deleteMesh(layer);
            changed = Boolean(response) || changed;
        }

        if (changed) {
            await route.emit("layer:select", []);
            await route.emit("fetch-layer");
        }

        return changed;
    },
});
