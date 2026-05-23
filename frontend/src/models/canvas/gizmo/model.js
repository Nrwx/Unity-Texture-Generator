import { computed, reactive } from "vue";
import { uuid } from "@/utils/uuid";

export function gizmoModel(props, emit) {
    const gizmo = reactive({ id: uuid() });
    const animatorGizmo = computed(() => props.config || {});
    const emitEvent = (event, payload) => emit("update:component-event", event, payload);

    const gizmoTools = [
        { key: "translate", icon: "mdi-axis-arrow", label: "Move" },
        { key: "rotate", icon: "mdi-rotate-3d-variant", label: "Rotate" },
        { key: "scale", icon: "mdi-arrow-expand-all", label: "Scale" },
        { key: "pivot", icon: "mdi-crosshairs-gps", label: "Pivot" },
    ];

    const axisOptions = [
        { key: "free", icon: "mdi-vector-combine", label: "Free" },
        { key: "x", icon: "mdi-axis-x-arrow", label: "X" },
        { key: "y", icon: "mdi-axis-y-arrow", label: "Y" },
        { key: "z", icon: "mdi-axis-z-arrow", label: "Z" },
        { key: "xy", icon: "mdi-vector-square", label: "XY" },
        { key: "xz", icon: "mdi-vector-square", label: "XZ" },
        { key: "yz", icon: "mdi-vector-square", label: "YZ" },
    ];

    const pivotOptions = [
        { key: "object", icon: "mdi-cube-scan", label: "Object" },
        { key: "median", icon: "mdi-selection-ellipse", label: "Median" },
        { key: "cursor", icon: "mdi-crosshairs", label: "Cursor" },
        { key: "world", icon: "mdi-earth", label: "World" },
    ];

    const visibilityOptions = [
        { key: "showAxisHandles", icon: "mdi-axis-arrow", label: "Axis" },
        { key: "showRotateRings", icon: "mdi-rotate-3d-variant", label: "Rings" },
        { key: "showScaleHandles", icon: "mdi-arrow-expand-all", label: "Scale" },
        { key: "showPlaneHandles", icon: "mdi-vector-square", label: "Planes" },
        { key: "showObjectPivot", icon: "mdi-cube-scan", label: "Obj Pivot" },
        { key: "showWorldPivot", icon: "mdi-earth", label: "World" },
        { key: "showAxisGuide", icon: "mdi-ray-start-arrow", label: "Guide" },
        { key: "showWorldAxis", icon: "mdi-axis-arrow-info", label: "World Axis" },
    ];

    const pivotActions = [
        { key: "pivot-to-center", icon: "mdi-crosshairs-gps", label: "Pivot → Center" },
        { key: "center-to-pivot", icon: "mdi-image-filter-center-focus", label: "Center → Pivot" },
        { key: "pivot-to-cursor", icon: "mdi-crosshairs", label: "Pivot → Cursor" },
        { key: "cursor-to-pivot", icon: "mdi-crosshairs-question", label: "Cursor → Pivot" },
        { key: "pivot-to-world", icon: "mdi-earth", label: "Pivot → World" },
        { key: "cursor-to-world", icon: "mdi-earth-arrow-right", label: "Cursor → World" },
    ];

    const setTool = tool => {
        props.config.tool = tool;
        emitEvent("gizmo:tool", { tool });
    };

    const setAxis = axis => {
        props.config.axis = axis;
        emitEvent("gizmo:axis", { axis, tool: props.config.tool });
    };

    const setPivot = pivot => {
        props.config.pivot = pivot;
        emitEvent("gizmo:pivot", { pivot });
    };

    const setVisibility = (key, value) => {
        props.config[key] = value === true;
        emitEvent("gizmo:visibility", { key, value: props.config[key] });
    };

    const toggleVisibility = key => {
        setVisibility(key, props.config[key] === false);
    };

    const runPivotAction = action => {
        props.config.pivotAction = action;
        props.config.pivotActionTick = (props.config.pivotActionTick || 0) + 1;
        emitEvent("gizmo:pivot-action", { action });
    };

    const emitSelect = event => {
        if (event?.button !== 2 || props.disabled) {
            return;
        }

        emitEvent("gizmo:select", { mode: props.mode });
    };

    const emitAxis = (axis, tool, event) => {
        if (event?.button !== 2 || props.disabled) {
            return;
        }

        setAxis(axis);
        if (tool) {
            setTool(tool);
        }
    };

    const emitRelease = () => {
        emitEvent("gizmo:release", { mode: props.mode });
    };

    return {
        gizmo,
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
        toggleVisibility,
        runPivotAction,
        emitSelect,
        emitAxis,
        emitRelease,
    };
}

export const gizmoProps = {
    config: { type: Object, required: true },
    mode: { type: String, required: false, default: "panel" },
    active: { type: Boolean, required: false, default: false },
    selected: { type: Boolean, required: false, default: false },
    compact: { type: Boolean, required: false, default: false },
    disabled: { type: Boolean, required: false, default: false },
    state: { type: Boolean, required: false, default: true },
};
