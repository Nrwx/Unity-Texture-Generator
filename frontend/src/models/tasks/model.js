/* ---------- component model (composition) ---------- */
import {computed, onMounted, ref} from "vue";

export const taskProps = {
    tasks: {
        type: Array,
        required: true
    },
    edit: {
        type: Boolean,
        default: false,
    },
    editLoading: {
        type: Boolean,
        default: true,
    },
    theme: {
        type: String,
        required: true,
    }
};

export default function taskModel(props, emit) {
    const loading = ref(false);
    const filterText = ref("");
    const filterState = ref("");

    const editing = ref(null);
    const chainInput = ref("");
    const saving = ref(false);

    const showScheduleDialog = ref(false);
    const scheduleTarget = ref(null);
    const scheduleDelay = ref(0);

    const editConfig = ref({
        maxWidth: 460,
        hideClose: true,
        title: computed(() => { return editing.value?.isNew ? 'Aufgabe erstellen' : 'Aufgabe bearbeiten'}),
        subtitle: computed(() => {return editing.value?.entry.id || '—'}),
        variant: 'rounded',
        textVariant: 'id',
        emit: "task:edit"
    });

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    /* helper: refresh list */
    async function refresh() {
        loading.value = true;
        try {
            emitEvent("task:fetch-list");
        } catch (e) {
            console.error("Task fetch error", e);
        } finally {
            loading.value = false;
        }
    }

    const visibleTasks = computed(() => {
        const txt = (filterText.value || "").trim().toLowerCase();
        return (props.tasks || []).filter((t) => {
            if (filterState.value && t.state !== filterState.value) return false;
            if (!txt) return true;
            return (
                (t.module && t.module.toLowerCase().includes(txt)) ||
                (t.type && t.type.toLowerCase().includes(txt)) ||
                (t.id && t.id.toLowerCase().includes(txt))
            );
        });
    });

    function selectTask(task) {
        openEdit(task);
    }

    function openCreate() {
        editing.value = {
            isNew: true,
            entry: {
                id: null,
                type: "custom",
                active: true,
                state: "pending",
                progress: 0,
                time_val: 0,
                default: false,
                module: null,
                custom: [],
                customId: null,
                created: null,
                updated: null,
            },
        };
        emitEvent("task:edit", true)
        chainInput.value = "";
    }

    function openEdit(task) {
        editing.value = { isNew: false, entry: JSON.parse(JSON.stringify(task)) };
        if (!editing.value.entry.custom) editing.value.entry.custom = [];
        emitEvent("task:edit", true)
        chainInput.value = "";
    }

    function cancelEditing() {
        emitEvent("task:edit", false)
        editing.value = null;
    }

    function addChainItem() {
        if (!editing.value) return;
        const val = (chainInput.value || "").trim();
        if (!val) return;
        const arr = editing.value.entry.custom || [];
        arr.push({ module: val, order: arr.length, time_val: editing.value.entry.time_val || null });
        editing.value.entry.custom = arr;
        chainInput.value = "";
    }

    function moveChainUp(idx) {
        const arr = editing.value.entry.custom;
        if (!arr || idx <= 0) return;
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        arr.forEach((c, i) => (c.order = i));
    }

    function moveChainDown(idx) {
        const arr = editing.value.entry.custom;
        if (!arr || idx >= arr.length - 1) return;
        [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
        arr.forEach((c, i) => (c.order = i));
    }

    function removeChainItem(idx) {
        editing.value.entry.custom.splice(idx, 1);
        editing.value.entry.custom.forEach((c, i) => (c.order = i));
    }

    function sortChainByTime() {
        if (!editing.value) return;
        editing.value.entry.custom.sort((a, b) => {
            const ta = a.time_val == null ? Infinity : a.time_val;
            const tb = b.time_val == null ? Infinity : b.time_val;
            if (ta === tb) return (a.order || 0) - (b.order || 0);
            return ta - tb;
        });
        editing.value.entry.custom.forEach((c, i) => (c.order = i));
    }

    function resetChain() {
        if (!editing.value) return;
        editing.value.entry.custom = [];
    }

    async function saveEditing() {
        if (!editing.value) return;
        saving.value = true;
        try {
            if (editing.value.isNew) {
                emitEvent("task:create", editing.value.entry);
            } else {
                emitEvent("task:update", editing.value.entry);
            }
            emitEvent("task:edit", false)
            editing.value = null;
        } catch (e) {
            console.error("saveEditing error", e);
        } finally {
            saving.value = false;
        }
    }

    function openSchedule(task) {
        scheduleTarget.value = task;
        scheduleDelay.value = task.time_val || 0;
        showScheduleDialog.value = true;
    }

    async function confirmSchedule() {
        showScheduleDialog.value = false;
        if (!scheduleTarget.value) return;
        emitEvent("task:schedule", {
            id: scheduleTarget.value.id,
            delay: scheduleDelay.value,
        });
        scheduleTarget.value = null;
    }

    async function runEditing() {
        if (!editing.value) return;
        if (editing.value.isNew) {
            emitEvent("task:create", editing.value.entry);
            emitEvent("task:run", editing.value.entry.id);
        } else {
            emitEvent("task:run", editing.value.entry.id);
        }
        emitEvent("task:edit", false)
        editing.value = null;
    }

    function scheduleEditing() {
        if (!editing.value) return;
        showScheduleDialog.value = true;
        scheduleTarget.value = editing.value.entry;
        scheduleDelay.value = editing.value.entry.time_val || 0;
    }

    async function stopEditing() {
        if (!editing.value) return;
        if (!editing.value.isNew) {
            emitEvent("task:stop", { id: editing.value.entry.id });
        }
    }

    function stateClass(s) {
        if (!s) return "neutral";
        if (s === "running") return "running";
        if (s === "pending") return "pending";
        if (s === "complete") return "complete";
        if (s === "failed") return "failed";
        return "neutral";
    }

    onMounted(() => {
        emitEvent("task:fetch-list");
        emitEvent("task:fetch-meta", {meta: true});
    });

    return {
        loading,
        filterText,
        filterState,
        visibleTasks,
        editing,
        chainInput,
        saving,
        editConfig,

        // schedule dialog
        showScheduleDialog,
        scheduleDelay,

        // actions
        refresh,
        openCreate,
        selectTask,
        openEdit,
        cancelEditing,
        addChainItem,
        moveChainUp,
        moveChainDown,
        removeChainItem,
        sortChainByTime,
        resetChain,
        saveEditing,
        openSchedule,
        confirmSchedule,
        runEditing,
        scheduleEditing,
        stopEditing,
        stateClass,
        emitEvent
    };
}
