import { animatorGizmo } from "@/view/models/page/material/animator/state";
import { useMouse } from "@/composables/mouse/model";
import { eventRegister } from "@/dataLayer/event";
import { uuid } from "@/utils/uuid";
import { onBeforeUnmount, onMounted, reactive } from "vue";

export function gizmoModel(props, emit) {
    const gizmo = reactive({
        id: uuid(),
    });

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const { register } = eventRegister(`listener:gizmo-${gizmo.id}`, emitEvent);

    const mouse = useMouse({
        register,
        elementId: gizmo.id,
        mode: "client",
        preventDefault: false,
    });

    const gizmoTools = [
        { key: "orbit", icon: "mdi-orbit", label: "Orbit" },
        { key: "translate", icon: "mdi-axis-arrow", label: "Move" },
        { key: "rotate", icon: "mdi-rotate-3d-variant", label: "Rotate" },
        { key: "scale", icon: "mdi-arrow-expand-all", label: "Scale" },
    ];

    const axisOptions = [
        { key: "x", label: "X" },
        { key: "y", label: "Y" },
        { key: "z", label: "Z" },
    ];

    const pivotOptions = [
        { key: "object", label: "Object" },
        { key: "median", label: "Median" },
        { key: "cursor", label: "Cursor" },
    ];

    const emitSelect = async event => {
        if (event?.button !== 2) {
            return;
        }

        await mouse.down(event);

        if (!props.disabled) {
            emit("select");
            emitEvent("gizmo:select", { mode: props.mode });
        }
    };

    const emitAxis = async (axis, tool, event) => {
        if (event?.button !== 2) {
            return;
        }

        await mouse.down(event);

        if (!props.disabled) {
            const payload = {
                axis,
                tool,
            };

            emit("axis", payload);
            emitEvent("gizmo:axis", payload);
        }
    };

    const emitRelease = async event => {
        if (event) {
            await mouse.up(event);
        }

        emit("release");
        emitEvent("gizmo:release");
    };

    onMounted(() => {
        mouse.init();
    });

    onBeforeUnmount(() => {
        register("removeAll");
    });

    return {
        gizmo,
        mouse,
        animatorGizmo,
        gizmoTools,
        axisOptions,
        pivotOptions,

        emitSelect,
        emitAxis,
        emitRelease,
    };
}

export const gizmoProps = {
    mode: {
        type: String,
        required: false,
        default: "panel",
    },

    active: {
        type: Boolean,
        required: false,
        default: false,
    },

    selected: {
        type: Boolean,
        required: false,
        default: false,
    },

    compact: {
        type: Boolean,
        required: false,
        default: false,
    },

    disabled: {
        type: Boolean,
        required: false,
        default: false,
    },

    state: {
        type: Boolean,
        required: false,
        default: true,
    },
};
