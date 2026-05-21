export const cursorEvent = (route) => ({
    "generate:cursor": async (payload) => {
        route.localData.loading.value = true;
        const response = await route.api.createCursor(payload);
        if (response) {
            route.localData.cursor.value = response.cursor
            route.localData.cursorVector.value = response.vector;
            route.localData.loading.value = false
        }
    }
})