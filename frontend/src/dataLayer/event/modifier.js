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
    "select:mask-shape": async (payload) => {
        route.localData.selectedShape.value = payload
        console.log(route.localData.selectedShape.value)
    },
    "pen:bezier-mode": async (payload) => {
        route.localData.bezier.value = payload
        console.log(route.localData.bezier.value)
    },
})