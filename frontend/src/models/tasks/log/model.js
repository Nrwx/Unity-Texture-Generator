import {computed, ref} from "vue";

export function taskLogModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const page = ref(0);
    const perPage = 8;

    const logs = computed(() => {
        // meta.logs expected array of objects: { id, module, state, progress, timestamp, message, context }
        const arr = (props.meta.logs || []).slice().sort((a,b) => (b.timestamp||0) - (a.timestamp||0));
        // make sure each row has a message placeholder
        return arr.map(l => ({ message: l.message || '', context: l.context || '', ...l }));
    });

    const totalPages = computed(() => Math.max(1, Math.ceil(logs.value.length / perPage)));
    const logSlice = computed(() => logs.value.slice(page.value*perPage, page.value*perPage + perPage));

    function formatTime(ts) {
        if(!ts) return "—";
        const d = new Date(ts);
        return d.toLocaleString();
    }

    const lastLogTime = computed(() => {
        if(!logs.value.length) return "—";
        return formatTime(logs.value[0].timestamp);
    });

    function rowClass(l) {
        return {
            failed: l.state === 'failed',
            running: l.state === 'running',
            complete: l.state === 'complete',
            pending: l.state === 'pending'
        };
    }

    function prevPage(){ if(page.value>0) page.value--; }
    function nextPage(){ if(page.value < totalPages.value-1) page.value++; }

    return {
        page,
        perPage,
        logs,
        totalPages,
        logSlice,
        formatTime,
        lastLogTime,
        rowClass,
        nextPage,
        prevPage,
        emitEvent
    };
}

export const taskLogProps = {
    theme: {
        type: String,
        required: true,
    },
    meta: {
        type: Object,
        default: () => ({})
    }
};