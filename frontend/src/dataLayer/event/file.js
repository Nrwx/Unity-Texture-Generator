export const fileEvent = (route) => ({
    "apply-file": (payload) => {
        route.localData.file.value = payload;
    },
    "upload-file": async () => {
        const response = await route.api.fileUpload(route.localData.file.value);
        if (response) {
            route.localData.queueCompleteTimer.value = setTimeout(async () => {
                const finish = {
                    title: 'Fertig',
                    subTitle: 'alle cron-jobs erledigt.',
                    percent: 100,
                    indeterminate: false,
                    method: 'FINISH',
                    path: '/finish',
                    complete: true,
                };
                await route.emit('app:update-queue', finish);
            }, 150);
            route.localData.queuePollTimer.value = setTimeout(async () => {
                const reset = {
                    title: '',
                    subTitle: '',
                    percent: 0,
                    time: '',
                    indeterminate: false,
                    complete: false
                };
                await route.emit('app:update-queue', reset);
                const payload = {state: false};
                route.windowStates.queue.value = payload.state;
                route.localData.queueCompleteTimer.value = null;
                route.localData.queuePending.value = null;
            }, 300);
            route.emit("generate-upload-build", response)
            await route.emit("fetch-layer");
            await route.emit("backup:fetch-list");
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