import {computed} from "vue";

export function taskSummaryModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const trendText = computed(() => {
        return `Avg ${((props.meta.tasks_progress_avg || 0).toFixed(1))}% • Last ${props.meta.tasks_last_updated ? new Date(props.meta.tasks_last_updated).toLocaleString() : '—'}`;
    });

    return {
        trendText,
        emitEvent
    };
}

export const taskSummaryProps = {
    theme: {
        type: String,
        required: true,
    },
    meta: {
        type: Object,
        default: () => ({})
    }
};