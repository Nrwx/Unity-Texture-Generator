export function formModel(props, emit) {

    const emitSubEvent = (event, payload) => {
        emit("update:sub-component-event", event, payload);
    };

    const selectForm = (path) => {
        emitSubEvent("pen-state", false);
        emitSubEvent('path-drag-state', true);
        emitSubEvent('select:path-layer', path);
        emitSubEvent('select-form-state', false);
    };

    return {
        emitSubEvent,
        selectForm
    };
}

export const formProps = {
};