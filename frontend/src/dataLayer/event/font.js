export const fontsEvent = (route) => ({
    "fetch-fonts": async () => {
        route.localData.loading.value = true;
        const response = await route.api.fetchFont();
        if (response) {
            route.localData.fonts.value = response
            console.log(route.localData.fonts.value, 'THIS IS FONTS')
            route.localData.loading.value = false
        }
    }
})