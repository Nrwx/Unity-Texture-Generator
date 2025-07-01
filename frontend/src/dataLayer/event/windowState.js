export const windowStateEvent = (route) => ({
    "reset:window-states": async (payload) => {
        console.log(payload);
        await route.emit("reset:modifiers", payload);
        await route.emit("select-state", payload);
        await route.emit("listener:select-mask", {pause: true, id: 'listener:select-mask'})
        await route.emit("text-state", payload);
        await route.emit("brush-state", payload);
        await route.emit("drawing-state", payload);
    },
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
    "select-state": async (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.select.value = payload;
            if(!route.listener.isActive('listener:select-mask')) {
                await route.emit("listener:select-mask", {resume: true, id: 'listener:select-mask'})
            }
        } else {
            route.windowStates.select.value = payload.state;
            await route.emit("select:mask-shape", payload.shape);
        }
    },
    "cursor-state": async (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.cursor.value = payload;
            await route.emit("reset:window-states", false);
        }
    },
    "text-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.text.value = payload;
        }
    },
    "brush-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.brush.value = payload;
            console.log(payload, 'BRUSH STATE')
        }
    },
    "drawing-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.drawing.value = payload;
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
            if(payload?.mode) {
                route.localData.fullscreenData.mode = payload.mode
            } else {
                route.localData.fullscreenData.mode = 0
            }
            route.localData.fullscreenData.title = payload.title
            route.localData.fullscreenData.id = payload.id
            route.localData.fullscreenData.src = payload.src
            if(payload?.tile) {
                route.localData.fullscreenData.tile = payload.tile
                route.localData.fullscreenData.tileSrc = payload.tileSrc
                route.localData.fullscreenData.tileSize = payload.tileSize
            } else {
                route.localData.fullscreenData.tile = false
                route.localData.fullscreenData.tileSrc = ''
                route.localData.fullscreenData.tileSize = {x: 1, y: 1}
            }
            if(payload?.zoom) {
                route.localData.fullscreenData.zoom = payload.zoom
            }
            route.windowStates.fullscreen.value = true;
        }
    },
    "tile-state": async (payload) => {
        if (typeof payload === "boolean") {
            route.localData.fullscreenData.tile = payload;
        } else {
            route.localData.loading.value = true
            const data = route.emit('fullscreen-state', payload);
            if(data) {
                const response = await route.api.generateTileLayout(route.localData.fullscreenData);
                if(response) {
                    route.localData.fullscreenData.tileSrc = response.tileSrc;
                    route.localData.fullscreenData.id = response.id;
                    route.localData.loading.value = false
                }
            }
        }
    },
    "tools-state": (payload) => {
        route.emit('fullscreen-state', payload);
    },
    "context-menu-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.context.value = payload;
        }
    },
    "color-slot-state": (payload) => {
        route.windowStates.color.value = payload;
    },
});