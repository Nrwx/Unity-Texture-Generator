export const rendererEvent = (route) => ({
    "renderer:text-to-path": async (id, write = false) => {
        route.localData.loading.value = true;

        try {
            const response = await route.api.renderer('text-path', id, write);
            if (response?.data) {
                console.log("✔️ Rendered Path:", response.data);
            }
        } catch (err) {
            console.error("⚠️ Fehler beim Rendern:", err);
        } finally {
            route.localData.loading.value = false;
        }
    }
});