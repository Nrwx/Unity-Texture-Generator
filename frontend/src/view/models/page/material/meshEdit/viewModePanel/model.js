import { computed } from "vue";

export const viewModePanelProps = {
    config: {
        type: Object,
        required: true,
    },
};

export function viewModePanelModel(props, emit) {
    const modes = [
        { key: "wireframe", label: "Wireframe" },
        { key: "solid", label: "Solid" },
        { key: "soft", label: "Soft" },
        { key: "world", label: "World" },
    ];

    const value = computed(() => props.config?.mode || "world");

    const set = mode => {
        props.config.mode = mode || "world";
        emit("update:component-event", "editor:view-mode", props.config.mode);
    };

    return {
        modes,
        value,
        set,
    };
}
