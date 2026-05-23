import { computed } from "vue";
import {isFiniteNumber} from "@/utils/math";

const DEG = Math.PI / 180;

const toNumber = (value, fallback = 0) => {
    const number = Number(value);
    return isFiniteNumber(number) ? number : fallback;
};

const setPath = (target, path, value) => {
    const keys = String(path || "").split(".").filter(Boolean);

    if (!target || !keys.length) {
        return;
    }

    let cursor = target;
    keys.slice(0, -1).forEach(key => {
        cursor[key] = {
            ...(cursor[key] || {}),
        };
        cursor = cursor[key];
    });
    cursor[keys[keys.length - 1]] = value;
};

export function cameraModel(props, emit) {
    const emitEvent = (event, payload) => emit("update:component-event", event, payload);

    const camera = computed(() => props.cameraConfig || {});
    const orbit = computed(() => props.orbitConfig || {});
    const gizmo = computed(() => props.gizmoConfig || {});
    const edit = computed(() => props.editConfig || {});
    const sculpt = computed(() => props.sculptConfig || {});
    const view = computed(() => props.viewConfig || {});

    const activeLayer = computed(() => (
        (props.selectedLayers || []).find(layer => Number(layer?.type) === 5) || null
    ));

    const fieldValue = key => {
        if (key === "orthographicScale") {
            return camera.value.orthographicScale ?? camera.value.orthographic_scale ?? orbit.value.orthographicScale ?? 5;
        }

        if (key === "radius") {
            return orbit.value.radius ?? camera.value.radius ?? 4.6;
        }

        if (key === "theta") {
            return Math.round(toNumber(orbit.value.theta ?? camera.value.theta, 0) / DEG);
        }

        if (key === "phi") {
            return Math.round(toNumber(orbit.value.phi ?? camera.value.phi, 0) / DEG);
        }

        if (key.startsWith("target_")) {
            const axis = key.slice(-1);
            return orbit.value.target?.[axis] ?? camera.value.target?.[axis] ?? 0;
        }

        return camera.value[key] ?? orbit.value[key] ?? 0;
    };

    const setProjection = projection => {
        props.cameraConfig.projection = projection;
        emitEvent("camera:projection", projection);
    };

    const setCameraField = (key, value) => {
        const numberValue = toNumber(value, fieldValue(key));
        const payload = { key, value: numberValue };

        if (key === "theta" || key === "phi") {
            payload.value = numberValue * DEG;
        }

        if (key === "orthographicScale") {
            props.cameraConfig.orthographicScale = numberValue;
            props.orbitConfig.orthographicScale = numberValue;
        } else if (key === "radius") {
            props.orbitConfig.radius = numberValue;
            props.cameraConfig.radius = numberValue;
        } else if (key === "theta" || key === "phi") {
            props.orbitConfig[key] = payload.value;
            props.cameraConfig[key] = payload.value;
        } else if (key.startsWith("target_")) {
            const axis = key.slice(-1);
            props.orbitConfig.target = {
                ...(props.orbitConfig.target || {}),
                [axis]: numberValue,
            };
            props.cameraConfig.target = {
                ...(props.cameraConfig.target || {}),
                [axis]: numberValue,
            };
        } else {
            props.cameraConfig[key] = numberValue;
        }

        emitEvent("camera:field", payload);
    };

    const emitCameraAction = action => emitEvent("camera:action", action);

    const setView = name => emitEvent("camera:view", name);

    const setEditorViewMode = mode => {
        props.viewConfig.mode = mode;
        emitEvent("editor:view-mode", mode);
    };

    const setGizmoTool = tool => {
        props.gizmoConfig.tool = tool;
        emitEvent("gizmo:tool", { tool });
    };

    const setGizmoAxis = axis => {
        props.gizmoConfig.axis = axis;
        emitEvent("gizmo:axis", { axis, tool: props.gizmoConfig.tool });
    };

    const setGizmoPivot = pivot => {
        props.gizmoConfig.pivot = pivot;
        emitEvent("gizmo:pivot", { pivot });
    };

    const setMeshMode = mode => {
        if (props.meshStates?.edit) {
            props.meshStates.edit.value = true;
        }
        props.editConfig.enabled = true;
        props.editConfig.mode = mode;
        emitEvent("mesh-edit:mode", mode);
    };

    const setMeshTool = tool => {
        props.editConfig.tool = tool;
        emitEvent("mesh-edit:tool", tool);
    };

    const setMeshField = (field, value) => {
        setPath(props.editConfig, field, value);
        emitEvent("mesh-edit:field", { field, value });
    };

    const emitMeshAction = action => emitEvent("mesh-edit:action", action);

    const setSculptField = (field, value) => {
        if (field === "enabled" && props.meshStates?.sculpt) {
            props.meshStates.sculpt.value = value === true;
        }
        setPath(props.sculptConfig, field, value);
        emitEvent("sculpt:field", { field, value });
    };

    return {
        activeLayer,
        camera,
        orbit,
        gizmo,
        edit,
        sculpt,
        view,
        compact: computed(() => props.compact !== false),
        fieldValue,
        viewButtons: [
            { key: "front", icon: "mdi-axis-z-arrow", label: "Front" },
            { key: "right", icon: "mdi-axis-x-arrow", label: "Right" },
            { key: "top", icon: "mdi-axis-y-arrow", label: "Top" },
            { key: "back", icon: "mdi-axis-z-rotate-clockwise", label: "Back" },
            { key: "left", icon: "mdi-axis-x-rotate-clockwise", label: "Left" },
        ],
        cameraFields: [
            { key: "fov", label: "FOV", step: 1, min: 1, max: 175 },
            { key: "near", label: "Near", step: 0.001, min: 0.0001 },
            { key: "far", label: "Far", step: 1, min: 0.01 },
            { key: "radius", label: "Radius", step: 0.01, min: 0.0001 },
            { key: "orthographicScale", label: "Ortho", step: 0.01, min: 0.0001 },
            { key: "theta", label: "Theta°", step: 1 },
            { key: "phi", label: "Phi°", step: 1 },
            { key: "target_x", label: "Target X", step: 0.01 },
            { key: "target_y", label: "Target Y", step: 0.01 },
            { key: "target_z", label: "Target Z", step: 0.01 },
        ],
        gizmoTools: [
            { key: "translate", icon: "mdi-axis-arrow", label: "Move" },
            { key: "rotate", icon: "mdi-rotate-3d-variant", label: "Rotate" },
            { key: "scale", icon: "mdi-arrow-expand-all", label: "Scale" },
            { key: "pivot", icon: "mdi-crosshairs-gps", label: "Pivot" },
        ],
        axisOptions: [
            { key: "free", label: "F" },
            { key: "x", label: "X" },
            { key: "y", label: "Y" },
            { key: "z", label: "Z" },
            { key: "xy", label: "XY" },
            { key: "xz", label: "XZ" },
            { key: "yz", label: "YZ" },
        ],
        pivotOptions: [
            { key: "object", icon: "mdi-cube-scan" },
            { key: "median", icon: "mdi-selection-ellipse" },
            { key: "cursor", icon: "mdi-crosshairs" },
            { key: "world", icon: "mdi-earth" },
        ],
        viewModes: [
            { key: "world", label: "World" },
            { key: "wireframe", label: "Wire" },
            { key: "solid", label: "Solid" },
            { key: "soft", label: "Soft" },
            { key: "highlight", label: "Hi" },
        ],
        editModes: ["vertex", "edge", "face"],
        sculptTools: ["draw", "smooth", "clay", "crease", "inflate"],
        setProjection,
        setCameraField,
        emitCameraAction,
        setView,
        setEditorViewMode,
        setGizmoTool,
        setGizmoAxis,
        setGizmoPivot,
        setMeshMode,
        setMeshTool,
        setMeshField,
        emitMeshAction,
        setSculptField,
    };
}

export const cameraProps = {
    cameraConfig: { type: Object, required: true },
    orbitConfig: { type: Object, required: true },
    viewConfig: { type: Object, required: true },
    gizmoConfig: { type: Object, required: true },
    editConfig: { type: Object, required: true },
    sculptConfig: { type: Object, required: true },
    gridConfig: { type: Object, required: false, default: () => ({}) },
    editorConfig: { type: Object, required: false, default: () => ({}) },
    selectedLayers: { type: Array, required: false, default: () => [] },
    keyboard: { type: Object, required: false, default: () => ({}) },
    meshStates: { type: Object, required: false, default: () => ({}) },
    compact: { type: Boolean, required: false, default: true },
};
