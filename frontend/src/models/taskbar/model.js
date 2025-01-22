import {ref} from "vue";

export function taskbarModel(emit) {
    const taskbar = ref(true);

    const emitEvent = (id) => {
        emit("taskbar-event", id);
    };

    return {
        taskbar,
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
};