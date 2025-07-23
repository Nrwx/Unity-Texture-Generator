export const windowStateEvent = (route) => ({
    "reset:window-states": async (payload) => {
        await route.emit("reset:modifiers", payload);
        await route.emit("select-state", payload);
        await route.emit("event:listener", {pause: true, id: 'listener:select-mask'})
        await route.emit("text-state", payload);
        await route.emit("event:listener", {pause: true, id: 'listener:text-create'})
        await route.emit("brush-state", payload);
        await route.emit("event:listener", {pause: true, id: 'listener:brush'})
        await route.emit("pen-state", payload);
        await route.emit("event:listener", {pause: true, id: 'listener:pen'})
        await route.emit("drawing-state", payload);
    },
    "reset:grid-states": (payload) => {
        if (typeof payload === "boolean") {
            route.transformStates.menu.value = payload;
            route.transformStates.rotate.value = payload;
            route.transformStates.transform.value = payload;
            route.transformStates.size.value = payload;
            route.transformStates.align.value = payload;
        }
    },
    "reset:canvas-states": (payload) => {
        if (typeof payload === "boolean") {
            route.canvasStates.zoom.value = payload;
            route.canvasStates.rotate.value = payload;
            route.canvasStates.transform.value = payload;
            route.canvasStates.size.value = payload;
            route.canvasStates.select.value = payload;
        }
    },
    "canvas:zoom-state": (payload) => {
        if (typeof payload === "boolean") {
            route.canvasStates.zoom.value = payload;
        }
    },
    "canvas:transform-state": (payload) => {
        if (typeof payload === "boolean") {
            route.canvasStates.transform.value = payload;
        }
    },
    "canvas:rotate-state": (payload) => {
        if (typeof payload === "boolean") {
            route.canvasStates.rotate.value = payload;
        }
    },
    "canvas:select-state": (payload) => {
        if (typeof payload === "boolean") {
            route.canvasStates.select.value = payload;
        }
    },
    "layer:transform-rotate": (payload) => {
        if (typeof payload === "boolean") {
            route.transformStates.rotate.value = payload;
        }
    },
    "layer:transform-size": (payload) => {
        if (typeof payload === "boolean") {
            route.transformStates.size.value = payload;
        }
    },
    "layer:transform-state": (payload) => {
        if (typeof payload === "boolean") {
            route.transformStates.transform.value = payload;
        }
    },
    "layer:transform-menu": (payload) => {
        if (typeof payload === "boolean") {
            route.transformStates.menu.value = payload;
        }
    },
    "layer:transform-align": (payload) => {
        if (typeof payload === "boolean") {
            route.transformStates.align.value = payload;
        }
    },
    "rule:allow-form": (payload) => {
        if (typeof payload === "boolean") {
            route.ruleStates.form.value = payload;
        }
    },
    "notify-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.notify.value = payload;
            console.log(payload)
        }
    },
    "viewport-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.viewport.value = payload;
        }
    },
    "drawer-center-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.drawerCenter.value = payload;
        }
    },
    "dialog-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.dialog.value = payload;
        }
    },
    "layer-state": async (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.layer.value = payload;
            await route.emit("layer:select", []);
            if(payload) {
                if(!route.listener.isActive('listener:drag')) {
                    await route.emit("event:listener", {resume: true, id: 'listener:drag'})
                }
            } else {
                await route.emit("event:listener", {pause: true, id: 'listener:drag'})
            }
        }
    },
    "select-state": async (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.select.value = payload;
            if(!route.listener.isActive('listener:select-mask')) {
                await route.emit("event:listener", {resume: true, id: 'listener:select-mask'})
            }
        } else {
            route.windowStates.select.value = payload.state;
            await route.emit("select:mask-shape", payload.shape);
        }
    },
    "cursor-state": async (payload) => {
        if (typeof payload === "boolean") {
            await route.emit("reset:window-states", false);
            route.windowStates.cursor.value = payload;
        }
    },
    "pen-state": async (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.pen.value = payload;
            await route.emit("rule:allow-form", payload);
            if(!route.listener.isActive('listener:pen')) {
                await route.emit("event:listener", {resume: true, id: 'listener:pen'})
            }
        }
    },
    "pen:path-state": async (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.path.value = payload;
        }
    },
    "text-state": async (payload) => {
        if (typeof payload === "boolean") {
            await route.emit("rule:allow-form", payload);
            route.windowStates.text.value = payload;
            if (!route.listener.isActive('listener:text-create')) {
                await route.emit("event:listener", {resume: true, id: 'listener:text-create'})
            }
        }
    },
    "brush-state": async (payload) => {
        if (typeof payload === "boolean") {
            await route.emit("rule:allow-form", payload);
            route.windowStates.brush.value = payload;
            if (!route.listener.isActive('listener:brush')) {
                await route.emit("event:listener", {resume: true, id: 'listener:brush'})
            }
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
    "context-menu-state": async (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.context.value = payload;
        }
    },
    "color-slot-state": (payload) => {
        route.windowStates.color.value = payload;
    },
});