import {ref} from "vue";

export function settingModel(emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    const config = ref({
        maxWidth: 500,
        title: 'Systemeinstellungen',
        emit: 'setting-state'
    });
    return {
        config,
        emitEvent,
    };
}

export const settingProps = {
    state: {
        type: Boolean,
        default: false
    },
    loading: {
        type: Boolean,
        default: true
    },
    settings: {
        type: Object,
        required: true,
        default: () => {},
    },
    theme: {
        type: String,
        required: true
    },
};