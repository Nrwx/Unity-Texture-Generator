import { animatorGizmo } from "@/view/models/page/material/animator/state";
import { useMouse } from "@/composables/mouse/model";
import { eventRegister } from "@/dataLayer/event";
import { uuid } from "@/utils/uuid";
import { onBeforeUnmount, onMounted, reactive } from "vue";

export function gizmoModel(props, emit) {
    const gizmo = reactive({ id: uuid() });

    const emitEvent = (event, payload) => emit("update:component-event", event, payload);
    const { register } = eventRegister(`listener:gizmo-${gizmo.id}`, emitEvent);

    const mouse = useMouse({ register, elementId: gizmo.id, mode: "client", preventDefault: false });

    const gizmoTools = [
        { key: "translate", icon: "mdi-axis-arrow", label: "Move" },
        { key: "rotate", icon: "mdi-rotate-3d-variant", label: "Rotate" },
        { key: "scale", icon: "mdi-arrow-expand-all", label: "Scale" },
        { key: "pivot", icon: "mdi-crosshairs-gps", label: "Pivot" },
    ];

    const axisOptions = [
        { key: "free", label: "Free" },
        { key: "x", label: "X" },
        { key: "y", label: "Y" },
        { key: "z", label: "Z" },
        { key: "xy", label: "XY" },
        { key: "xz", label: "XZ" },
        { key: "yz", label: "YZ" },
    ];

    const pivotOptions = [
        { key: "object", label: "Object" },
        { key: "median", label: "Median" },
        { key: "cursor", label: "Cursor" },
        { key: "world", label: "World" },
    ];

    const visibilityOptions = [
        { key: "showAxisHandles", label: "XYZ Handles" },
        { key: "showRotateRings", label: "Rotate Rings" },
        { key: "showScaleHandles", label: "Scale Handles" },
        { key: "showPlaneHandles", label: "Plane Handles" },
        { key: "showObjectPivot", label: "Object Pivot" },
        { key: "showWorldPivot", label: "World Center" },
        { key: "showAxisGuide", label: "Drag Axis Guide" },
        { key: "showWorldAxis", label: "World Axis" },
    ];

    const pivotActions = [
        { key: "pivot-to-center", label: "Pivot → Center" },
        { key: "center-to-pivot", label: "Center → Pivot" },
        { key: "pivot-to-cursor", label: "Pivot → Cursor" },
        { key: "cursor-to-pivot", label: "Cursor → Pivot" },
        { key: "pivot-to-world", label: "Pivot → World" },
        { key: "cursor-to-world", label: "Cursor → World" },
    ];

    const setTool = tool => {
        animatorGizmo.tool = tool;
        emitEvent("gizmo:tool", { tool });
    };

    const setAxis = axis => {
        animatorGizmo.axis = axis;
        emitEvent("gizmo:axis", { axis, tool: animatorGizmo.tool });
    };

    const setPivot = pivot => {
        animatorGizmo.pivot = pivot;
        emitEvent("gizmo:pivot", { pivot });
    };

    const setVisibility = (key, value) => {
        animatorGizmo[key] = value === true;
        emitEvent("gizmo:visibility", { key, value: animatorGizmo[key] });
    };

    const runPivotAction = action => {
        animatorGizmo.pivotAction = action;
        animatorGizmo.pivotActionTick = (animatorGizmo.pivotActionTick || 0) + 1;
        emitEvent("gizmo:pivot-action", { action });
    };

    const emitSelect = async event => {
        if (event?.button !== 2) return;
        await mouse.down(event);
        if (!props.disabled) {
            emit("select");
            emitEvent("gizmo:select", { mode: props.mode });
        }
    };

    const emitAxis = async (axis, tool, event) => {
        if (event?.button !== 2) return;
        await mouse.down(event);
        if (!props.disabled) {
            const payload = { axis, tool };
            emit("axis", payload);
            emitEvent("gizmo:axis", payload);
        }
    };

    const emitRelease = async event => {
        if (event) await mouse.up(event);
        emit("release");
        emitEvent("gizmo:release");
    };

    onMounted(() => mouse.init());
    onBeforeUnmount(() => register("removeAll"));

    return {
        gizmo,
        mouse,
        animatorGizmo,
        gizmoTools,
        axisOptions,
        pivotOptions,
        visibilityOptions,
        pivotActions,
        setTool,
        setAxis,
        setPivot,
        setVisibility,
        runPivotAction,
        emitSelect,
        emitAxis,
        emitRelease,
    };
}

export const gizmoProps = {
    mode: { type: String, required: false, default: "panel" },
    active: { type: Boolean, required: false, default: false },
    selected: { type: Boolean, required: false, default: false },
    compact: { type: Boolean, required: false, default: false },
    disabled: { type: Boolean, required: false, default: false },
    state: { type: Boolean, required: false, default: true },
};
