export function channelModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    return {
        emitEvent,
    };
}

export const channelProps = {
    data: {
        type: Array,
        required: true,
        default: () => [],
    }
};