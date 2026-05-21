export const modifierEvent = (route) => ({
    "reset:modifiers": async (payload) => {
        await route.emit("fill-color-state", payload);
        await route.emit("event:listener", {pause: true, id: 'listener:image'})
    },
    "fill-color-state": async (payload) => {
        route.modifierStates.fill.value = payload
        if (!route.listener.isActive('listener:text-create')) {
            await route.emit("event:listener", {resume: true, id: 'listener:image'})
        }
    },
    "fill-color-modifier": async (payload) => {
        const data = {id: payload.id, x: payload.x, y: payload.y, color: payload.color}
        const response = await route.api.fillModifier(data);
        if (response) {
            await route.emit("fetch-layer");
        }
    },
    "modifier:image-applied": async (payload) => {
        const response = await route.api.resizeModifier(payload);
        if (response) {
            route.tempData.activeLayer.value = null;
            route.localData.selectItemsBox.value = null;
            route.localData.selectMaskBox.value = null;
            await route.emit('modifier-resize:state', false);
            await route.emit("fetch-layer");
        }
    },
    "select:mask-shape": async (payload) => {
        route.localData.selectedShape.value = payload
    },
    "update:select-items-box": async (payload) => {
        route.localData.selectItemsBox.value = payload
    },
    "update:select-mask-box": async (payload) => {
        route.localData.selectMaskBox.value = payload
    },
    "pen:bezier-mode": async (payload) => {
        route.localData.bezier.value = payload
        console.log(route.localData.bezier.value)
    },
})