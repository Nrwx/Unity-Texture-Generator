export const settingEvent = (route) => ({
    "fetch-setting": async () => {
        route.localData.loading.value = true;
        const response = await route.api.fetchOsSettings();
        if (response) {
            Object.assign(route.osSettings, response)
            route.localData.loading.value = false
        }
    },
    "save-setting": async () => {
        route.localData.loading.value = true;
        const response = await route.api.saveOsSettings();
        if (response) {
            await route.emit("fetch-setting");
            route.windowStates.setting.value = false
        }
    },
})