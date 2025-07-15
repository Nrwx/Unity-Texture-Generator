import {ref} from "vue";

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

    const showIconMenu = ref(false);

    const openIconMenu = () => {
        showIconMenu.value = true;
    };

    const closeIconMenu = () => {
        showIconMenu.value = false;
    };
    return {
        showIconMenu,
        openIconMenu,
        closeIconMenu,
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