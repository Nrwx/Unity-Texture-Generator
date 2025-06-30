export const layerEvent = (route) => ({
    "fetch-layer": async () => {
        const response = await route.api.fetchLayers()
        if (response) {
            route.localData.layers.value = response;
        }
    },
    "add-layer": async () => {
        const data = {
            name: `Layer ${route.localData.layers.value.length + 1}`,
            type: 0,
            width: route.localData.viewport.value.width,
            height: route.localData.viewport.value.height
        }
        const response = await route.api.addLayer(data);
        if (response) {
            await route.emit("fetch-layer");
            await route.emit("backup:fetch-list");
        }
    },
    "update-layer": async (payload) => {
        const response = await route.api.updateLayer(payload)
        if (response) {
            await route.emit("fetch-layer");
        }
    },
    "delete-layer": async (payload) => {
        const response = await route.api.deleteLayer(payload);
        if (response) {
            await route.emit("layer:select", [])
            await route.emit("fetch-layer");
        }
    },
    "paste-layer": async (payload) => {
        const response = await route.api.pasteLayer(payload);
        if (response) {
            await route.emit("fetch-layer");
        }
    },
    "preview-layer": async () => {
        route.localData.loading.value = true
        route.windowStates.fullscreen.value = true;
        const response = await route.api.previewLayers();
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
    },
});

export const layerModifierEvent = (route) => ({
    "layer-blend-mode": async (payload) => {
        const data = {id: payload.id, blend_mode: payload.blend_mode, color: route.localData.color.value}
        console.log(data)
        const response = await route.api.blendLayer(data);
        if (response) {
            await route.emit("fetch-layer");
        }
    },
    "hide-layer": async (payload) => {
        const data = {id: payload.id, hidden: payload.hidden === 0 ? 1 : 0}
        const response = await route.api.hideLayer(data);
        if (response) {
            await route.emit("fetch-layer");
        }
    },
    "order-layer": async (payload) => {
        const data = {id: payload.id, order: payload.order}
        const response = await route.api.orderLayers(data);
        if (response) {
            await route.emit("fetch-layer");
        }
    },
    "mask-layer": async (payload) => {
        const { id, id2 } = payload;

        if (!id || !id2) {
            console.warn("mask-layer: Ungültiger Payload", payload);
            return;
        }
        const response = await route.api.maskLayer(id, id2);
        if (response) {
            const res = await route.api.maskedLayer(response?.id, response?.id2);
            if(res) {
                await route.emit("fetch-layer");
            }
        }
    },
});

export const selectLayerEvent = (route) => ({
    "layer:select": async (payload) => {
        route.localData.selectedLayer.value = payload
        console.log(payload)
    },
});

export const textLayerEvent = (route) => ({
    "add-text-layer": async (payload) => {
        const response = await route.api.addTextLayer(payload);
        if (response) {
            await route.emit("fetch-layer");
        }
    },
});

export const textModifierEvent = (route) => ({
    "apply-font-size": (payload) => {
        route.textLayer.value.fontSize = payload;
    },
    "apply-font-family": (payload) => {
        route.textLayer.value.fontFamily = payload.value;
        route.textLayer.value.font = payload.id
    },
    "apply-font-weight": (payload) => {
        route.textLayer.value.fontWeight = payload;
    },
    "apply-font-text-align": (payload) => {
        route.textLayer.value.textAlign = payload;
    },
    "apply-font-line-height": (payload) => {
        route.textLayer.value.lineHeight = payload;
    },
    "apply-font-letter-spacing": (payload) => {
        route.textLayer.value.letterSpacing = payload;
    },
    "apply-font-text-transform": (payload) => {
        route.textLayer.value.textTransform = payload;
    },
    "apply-font-text-decoration": (payload) => {
        route.textLayer.value.textDecoration = payload;
    },
    "apply-font-color": (payload) => {
        route.textLayer.value.color = payload;
    },
});