export function formModel(emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    return {
        emitEvent
    };
}

export const formProps = {
    operation: {
        type: Object,
        required: true,
        default: () => {},
    },
    item: {
        type: Object,
        required: true,
        default: () => {},
    },
};