export const modifierEvent = (route) => ({
    "reset:modifiers": async (payload) => {
        await route.emit("fill-color-state", payload);
    },
    "fill-color-state": async (payload) => {
        route.modifierStates.fill.value = payload
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
})