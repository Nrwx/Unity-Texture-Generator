import {computed, ref} from "vue";

export function taskbarModel(props, emit) {
    const taskbar = ref(true);

    const topItems = computed(() => props.items.filter(i => i.position === 'top'));
    const centerItems = computed(() => props.items.filter(i => i.position === 'center'));
    const bottomItems = computed(() => props.items.filter(i => i.position === 'bottom'));

    const emitEvent = (id) => {
        emit("taskbar-event", id);
    };

    return {
        taskbar,
        topItems,
        centerItems,
        bottomItems,
        emitEvent
    };
}

export const taskbarProps = {
    items: {
        type: Array,
        required: true,
        default: () => [],
    },
    width: {
        type: Number,
        required: false,
        default: 400,
    },
    align: {
        type: String,
        required: true,
        default: "left",
    },
    theme: {
        type: String,
        required: true,
        default: "left",
    },
};