export const aiEvent = (route) => ({
    "image:generate": async (payload) => {
        try {
            const response = await route.api.generateImage(payload.msg, payload.model);
            console.log(response)
            if (!response) throw new Error("Kein Bild generiert");

            if (response) {
                await route.emit("fetch-layer");
            }

        } catch (error) {
            console.error("Fehler beim Bild-Generieren & Hochladen:", error.message);
        }
    }
});

