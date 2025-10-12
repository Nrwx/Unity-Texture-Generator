export const settingEvent = (route) => ({
    "fetch-setting": async () => {
        route.localData.loading.value = true;
        const response = await route.api.fetchOsSettings();
        if (response) {
            route.osSettings.value = response;
            console.log(route.osSettings.value, 'SETTINGS')
            route.localData.loading.value = false
        }
    },
    "save-setting": async (payload) => {
        route.localData.loading.value = true;
        const response = await route.api.saveOsSettings(payload);
        if (response) {
            await route.emit("fetch-setting");
            route.windowStates.setting.value = false
        }
    },
})