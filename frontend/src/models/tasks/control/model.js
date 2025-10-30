import {computed} from "vue";

export function taskControlModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    const progressMeta = computed(() => {
        return `${(props.meta?.tasks_progress_avg || 0).toFixed(1)}% overall`;
    });
    return {
        progressMeta,
        emitEvent
    };
}

export const taskControlProps = {
    theme: {
        type: String,
        required: true,
    },
    meta: {
        type: Object,
        default: () => ({})
    }
};