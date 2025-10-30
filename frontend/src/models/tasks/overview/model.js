import {computed} from "vue";

export function taskOverviewModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const defaultList = computed(() => {
        const v = props.meta.default_tasks;
        if (Array.isArray(v)) return v;
        // some meta versions store number -> fallback to known defaults
        return props.meta.default_task_list || ["storage","measure"];
    });

    const formattedLastUpdated = computed(() => {
        const ts = props.meta.tasks_last_updated;
        if (!ts) return "—";
        const d = new Date(ts);
        return d.toLocaleString();
    });

    return {
        defaultList,
        formattedLastUpdated,
        emitEvent
    };
}

export const taskOverviewProps = {
    theme: {
        type: String,
        required: true,
    },
    meta: {
        type: Object,
        default: () => ({})
    }
};