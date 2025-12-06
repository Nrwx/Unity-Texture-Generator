import {matrixDefault} from "@/utils/matrix";
import {nextTick} from "vue";

export const channelEvent = (route) => ({
    "channel:fetch": async (payload) => {
        try {
            const response = await route.api.fetchChannel({ ids: payload });
            if (response) {
                route.localData.channel.value = response;

                // Channel-Settings abrufen
                const settings = await route.api.channelSettings({ ids: payload });
                if (settings) route.localData.channelSettings.value = settings;
                if (payload?.length) {
                    const selectedLayers = [];
                    selectedLayers.push(
                        ...route.localData.layers.value.filter(layer => payload.includes(layer.id))
                    );
                    await route.emit('layer:select', selectedLayers);
                }
            }
        } catch (error) {
            console.error("Fehler beim Abrufen der Channels:", error);
        }
    },
    "channel:update": async (payload) => {
        await route.emit('fetch-layer');
        await nextTick();

        const selectedLayers = [];
        if (payload?.length) {
            selectedLayers.push(
                ...route.localData.layers.value.filter(layer => payload.includes(layer.id))
            );
        }
        if (selectedLayers.length){
            selectedLayers.forEach(layer => {
                route.emit('update-layer', {id: layer.id, width: layer.width, height: layer.height, channel: layer.channel, matrix: layer.matrix})
            })
        } else {
            route.localData.layers.value.forEach(layer => {
                route.emit('update-layer', {id: layer.id,  width: layer.width, height: layer.height, channel: layer.channel, matrix: layer.matrix})
            })
        }
        await nextTick();
        await route.emit('layer:select', selectedLayers);
    },
    "channel:create": async (payload) => {
        try {
            const response = await route.api.createChannel(payload);
            if (response?.id) {
                await route.emit('channel:fetch', payload.ids || []);
            }
        } catch (error) {
            console.error("Fehler beim Erstellen des Channels:", error);
        }
    },

    "channel:activate": async (payload) => {
        try {
            const response = await route.api.activateChannel(payload);
            if (response) {
                await route.emit('channel:fetch', payload.ids || []);
                route.localData.selectedChannel.value = route.localData.channel.value.find(c => c.id === payload.id);
            }
        } catch (error) {
            console.error("Fehler beim Aktivieren des Channels:", error);
        }
    },

    "channel:delete": async (payload) => {
        try {
            const response = await route.api.deleteChannel(payload);
            if (response) {
                await route.emit('channel:fetch', payload.ids || []);
                if (route.localData.selectedChannel.value?.id === payload.id) {
                    route.localData.selectedChannel.value = null;
                }
            }
        } catch (error) {
            console.error("Fehler beim Löschen des Channels:", error);
        }
    },

    "channel:selected": async (payload) => {
        route.localData.selectedChannel.value = payload;
        console.log(route.localData.selectedChannel.value)
    },
    "channel:toggle": async (payload) => {
        const response = await route.api.toggleChannel(payload)
        console.log(payload);
        if (response) {
            await route.emit("channel:fetch", payload.ids);
            await nextTick();
            await route.emit("channel:update", payload.ids);
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