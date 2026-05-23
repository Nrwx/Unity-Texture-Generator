export const modifierEvent = (route) => ({
    "reset:modifiers": async (payload) => {
        await route.emit("fill-color-state", payload);
        await route.emit("event:listener", {pause: true, id: 'listener:image'})
    },
    "fill-color-state": async (payload) => {
        route.modifierStates.fill.value = payload
        if (!route.listener.isActive('listener:text-create')) {
            await route.emit("event:listener", {resume: true, id: 'listener:image'})
        }
    },
    "fill-color-modifier": async (payload) => {
        const data = {id: payload.id, x: payload.x, y: payload.y, color: payload.color}
        const response = await route.api.fillModifier(data);
        if (response) {
            await route.emit("fetch-layer");
        }
    },
    "modifier:image-applied": async (payload) => {
        const response = await route.api.resizeModifier(payload);
        if (response) {
            route.tempData.activeLayer.value = null;
            route.localData.selectItemsBox.value = null;
            route.localData.selectMaskBox.value = null;
            await route.emit('modifier-resize:state', false);
            await route.emit("fetch-layer");
        }
    },
    "modifier:color-preview": async (payload) => {
        route.loadingStates.modifierColorPreview.value = true;
        route.tempData.preview.value.counter = payload.requestId;
        const response = await route.api.colorPreview(payload);
        if (
            response?.src &&
            route.tempData.preview.value.counter === payload.requestId
        ) {
            await route.emit("modifier:color-preview-src", {
                requestId: payload.requestId,
                id: response.id,
                title: response.title,
                src: response.src
            });
        }
    },

    "modifier:details-preview": async (payload) => {
        route.loadingStates.modifierDetailsPreview.value = true;
        route.tempData.preview.value.counter = payload.requestId;
        const response = await route.api.detailsPreview(payload);
        if (
            response?.src &&
            route.tempData.preview.value.counter === payload.requestId
        ) {
            await route.emit("modifier:details-preview-src", {
                requestId: payload.requestId,
                id: response.id,
                title: response.title,
                src: response.src,
            });
        }
    },

    "modifier:effects-preview": async (payload) => {
        route.loadingStates.modifierEffectsPreview.value = true;
        route.tempData.preview.value.counter = payload.requestId;
        const response = await route.api.effectsPreview(payload);

        if (
            response?.src &&
            route.tempData.preview.value.counter === payload.requestId
        ) {
            await route.emit("modifier:effects-preview-src", {
                requestId: payload.requestId,
                id: response.id,
                title: response.title,
                src: response.src,
            });
        }
    },

    "modifier:color-applied": async (payload) => {
        route.loadingStates.modifierColor.value = true;
        const response = await route.api.colorModifier(payload);

        if (response) {
            route.tempData.activeLayer.value = null;
            route.localData.selectItemsBox.value = null;
            route.localData.selectMaskBox.value = null;
            route.tempData.preview.value.src = "";
            route.tempData.preview.value.counter = 0;
            route.loadingStates.modifierColor.value = false;

            await route.emit("modifier-color:state", false);
            await route.emit("fetch-layer");
        }
    },

    "modifier:details-applied": async (payload) => {
        route.loadingStates.modifierDetails.value = true;
        const response = await route.api.detailsModifier(payload);

        if (response) {
            route.tempData.activeLayer.value = null;
            route.tempData.preview.value.src = "";
            route.tempData.preview.value.counter = 0;
            route.loadingStates.modifierDetails.value = false;

            await route.emit("modifier-details:state", false);
            await route.emit("fetch-layer");
        }
    },

    "modifier:effects-applied": async (payload) => {
        route.loadingStates.modifierEffects.value = true;
        const response = await route.api.effectsModifier(payload);

        if (response) {
            route.tempData.activeLayer.value = null;
            route.tempData.preview.value.src = "";
            route.tempData.preview.value.counter = 0;
            route.loadingStates.modifierEffects.value = false;

            await route.emit("modifier-effects:state", false);
            await route.emit("fetch-layer");
        }
    },

    "modifier:details-preview-src": async (payload) => {
        route.tempData.preview.value = payload;
        route.loadingStates.modifierDetailsPreview.value = false;
    },

    "modifier:color-preview-src": async (payload) => {
        route.tempData.preview.value = payload;
        route.loadingStates.modifierColorPreview.value = false;
    },

    "modifier:effects-preview-src": async (payload) => {
        route.tempData.preview.value.src = payload.src;
        route.loadingStates.modifierEffectsPreview.value = false;
    },

    "select:mask-shape": async (payload) => {
        route.localData.selectedShape.value = payload
    },
    "update:select-items-box": async (payload) => {
        route.localData.selectItemsBox.value = payload
    },
    "update:select-mask-box": async (payload) => {
        route.localData.selectMaskBox.value = payload
    },
    "pen:bezier-mode": async (payload) => {
        route.localData.bezier.value = payload
        console.log(route.localData.bezier.value)
    },
})