import { computed, unref } from "vue";

export function statusBarModel(props, emit) {
    const emitEvent = (event, payload) => emit("component-event", event, payload);

    const isActive = (item) => Boolean(unref(item.active));

    const visibleItems = computed(() => {
        return [...props.items]
            .filter((item) => !item.hidden && (isActive(item) || props.showInactive))
            .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
    });

    const shouldShow = computed(() => {
        if (props.alwaysShow) return true;
        return visibleItems.value.some((item) => isActive(item));
    });

    const itemStyle = (item) => {
        const active = isActive(item);
        const color = item.color || "#64748b";

        return {
            backgroundColor: color,
            color: "#fff",
            opacity: active ? 1 : 0.45,
            boxShadow: active
                ? `0 0 0 1px rgba(255,255,255,.08) inset, 0 0 10px ${color}`
                : "0 0 0 1px rgba(255,255,255,.08) inset",
        };
    };

    return {
        visibleItems,
        shouldShow,
        itemStyle,
        emitEvent,
        isActive,
    };
}

export const statusBarProps = {
    items: {
        type: Array,
        required: true,
    },
    showInactive: {
        type: Boolean,
        default: false,
    },
    alwaysShow: {
        type: Boolean,
        default: false,
    },
    docked: {
        type: Boolean,
        default: false,
    },
};