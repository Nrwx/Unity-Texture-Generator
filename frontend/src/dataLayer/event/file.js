export const fileEvent = (route) => ({
    "apply-file": (payload) => {
        route.localData.file.value = payload;
    },
    "upload-file": async () => {
        const response = await route.api.fileUpload(route.localData.file.value);
        if (response) {
            const build = route.emit("generate-upload-build", response)
            if(build) await route.emit("fetch-layer");
        }
    },
    "download-file": (payload) => {
        const link = document.createElement("a");
        link.href = payload;
        link.download = payload.split("/").pop();
        link.click();
    },
    "generate-upload-build": (payload) => {
        route.localData.builds.value.push(payload);
    },
    "import-build": async (payload) => {
        const build = {
            name: payload.title,
            type: 0,
            id: payload.id,
            width: payload.width,
            height: payload.height,
        }
        const response = await route.api.addLayer(build);
        if (response) {
            await route.emit("fetch-layer");
        }
    },
})

export const fileSettingEvent = (route) => ({
    "update-dimension": (payload) => {
        route.localData.dimension.value = payload
        console.log(payload, '@EVENT: UPDATE-DIMENSION')
    },
    "apply-maps": (payload) => {
        route.localData.selectedMaps.value = payload;
    },
    "apply-target-size": (payload) => {
        route.localData.selectedTargetResize.value = payload;
        route.settings.resize_index = payload;
    },
    "apply-target-size-option": (payload) => {
        route.localData.selectedTargetResizeOption.value = payload;
        route.settings.resize_mode = payload;
    },
    "apply-target-size-method": (payload) => {
        route.localData.selectedUpscaleMethod.value = payload
        route.settings.upscale_method = payload
    },
    "apply-rgb-mode": (payload) => {
        route.localData.selectedRgb.value = payload
        route.settings.rgb_mode = payload
    },
    "apply-rgba-mode": (payload) => {
        route.localData.selectedRgba.value = payload
        route.settings.rgba_mode = payload
    },
})