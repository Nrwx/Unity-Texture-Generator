import {matrixDefault} from "@/utils/matrix";

export const channelEvent = (route) => ({
    "renderer:channel": async () => {
        const response = await route.api.renderer({mode: 'channel'})
        if (response) {
            route.localData.channel.value = response
            console.log(response)
        }
    },
    "channel:mixer-state": async (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.mixer.value = payload;
            if (payload === false) route.emit('channel:mixer-reset')
        }
    },
    "channel:mixer-active": async (payload) => {
        if (typeof payload === "boolean") {
            route.mixerConfig.value.active = payload;
        }
    },
    "channel:mixer-target": async (payload) => {
        const target =  route.localData.channel.value.find(x => x.id === payload);
        if (target) {
            await route.emit('channel:mixer-base', target);
            route.mixerConfig.value.target = payload;
        }
    },
    "channel:mixer-base": async (payload) => {
        route.mixerConfig.value.base = [payload];
    },
    "channel:mixer-reset": async (payload) => {
        route.mixerConfig.value.matrix = matrixDefault();
        if(payload === true) {
            route.mixerConfig.value.background = 'checker';
            route.mixerConfig.value.active = false;
            route.mixerConfig.value.target = '';
            route.mixerConfig.value.base = [];
            route.mixerConfig.value.layers = [];
        }
    },
    "channel:mixer-add": async (payload) => {
        route.mixerConfig.value.layers.push(payload);
    },
    "channel:mixer-remove": async (payload) => {
        const item = route.mixerConfig.value.layers.find(x => x.id === payload);
        if (item) {
            const i = route.mixerConfig.value.layers.indexOf(item);
            if (i >= 0 && i < route.mixerConfig.value.layers.length) {
                route.mixerConfig.value.layers.splice(i, 1);
            }
        }
    },
    "channel:mixer-save": async (payload) => {
        console.log(payload)
    },
    "channel:mixer-update": async (payload) => {
        route.mixerConfig.value = {
            ...route.mixerConfig.value,
            ...payload
        };
        console.log(route.mixerConfig.value, 'THIS IS MIXER')
    }
});