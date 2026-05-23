import {computed, onBeforeUnmount, ref, watch} from "vue";

export function queueModel(props, emit) {
    const expanded = ref(false);
    const pollInterval = ref(null)

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const handleCLick = async () => {
        await pollStatus();
        expanded.value = !expanded.value
    }

    const methodIcon = computed(() => {
        switch (props.queue?.method) {
            case 'GET': return 'mdi-cloud-download-outline';
            case 'POST': return 'mdi-cloud-upload-outline';
            case 'PUT': return 'mdi-pencil-outline';
            case 'DELETE': return 'mdi-trash-can-outline';
            case 'PENDING': return 'mdi-loading';
            case 'FINISH': return 'mdi-check-all';
            default: return 'mdi-sync';
        }
    });

    const routeIcon = computed(() => {
        const route = props.queue?.path || "";

        if (route.startsWith("/finish")) return 'mdi-content-save-outline';
        if (route.startsWith("/pending")) return 'mdi-clock-time-five-outline';
        if (route.startsWith("/viewport")) return 'mdi-monitor';
        if (route.startsWith("/upload")) return 'mdi-file-upload-outline';
        if (route.startsWith("/layer")) return 'mdi-layers';
        if (route.startsWith("/backup")) return 'mdi-database-export-outline';
        if (route.startsWith("/fonts")) return 'mdi-format-font';
        if (route.startsWith("/settings")) return 'mdi-cog-outline';
        if (route.startsWith("/tile")) return 'mdi-grid-large';
        if (route.startsWith("/modifier")) return 'mdi-tune-variant';
        if (route.startsWith("/brush")) return 'mdi-brush-variant';
        if (route.startsWith("/cursor")) return 'mdi-cursor-default-outline';
        if (route.startsWith("/ai/")) return 'mdi-robot-outline';
        if (route.startsWith("/queue")) return 'mdi-format-list-bulleted';
        return 'mdi-folder-outline';
    });


    const getDayProgress = (now) => {
        const percent = ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100;
        return Math.round(percent);
    };


    async function pollStatus() {
        if(props.queue.complete) {
            emitEvent('app:queue-status', {state: false})
            clearInterval(pollInterval.value);
            pollInterval.value = null;
        } else {
            if(pollInterval.value === null) {
                pollInterval.value = setInterval(pollStatus, 100)
            }
            emitEvent('app:queue-status', {state: true})
        }
    }

    watch(
        () => props.state,
        async (newVal) => {
            if (newVal && pollInterval.value === null) {
                await pollStatus();
            }
        }
    );

    onBeforeUnmount( () => {
        clearInterval(pollInterval)
    });

    return {
        expanded,
        handleCLick,
        getDayProgress,
        methodIcon,
        routeIcon
    };
}

export const queueProps = {
    queue: {
        type: Object,
        required: true
    },
    state: {
        type: Boolean,
        required: true
    },
    wait: {
        type: Boolean,
        required: true
    },
    theme: {
        type: String,
        required: true
    }
};
