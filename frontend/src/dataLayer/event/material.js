export const materialEvent = (route) => ({
    "material:preview": async (payload) => {
        route.loadingStates.materialPreview.value = true;
        route.tempData.preview.value.counter = payload.requestId;
        const response = await route.api.materialPreview(payload);

        if (
            response?.layer &&
            route.tempData.preview.value.counter === payload.requestId
        ) {
            await route.emit("material:preview-data", {
                requestId: payload.requestId,
                id: response.id,
                layer: response.layer,
                package: response.package,
            });
        }
    },

    "material:preview-data": async (payload) => {
        route.tempData.materialPreview.value = {
            ...payload.layer,
            material_preview_request_id: payload.requestId,
            time: payload.layer?.time || Date.now(),
        };
        route.loadingStates.materialPreview.value = false;
    },

    "material:create-cube": async (payload) => {
        route.loadingStates.material.value = true;
        const response = await route.api.createMaterialCube(payload);

        if (response) {
            route.tempData.activeLayer.value = null;
            route.tempData.materialPreview.value = null;
            route.loadingStates.material.value = false;

            await route.emit("material-editor:state", false);
            await route.emit("fetch-layer");
        }
    },

    "material:update": async (payload) => {
        route.loadingStates.material.value = true;
        const response = await route.api.updateMaterial(payload);

        if (response) {
            route.tempData.materialPreview.value = null;
            route.loadingStates.material.value = false;

            await route.emit("material-editor:state", false);
            await route.emit("fetch-layer");
        }
    },
})
