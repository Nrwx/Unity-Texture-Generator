import { computed } from "vue";
import {
    animatorActiveLayerId,
    animatorCameraCommand,
    animatorCameraState,
} from "@/view/models/page/material/animator/state";

const DEFAULT_CAMERA = {
    projection: "perspective",
    fov: 50,
    near: 0.01,
    far: 1000,
    radius: 4.6,
    orthographic_scale: 5,
    orthographicScale: 5,
    theta: 0,
    phi: 0,
    target: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: -3.25, z: 0.18 },
    up: { x: 0, y: 0, z: 1 },
};

const toNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const normalizeVector = (value = {}, fallback = { x: 0, y: 0, z: 0 }) => ({
    x: toNumber(value?.x ?? value?.[0], fallback.x),
    y: toNumber(value?.y ?? value?.[1], fallback.y),
    z: toNumber(value?.z ?? value?.[2], fallback.z),
});

const normalizeCamera = camera => {
    const normalized = {
        ...DEFAULT_CAMERA,
        ...(camera || {}),
        projection: camera?.projection === "orthographic" ? "orthographic" : "perspective",
        fov: toNumber(camera?.fov, DEFAULT_CAMERA.fov),
        near: toNumber(camera?.near, DEFAULT_CAMERA.near),
        far: toNumber(camera?.far, DEFAULT_CAMERA.far),
        radius: toNumber(camera?.radius, DEFAULT_CAMERA.radius),
        orthographic_scale: toNumber(camera?.orthographic_scale ?? camera?.orthographicScale, DEFAULT_CAMERA.orthographic_scale),
        orthographicScale: toNumber(camera?.orthographicScale ?? camera?.orthographic_scale, DEFAULT_CAMERA.orthographicScale),
        theta: toNumber(camera?.theta, DEFAULT_CAMERA.theta) * 180 / Math.PI,
        phi: toNumber(camera?.phi, DEFAULT_CAMERA.phi) * 180 / Math.PI,
        target: normalizeVector(camera?.target, DEFAULT_CAMERA.target),
        position: normalizeVector(camera?.position, DEFAULT_CAMERA.position),
    };

    normalized.target_x = normalized.target.x;
    normalized.target_y = normalized.target.y;
    normalized.target_z = normalized.target.z;
    return normalized;
};

export function cameraModel(props) {
    const selectedMaterialLayers = computed(() => (
        (props.selectedLayers || []).filter(layer => Number(layer?.type) === 5)
    ));

    const activeLayer = computed(() => (
        selectedMaterialLayers.value.find(layer => layer.id === animatorActiveLayerId.value) ||
        selectedMaterialLayers.value[selectedMaterialLayers.value.length - 1] ||
        (props.layers || []).find(layer => layer.id === animatorActiveLayerId.value && Number(layer?.type) === 5) ||
        null
    ));

    const savedCamera = computed(() => normalizeCamera(
        animatorCameraState.payload ||
        activeLayer.value?.viewport_camera ||
        activeLayer.value?.settings?.viewport_camera ||
        activeLayer.value?.preview?.viewport_camera ||
        animatorCameraState
    ));

    const setSavedCameraField = (key, value) => {
        if (key === "projection") {
            animatorCameraCommand.projection = value;
            return;
        }

        const fieldKey = key === "orthographic_scale" ? "orthographicScale" : key;
        animatorCameraCommand.field = {
            key: fieldKey,
            value: toNumber(value, DEFAULT_CAMERA[fieldKey] ?? 0),
        };
        animatorCameraCommand.fieldTick += 1;
    };

    const applyCurrentCamera = () => {
        animatorCameraCommand.apply += 1;
    };

    const resetCamera = () => {
        animatorCameraCommand.reset += 1;
    };

    const restoreSavedCamera = () => {
        animatorCameraCommand.restore += 1;
    };

    const setAnimatorView = view => {
        animatorCameraCommand.view = view;
    };

    const focusPivot = () => {
        animatorCameraCommand.focusPivot += 1;
    };

    return {
        animatorCameraCommand,
        activeLayer,
        savedCamera,
        viewButtons: [
            { key: "front", icon: "mdi-axis-z-arrow", label: "Front" },
            { key: "right", icon: "mdi-axis-x-arrow", label: "Right" },
            { key: "top", icon: "mdi-axis-y-arrow", label: "Top" },
            { key: "back", icon: "mdi-axis-z-rotate-clockwise", label: "Back" },
            { key: "left", icon: "mdi-axis-x-rotate-clockwise", label: "Left" },
        ],
        cameraGroups: [
            { key: "lens", title: "Lens", fields: [
                { key: "fov", label: "FOV", step: 1, min: 1, max: 175 },
                { key: "near", label: "Near", step: 0.001, min: 0.0001 },
                { key: "far", label: "Far", step: 1, min: 0.01 },
            ]},
            { key: "orbit", title: "Orbit", fields: [
                { key: "radius", label: "Radius", step: 0.01, min: 0.0001 },
                { key: "orthographicScale", label: "Ortho", step: 0.01, min: 0.0001 },
                { key: "theta", label: "Theta°", step: 1 },
                { key: "phi", label: "Phi°", step: 1 },
            ]},
            { key: "target", title: "Target", fields: [
                { key: "target_x", label: "Target X", step: 0.01 },
                { key: "target_y", label: "Target Y", step: 0.01 },
                { key: "target_z", label: "Target Z", step: 0.01 },
            ]},
        ],
        setSavedCameraField,
        applyCurrentCamera,
        resetCamera,
        restoreSavedCamera,
        setAnimatorView,
        focusPivot,
    };
}

export const cameraProps = {
    layers: { type: Array, required: false, default: () => [] },
    selectedLayers: { type: Array, required: false, default: () => [] },
};
