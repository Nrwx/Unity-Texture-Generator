export const cursorEvent = (route) => ({
    "generate:cursor": async (payload) => {
        route.localData.loading.value = true;
        const response = await route.api.createCursor(payload);
        if (response) {
            route.localData.cursor.value = response
            console.log(route.localData.cursor.value, 'THIS IS CURSOR')
            route.localData.loading.value = false
        }
    }
})