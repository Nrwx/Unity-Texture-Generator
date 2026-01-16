export const shaderEvent = (route) => ({
    "fetch-shader": async () => {
        route.localData.loading.value = true;
        const response = await route.api.fetchShader();
        if (response) {
            route.localData.shader.value = response
            console.log(route.localData.shader.value, 'THIS IS SHADER')
            route.localData.loading.value = false
        }
    }
})