export const globalBackupEvent = (route) => ({
    "backup:create-global": async (payload) => {
        const response = await route.api.createGlobalBackup(payload);
        if (response) {
            await route.emit("backup:fetch-list");
        }
    },

    "backup:undo": async () => {
        const state = await route.api.undoGlobalBackup();
        if (state) {
            await route.emit("backup:apply-state", state);
        }
    },

    "backup:redo": async () => {
        const state = await route.api.redoGlobalBackup();
        if (state) {
            await route.emit("backup:apply-state", state);
        }
    },

    "backup:jump-to": async (index) => {
        const state = await route.api.jumpToGlobalBackup(index);
        if (state) {
            await route.emit("backup:apply-state", state);
        }
    },

    "backup:get-current": async () => {
        const state = await route.api.getCurrentGlobalBackup();
        if (state) {
            await route.emit("backup:apply-state", state);
        }
    },

    "backup:fetch-list": async () => {
        const list = await route.api.listGlobalBackups();
        route.backupStates.global.value = list;
    },

    "backup:apply-state": async (state) => {
        if (state.viewport) await route.emit("viewport:update", state.viewport);
        if (state.elements) await route.emit("elements:update", state.elements);
        if (state.layer) await route.emit("layer:update", state.layer);
    },
});

export const layerBackupEvent = (route) => ({
    "backup:create-layer": async (id) => {
        const response = await route.api.createLayerBackup(id);
        if (response) {
            await route.emit("backup:fetch-layer-list", id);
        }
    },

    "backup:restore-layer": async (id) => {
        const layer = await route.api.restoreLayerBackup(id);
        if (layer) {
            await route.emit("layer:replace", layer);
        }
    },

    "backup:previous-layer": async (id) => {
        const layer = await route.api.previousLayerBackup(id);
        if (layer) {
            await route.emit("layer:replace", layer);
        }
    },

    "backup:forward-layer": async (id) => {
        const layer = await route.api.forwardLayerBackup(id);
        if (layer) {
            await route.emit("layer:replace", layer);
        }
    },

    "backup:fetch-layer-list": async (id) => {
        const list = await route.api.listLayerBackups(id);
        route.backupStates.layer[id] = list;
    },
});
