import { computed, ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { key } from "@/dataLayer/key";
import { eventRegister } from "@/dataLayer/event";

const CLICK_THRESHOLD = 4;

export function selectionModel(props, emit) {
    const panel = ref(null);
    const selecting = ref(false);
    const start = ref({ x: 0, y: 0 });
    const end = ref({ x: 0, y: 0 });
    const selectionBox = ref(null);

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const emitSelect = payload => {
        emit("update:select-event", payload);
    };

    const { register } = eventRegister("listener:select-mask", emitEvent);

    const getElementById = id => {
        if (!id) {
            return null;
        }

        return document.getElementById(id);
    };

    const getMousePosition = event => {
        const rect = panel.value.getBoundingClientRect();

        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    };

    const isProportional = computed(() => {
        return props.shape === "square" || props.shape === "circle";
    });

    const isCircleOrEllipse = computed(() => {
        return props.shape === "ellipse" || props.shape === "circle";
    });

    const calculateBox = (startPoint, endPoint) => {
        const x = Math.min(startPoint.x, endPoint.x);
        const y = Math.min(startPoint.y, endPoint.y);
        const width = Math.abs(startPoint.x - endPoint.x);
        const height = Math.abs(startPoint.y - endPoint.y);

        return {
            x,
            y,
            width,
            height,
        };
    };

    const isClickBox = (startPoint, endPoint) => {
        const dx = Math.abs(Number(endPoint.x || 0) - Number(startPoint.x || 0));
        const dy = Math.abs(Number(endPoint.y || 0) - Number(startPoint.y || 0));

        return dx <= CLICK_THRESHOLD && dy <= CLICK_THRESHOLD;
    };

    const intersectBoxes = (a, b) => {
        if (!a || !b) {
            return null;
        }

        const left = Math.max(a.x, b.x);
        const top = Math.max(a.y, b.y);
        const right = Math.min(a.x + a.width, b.x + b.width);
        const bottom = Math.min(a.y + a.height, b.y + b.height);

        if (right <= left || bottom <= top) {
            return null;
        }

        return {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
        };
    };

    const getContainerBoxInSelectionSpace = () => {
        const root = panel.value;
        const container = getElementById(props.containerId);

        if (!root || !container) {
            return null;
        }

        const rootRect = root.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        return {
            x: containerRect.left - rootRect.left,
            y: containerRect.top - rootRect.top,
            width: containerRect.width,
            height: containerRect.height,
        };
    };

    const selectionBoxToContainerMaskBox = box => {
        const containerBox = getContainerBoxInSelectionSpace();

        if (!box || !containerBox) {
            return null;
        }

        const overlap = intersectBoxes(box, containerBox);

        if (!overlap) {
            return null;
        }

        return {
            x: overlap.x - containerBox.x,
            y: overlap.y - containerBox.y,
            width: overlap.width,
            height: overlap.height,
        };
    };

    const roundBox = box => {
        if (!box) {
            return null;
        }

        return {
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height),
        };
    };

    const clearSelectionBox = () => {
        selectionBox.value = null;

        emitSelect(null);

        emitEvent("update:select-items-box", null);
        emitEvent("update:select-mask-box", null);
    };

    const activeBox = computed(() => {
        if (selecting.value) {
            return calculateBox(start.value, end.value);
        }

        if (selectionBox.value) {
            return selectionBox.value;
        }

        return null;
    });

    const onKeyDown = event => {
        if (event.key !== "Shift" || key.shift.value) {
            return;
        }

        key.shift.value = true;

        switch (props.shape) {
            case "rectangle":
                emitEvent("select:mask-shape", "square");
                break;

            case "square":
                emitEvent("select:mask-shape", "rectangle");
                break;

            case "ellipse":
                emitEvent("select:mask-shape", "circle");
                break;

            case "circle":
                emitEvent("select:mask-shape", "ellipse");
                break;

            default:
                break;
        }
    };

    const onKeyUp = event => {
        if (event.key !== "Shift") {
            return;
        }

        event.preventDefault();
        key.shift.value = false;
        emitEvent("select:mask-shape", props.shape);
    };

    const onMouseDown = event => {
        if (!props.state) {
            return;
        }

        const pos = getMousePosition(event);

        selecting.value = true;
        start.value = { ...pos };
        end.value = { ...pos };
    };

    const onMouseMove = event => {
        if (!props.state || !selecting.value) {
            return;
        }

        const pos = getMousePosition(event);

        let dx = pos.x - start.value.x;
        let dy = pos.y - start.value.y;

        if (isProportional.value) {
            const size = Math.min(Math.abs(dx), Math.abs(dy));

            dx = dx < 0 ? -size : size;
            dy = dy < 0 ? -size : size;
        }

        end.value = {
            x: start.value.x + dx,
            y: start.value.y + dy,
        };
    };

    const onMouseUp = async event => {
        if (!props.state || !selecting.value) {
            return;
        }

        const endPoint = event ? getMousePosition(event) : end.value;

        selecting.value = false;
        end.value = { ...endPoint };

        if (isClickBox(start.value, endPoint)) {
            clearSelectionBox();
            return;
        }

        const fullBox = roundBox(calculateBox(start.value, endPoint));
        const maskBox = roundBox(selectionBoxToContainerMaskBox(fullBox));

        selectionBox.value = fullBox;

        if (props.select) {
            emitSelect(selectionBox.value);
        } else {
            // Sichtbare Box: immer komplett.
            emitEvent("update:select-items-box", fullBox);
            emitEvent("update:select-mask-box", maskBox);
        }

        await nextTick();

        selectionBox.value = null;
        emitEvent("select-state:items", false);
        emitEvent("select-state", false);
    };

    onMounted(() => {
        register("add", panel.value, "pointerdown", onMouseDown);
        register("add", panel.value, "pointerup", onMouseUp);
        register("add", panel.value, "pointermove", onMouseMove);
        register("add", document, "keydown", onKeyDown);
        register("add", document, "keyup", onKeyUp);
        register("pause");
    });

    onBeforeUnmount(() => {
        register("removeAll");
    });

    return {
        panel,
        selecting,
        activeBox,
        isCircleOrEllipse,
        clearSelectionBox,

        onKeyDown,
        onKeyUp,
        onMouseUp,
        onMouseMove,
        onMouseDown,
    };
}

export const selectionProps = {
    state: {
        type: Boolean,
        required: true,
    },
    select: {
        type: Boolean,
        required: false,
        default: false,
    },
    shape: {
        type: String,
        required: true,
    },
    mainId: {
        type: String,
        required: false,
        default: "",
    },
    containerId: {
        type: String,
        required: false,
        default: "",
    },
};