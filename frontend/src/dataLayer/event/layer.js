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
        }
    },
    "update-layer": async (payload) => {
        const response = await route.api.updateLayer(payload)
        if (response) {
            await route.emit("fetch-layer");
        }
    },
    "reset-selected-layer": () => {
        route.localData.selectedLayers.value = [];
    },
    "delete-layer": async (payload) => {
        const response = await route.api.deleteLayer(payload);
        if (response) {
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
            route.fullscreenInfo.title = response.title;
            route.fullscreenInfo.id = response.id;
            route.fullscreenInfo.src = response.src;
            route.localData.loading.value = false;
        }
    },
});

export const layerModifierEvent = (route) => ({
    "layer-blend-mode": async (payload) => {
        const data = {id: payload.id, blend_mode: payload.blend_mode, color: '#ffffff'}
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
        route.textLayer.value.fontFamily = payload;
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