import {nextTick} from "vue";

export function channelModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const handleChannel = async (id) => {
        emitEvent('channel:mixer-target', id)
        await nextTick();
        emitEvent('channel:mixer-state', true)
    };

    // Toggle Funktion für Checkbox
    const toggleChannel = (channel) => {
        emitEvent("channel:toggle", {
            channel: channel.key,
            state: !props.settings[channel.key],
            ids: props.settings.ids || null
        });
    };

    const toggleChannelSelection = (channel) => {
        let data = props.selectedChannel || [];
        const index = data.findIndex(c => c.id === channel.id);

        if (index === -1) {
            data.push(channel);
            emitEvent('channel:selected', data);
        } else {
            data.splice(index, 1);
            emitEvent('channel:selected', data);
        }
    };

    return {
        toggleChannelSelection,
        toggleChannel,
        handleChannel
    };
}

export const channelProps = {
    data: {
        type: Array,
        required: true
    },
    selectedChannel: {
        type: Array,
        required: true
    },
    settings: {
        type: Object,
        required: true
    }
};
