export function loadingModel(props, emit) {

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    return {
        emitEvent,
    };
}

export const loadingProps = {
    electrons: {
        type: Number,
        default: 12,
    },
    text: {
        type: String,
        default: 'Bitte warten...',
    },
};