export const windowStateEvent = (route) => ({
    "viewport-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.viewport.value = payload;
        }
    },
    "dialog-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.dialog.value = payload;
        }
    },
    "layer-state": async (payload) => {
        if (typeof payload === "boolean") {
            await route.emit("fetch-layer");
            route.windowStates.layer.value = payload;
        }
    },
    "select-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.select.value = payload;
        } else {
            route.windowStates.select.value = payload.state;
            route.localData.selectedShape.value = payload.shape;
            console.log('Auswahl abgeschlossen:', payload)
        }
    },
    "cursor-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.cursor.value = payload;
            route.windowStates.select.value = false;
            route.windowStates.text.value = false;
        }
    },
    "text-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.text.value = payload;
        }
    },
    "setting-state": async (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.setting.value = payload;
        } else {
            route.windowStates.setting.value = true;
            await route.emit("fetch-setting");
        }
    },
    "fullscreen-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.fullscreen.value = payload;
        } else {
            route.fullscreenInfo.title = payload.title
            route.fullscreenInfo.id = payload.id
            route.fullscreenInfo.src = payload.src
            route.windowStates.fullscreen.value = true;
        }
    },
    "tile-state": async (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.fullscreen.value = payload;
        } else {
            route.fullscreenInfo.mode = payload.mode
            route.fullscreenInfo.id = payload.id
            route.fullscreenInfo.title = payload.title
            route.fullscreenInfo.src = payload.src
            route.fullscreenInfo.tile = payload.tile
            route.fullscreenInfo.tileSrc = payload.tileSrc
            route.fullscreenInfo.tileSize = payload.tileSize
            route.fullscreenInfo.zoom = payload.zoom
            const response = await route.api.generateTileLayout(route.fullscreenInfo);
            if(response) {
                route.fullscreenInfo.tileSrc = response.tileSrc;
            }
        }
    },
    "tools-state": (payload) => {
        route.fullscreenInfo.mode = payload.mode
        route.fullscreenInfo.title = payload.title;
        route.fullscreenInfo.id = payload.id
        route.fullscreenInfo.src = payload.src
        route.windowStates.fullscreen.value = true;
    },
});