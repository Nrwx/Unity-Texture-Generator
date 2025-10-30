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

    return {
        handleChannel
    };
}

export const channelProps = {
    data: {
        type: Array,
        required: true
    }
};
