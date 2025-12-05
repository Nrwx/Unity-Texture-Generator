import {computed, nextTick} from "vue";

export function channelModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const handleChannel = async (id) => {
        emitEvent('channel:mixer-target', id)
        await nextTick();
        emitEvent('channel:mixer-state', true)
    };

    const channelChecked = computed(() => {
        const checked = {};
        props.data.forEach(channel => {
            const key = channel.name.toLowerCase();
            checked[key] = props.settings[key] || false;
        });
        return checked;
    });
    // Toggle Funktion für Checkbox
    const toggleChannel = (channel) => {
        const key = channel.name.toLowerCase();
        const current = props.settings[key] || false;
        emitEvent("channel:toggle", {channel: key,
        state: !current, ids: props.settings.ids || null
    });
    };


    return {
        channelChecked,
        toggleChannel,
        handleChannel
    };
}

export const channelProps = {
    data: {
        type: Array,
        required: true
    },
    settings: {
        type: Object,
        required: true
    }
};
