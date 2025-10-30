import {computed, ref} from "vue";

export function taskbarCenterModel(props, emit) {

    const leftItems = computed(() => props.items.filter(i => i.position === 'left'));
    const centerItems = computed(() => props.items.filter(i => i.position === 'center'));
    const rightItems = computed(() => props.items.filter(i => i.position === 'right'));

    const taskbarUp = ref(false)

    const emitEvent = (id) => {
        emit("taskbar-event", id);
    };

    const handleComponentEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    return {
        leftItems,
        centerItems,
        rightItems,
        taskbarUp,
        emitEvent,
        handleComponentEvent
    };
}

export const taskbarCenterProps = {
    items: {
        type: Array,
        required: true,
        default: () => [],
    },
    active: {
        type: Object,
        required: true
    },
    expanded: {
        type: Boolean,
        required: true
    },
    theme: {
        type: String,
        required: true
    }
};