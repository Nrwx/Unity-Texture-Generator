import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { uuid } from "@/utils/uuid";
import { eventRegister } from "@/dataLayer/event";

export function windowModel(props, emit) {
    const windowRef = ref(null);
    const windowId = ref(props.id || uuid());

    const zIndex = ref(props.zIndex);

    const offsetX = ref(0);
    const offsetY = ref(0);

    const dragActive = ref(false);
    const dragStartX = ref(0);
    const dragStartY = ref(0);
    const dragBaseX = ref(0);
    const dragBaseY = ref(0);
    const dragPointerId = ref(null);

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const { register } = eventRegister(`listener:window:${windowId.value}`, emitEvent);

    const drag = computed(() => ({
        active: dragActive.value,
    }));

    const windowStyle = computed(() => ({
        position: "absolute",
        zIndex: zIndex.value,

        top: props.startPosition?.top,
        right: props.startPosition?.right,
        bottom: props.startPosition?.bottom,
        left: props.startPosition?.left,

        transform: `translate3d(${offsetX.value}px, ${offsetY.value}px, 0)`,
    }));

    const getMeta = () => ({
        id: windowId.value,
        title: props.title,
        icon: props.icon,
        state: props.state,
        closeEvent: props.closeEvent,
        compact: props.compact,
        disabled: props.disabled,
        zIndex: zIndex.value,
        startPosition: props.startPosition,
        offset: {
            x: offsetX.value,
            y: offsetY.value,
        },
    });

    const emitWindowUpdate = () => {
        emitEvent("window:update", getMeta());
    };

    const removeDragListeners = () => {
        register("remove", window, "pointermove", moveDrag);
        register("remove", window, "pointerup", stopDrag);
        register("remove", window, "pointercancel", stopDrag);
    };

    const stopDrag = event => {
        if (
            dragPointerId.value !== null &&
            event?.pointerId !== undefined &&
            event.pointerId !== dragPointerId.value
        ) {
            return;
        }

        dragActive.value = false;
        dragPointerId.value = null;

        removeDragListeners();
        emitWindowUpdate();
    };

    const moveDrag = event => {
        if (!dragActive.value) return;

        if (
            dragPointerId.value !== null &&
            event?.pointerId !== undefined &&
            event.pointerId !== dragPointerId.value
        ) {
            return;
        }

        offsetX.value = dragBaseX.value + event.clientX - dragStartX.value;
        offsetY.value = dragBaseY.value + event.clientY - dragStartY.value;

        emitEvent("window:drag", {
            id: windowId.value,
            x: offsetX.value,
            y: offsetY.value,
        });
    };

    const focusWindow = () => {
        emitEvent("window:focus", {
            id: windowId.value,
        });
    };

    const startDrag = event => {
        if (event.button !== 0 || props.disabled) return;

        focusWindow();
        removeDragListeners();

        dragActive.value = true;
        dragPointerId.value = event.pointerId;
        dragStartX.value = event.clientX;
        dragStartY.value = event.clientY;
        dragBaseX.value = offsetX.value;
        dragBaseY.value = offsetY.value;

        register("add", window, "pointermove", moveDrag);
        register("add", window, "pointerup", stopDrag);
        register("add", window, "pointercancel", stopDrag);
    };

    const closeWindow = () => {
        removeDragListeners();

        emitEvent("window:close", {
            id: windowId.value,
        });
    };

    onMounted(() => {
        emitEvent("window:register", getMeta());
    });

    onBeforeUnmount(() => {
        removeDragListeners();
        register("removeAll");

        emitEvent("window:unregister", {
            id: windowId.value,
        });
    });

    return {
        windowRef,
        windowId,
        drag,
        windowStyle,
        startDrag,
        closeWindow,
        focusWindow,
    };
}

export const windowProps = {
    id: { type: String, required: false, default: "" },
    state: { type: Boolean, required: false, default: true },
    title: { type: String, required: false, default: "Window" },
    icon: { type: String, required: false, default: "" },
    closeEvent: { type: String, required: false, default: "" },
    startPosition: {
        type: Object,
        required: false,
        default: () => ({
            top: "40px",
            right: "70px",
        }),
    },
    compact: { type: Boolean, required: false, default: false },
    disabled: { type: Boolean, required: false, default: false },
    zIndex: { type: [Number, String], required: false, default: 90 },
};