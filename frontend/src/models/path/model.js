import {onMounted, onBeforeUnmount} from "vue";

export function pathModel(props, emit) {

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const add = (path) => {
        emitEvent('update:path-layer', path);
        emitEvent('path:lock', true);
        emitEvent('path:edit', false)
        emitEvent('pen-state', true)
        emitEvent('path:import', true)
    };

    onMounted(async () => {
    });

    onBeforeUnmount(() => {
    });

    return {
        add,
        emitEvent
    };
}

export const pathProps = {
    data: {
        type: Array,
        required: true,
    },
};
