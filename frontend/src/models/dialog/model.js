export function dialogModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    return {
        emitEvent,
    };
}

export const dialogProps = {
    state: {
        type: Boolean,
        required: true,
    },
    loading: {
        type: Boolean,
        required: true,
    },
    data: {
        type: Object,
        required: true,
        default: () => {},
    },
    theme: {
        type: String,
        required: true,
    },
};