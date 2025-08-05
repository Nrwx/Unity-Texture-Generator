export const rendererEvent = (route) => ({
    "renderer:preview": async () => {
        route.localData.loading.value = true;
        try {
            route.windowStates.fullscreen.value = true;
            const response = await route.api.renderer({mode: 'preview'});
            if (response) {
                const payload = {
                    title: response.title,
                    id: response.id,
                    src: response.src,
                }
                const data = route.emit('fullscreen-state', payload)
                if(data) {
                    route.localData.loading.value = false;
                }
            }
        } catch (err) {
            console.error("⚠️ Fehler beim Rendern:", err);
        } finally {
            route.localData.loading.value = false;
        }
    },
    "renderer:text-to-path": async (payload) => {
        route.localData.loading.value = true;
        try {
            const response = await route.api.renderer(payload);
            if (response) {
                await route.emit('fetch-layer')
                console.log("✔️ Rendered Path:", response.message);
            }
        } catch (err) {
            console.error("⚠️ Fehler beim Rendern:", err);
        } finally {
            route.localData.loading.value = false;
        }
    }
});