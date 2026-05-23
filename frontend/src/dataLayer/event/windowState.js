export const windowStateEvent = (route) => ({
    "reset:window-states": async (payload) => {
        await route.emit("reset:modifiers", payload);
        await route.emit("select-state", payload);
        await route.emit("event:listener", {pause: true, id: 'listener:select-mask'})
        await route.emit("text-state", payload);
        await route.emit("event:listener", {pause: true, id: 'listener:text-create'})
        await route.emit("text-edit-state", payload);
        await route.emit("event:listener", {pause: true, id: 'listener:edit-text'})
        await route.emit("brush-state", payload);
        await route.emit("eraser-state", payload);
        await route.emit("event:listener", {pause: true, id: 'listener:brush'})
        await route.emit("pen-state", payload);
        await route.emit("event:listener", {pause: true, id: 'listener:pen'})
        await route.emit("drawing-state", payload);
        await route.emit("event:listener", {pause: true, id: 'listener:path'})
        await route.emit("path-drag-state", payload);
    },
    "reset:container-states": (payload) => {
        if (typeof payload === "boolean") {
            route.containerStates.rotate.value = payload;
            route.containerStates.translate.value = payload;
            route.containerStates.scale.value = payload;
            route.containerStates.select.value = payload;
        }
    },
    "grid:scale-state": (payload) => {
        if (typeof payload === "boolean") {
            route.containerStates.scale.value = payload;
        }
    },
    "grid:translate-state": (payload) => {
        if (typeof payload === "boolean") {
            route.containerStates.translate.value = payload;
        }
    },
    "grid:rotate-state": (payload) => {
        if (typeof payload === "boolean") {
            route.containerStates.rotate.value = payload;
        }
    },
    "grid:select-state": (payload) => {
        if (typeof payload === "boolean") {
            route.containerStates.select.value = payload;
        }
    },

    "reset:layer-states": (payload) => {
        if (typeof payload === "boolean") {
            route.layerStates.menu.value = payload;
            route.layerStates.rotate.value = payload;
            route.layerStates.translate.value = payload;
            route.layerStates.scale.value = payload;
            route.layerStates.align.value = payload;
        }
    },
    "layer:rotate": (payload) => {
        if (typeof payload === "boolean") {
            route.layerStates.rotate.value = payload;
        }
    },
    "layer:scale": (payload) => {
        if (typeof payload === "boolean") {
            route.layerStates.scale.value = payload;
        }
    },
    "layer:translate": (payload) => {
        if (typeof payload === "boolean") {
            route.layerStates.translate.value = payload;
        }
    },
    "layer:transform-menu": (payload) => {
        if (typeof payload === "boolean") {
            route.layerStates.menu.value = payload;
        }
    },
    "layer:transform-align": (payload) => {
        if (typeof payload === "boolean") {
            route.layerStates.align.value = payload;
        }
    },
    "layer:transform-direction": (payload) => {
        if (typeof payload === "boolean") {
            route.layerStates.direction.value = payload;
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
        route.loadingStates.viewport.value = true;
        if (typeof payload === "boolean") {
            route.windowStates.viewport.value = payload;
            if (payload) route.loadingStates.viewport.value = false;
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
    "select-state:items": async (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.selectItems.value = payload;
        }
    },
    "cursor-state": async (payload) => {
        if (typeof payload === "boolean") {
            await route.emit("reset:window-states", !payload);
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
    "text-edit-state": async (payload) => {
        if (typeof payload === "boolean") {
            if(!payload) {
                await route.emit('edit-text-layer', null);
                await route.emit("event:listener", {pause: true, id: 'listener:edit-text'})
            }
            route.windowStates.textEdit.value = payload;
            await route.emit("rule:allow-form", payload);
            if (!route.listener.isActive('listener:edit-text')) {
                await route.emit("event:listener", {resume: true, id: 'listener:edit-text'})
            }
        }
    },

    "brush-state": async (payload) => {
        if (typeof payload === "boolean") {
            await route.emit("rule:allow-form", payload);
            if(!route.tempData.brushLayer.value) {
                if(route.localData.selectedLayer.value.length) {
                    await route.emit("layer:select", [route.localData.selectedLayer.value[route.localData.selectedLayer.value.length - 1]]);
                } else if(route.localData.layers.value.length) {
                    await route.emit("layer:select", [route.localData.layers.value[route.localData.layers.value.length - 1]]);
                }
            }
            route.windowStates.brush.value = payload;
            if (!route.listener.isActive('listener:brush')) {
                await route.emit("event:listener", {resume: true, id: 'listener:brush'})
            }
        }
    },
    "eraser-state": async (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.eraser.value = payload;
            await route.emit("brush-state", payload);
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
        } else {
            const layer = route.localData.layers.value.find(x => x.id === payload.id);
            route.contextConfig.contextData.value = route.contextConfig.contextData.value.map(group => {
                if (group.action === 'edit' && Array.isArray(group?.children)) {
                    return {
                        ...group,
                        children: group?.children.map(child => {
                            if (child.action === 'text-path') {
                                return {
                                    ...child,
                                    active: layer?.type === 1
                                };
                            }
                            return child;
                        })
                    };
                }
                return group;
            });
            route.windowStates.context.value = payload.state;
        }
    },
    "color-slot-state": (payload) => {
        route.windowStates.color.value = payload;
    },
    "select-form-state": async (payload) => {
        route.windowStates.form.value = payload;
        await route.emit('path:reset', false)
    },
    "path-drag-state": async (payload) => {
        route.windowStates.pathDrag.value = payload;
        if (!route.listener.isActive('listener:path')) {
            await route.emit("event:listener", {resume: true, id: 'listener:path'})
        } else {
            await route.emit("event:listener", {pause: true, id: 'listener:path'})
        }
    },
    "export-state": async (payload) => {
        console.log(payload)
        route.windowStates.export.value = payload;
        route.localData.loading.value = true
        const response = await route.api.renderer({mode: 'preview'});
        if (response) {
            route.previewData.value.mode = 0
            route.previewData.value.title = response.title
            route.previewData.value.id = response.id
            route.previewData.value.src =  response.src
            route.localData.loading.value = false;
        }
    },
    "timeline:state": async (payload) => {
        route.windowStates.timeline.value = payload;
        if (!payload && route.timelineStates.play.value) {
            await route.emit("mini-timeline:state", true);
            await route.emit("timeline:play", false);
        } else {
            await route.emit("timeline:play", false);
            await route.emit("mini-timeline:state", false);
        }
    },
    "mini-timeline:state": async (payload) => {
        route.windowStates.miniTimeline.value = payload;
    },
    "modifier-resize:state": async (payload) => {
        route.modifierStates.resize.value = payload;
    },
    "modifier-color:state": async (payload) => {
        route.modifierStates.color.value = payload;
        if(!payload){
            route.tempData.activeLayer.value = null;
            route.tempData.preview.value.src = "";
            route.tempData.preview.value.counter = 0;
            route.loadingStates.modifierColor.value = false;
        }
    },
    "modifier-details:state": async (payload) => {
        route.modifierStates.details.value = payload;
        if(!payload){
            route.tempData.activeLayer.value = null;
            route.tempData.preview.value.src = "";
            route.tempData.preview.value.counter = 0;
            route.loadingStates.modifierDetails.value = false;
        }
    },
    "modifier-effects:state": async (payload) => {
        route.modifierStates.effects.value = payload;
        if(!payload){
            route.tempData.activeLayer.value = null;
            route.tempData.preview.value.src = "";
            route.tempData.preview.value.counter = 0;
            route.loadingStates.modifierEffects.value = false;
        }
    },
    "modifier-distort:state": async (payload) => {
        route.modifierStates.distort.value = payload;
        if(!payload){
            route.tempData.activeLayer.value = null;
            route.tempData.preview.value.src = "";
            route.tempData.preview.value.counter = 0;
            route.loadingStates.modifierDistort.value = false;
        }
    },
});