export function formModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    const selectUpdate = (config, payload) => {
        if (config.return) {
            emitEvent(config.event, payload); // val ist ganzes Objekt
        } else {
            emitEvent(config.event, payload?.value || payload); // val ist value oder fallback
        }
    };
    return {
        emitEvent,
        selectUpdate
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