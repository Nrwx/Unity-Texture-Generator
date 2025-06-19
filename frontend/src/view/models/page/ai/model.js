export function aiModel(emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    return {
        emitEvent,
    };
}

export const aiProps = {
};