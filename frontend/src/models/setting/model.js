export function settingModel(emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    return {
        emitEvent,
    };
}

export const settingProps = {
    state: {
        type: Boolean,
        default: false
    },
    settings: {
        type: Object,
        required: true,
        default: () => {},
    }
};