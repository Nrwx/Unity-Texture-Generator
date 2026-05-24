import { computed } from "vue";
import {DEG, number} from "@/utils/math";

const normalizeAngleDeg = value => {
    const n = number(value, 0);
    const normalized = ((n + 180) % 360 + 360) % 360 - 180;

    return normalized === -180 ? 180 : normalized;
};

export function cameraModel(props, emit) {
    const emitEvent = (event, payload) => emit("update:component-event", event, payload);

    const camera = computed(() => props.cameraConfig || {});
    const orbit = computed(() => props.orbitConfig || {});

    const activeLayer = computed(() => (
        (props.selectedLayers || []).find(layer => Number(layer?.type) === 5) || null
    ));

    const fieldValue = key => {
        if (key === "orthographicScale") {
            return camera.value.orthographicScale
                ?? camera.value.orthographic_scale
                ?? orbit.value.orthographicScale
                ?? 5;
        }

        if (key === "radius") {
            return orbit.value.radius ?? camera.value.radius ?? 4.6;
        }

        if (key === "theta") {
            return Math.round(
                normalizeAngleDeg(number(orbit.value.theta ?? camera.value.theta, 0) / DEG)
            );
        }

        if (key === "phi") {
            return Math.round(
                Math.min(
                    Math.max(number(orbit.value.phi ?? camera.value.phi, 0) / DEG, -89.5),
                    89.5
                )
            );
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
        const numberValue = number(value, fieldValue(key));
        const payload = { key, value: numberValue };

        if (key === "theta") {
            payload.value = normalizeAngleDeg(numberValue) * DEG;
        }

        if (key === "phi") {
            payload.value = Math.min(Math.max(numberValue, -89.5), 89.5) * DEG;
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

    return {
        activeLayer,
        camera,
        orbit,

        compact: computed(() => props.compact !== false),

        fieldValue,

        viewButtons: [
            { key: "front", icon: "mdi-axis-z-arrow", label: "Front" },
            { key: "right", icon: "mdi-axis-x-arrow", label: "Right" },
            { key: "top", icon: "mdi-axis-y-arrow", label: "Top" },
            { key: "bottom", icon: "mdi-axis-y-rotate-clockwise", label: "Bottom" },
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

        setProjection,
        setCameraField,
        emitCameraAction,
        setView,
    };
}

export const cameraProps = {
    cameraConfig: { type: Object, required: true },
    orbitConfig: { type: Object, required: true },

    selectedLayers: { type: Array, required: false, default: () => [] },
    compact: { type: Boolean, required: false, default: true },
};