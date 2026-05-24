import { computed } from "vue";
import { clone } from "@/utils/tools";
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
    target: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: -3.25, z: 0.18 },
    up: { x: 0, y: 0, z: 1 },
};

const toNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const normalizeCamera = camera => ({
    ...DEFAULT_CAMERA,
    ...(camera || {}),
    projection: camera?.projection === "orthographic" ? "orthographic" : "perspective",
    fov: toNumber(camera?.fov, DEFAULT_CAMERA.fov),
    near: toNumber(camera?.near, DEFAULT_CAMERA.near),
    far: toNumber(camera?.far, DEFAULT_CAMERA.far),
    radius: toNumber(camera?.radius, DEFAULT_CAMERA.radius),
    orthographic_scale: toNumber(camera?.orthographic_scale ?? camera?.orthographicScale, DEFAULT_CAMERA.orthographic_scale),
    orthographicScale: toNumber(camera?.orthographicScale ?? camera?.orthographic_scale, DEFAULT_CAMERA.orthographicScale),
});

export function cameraModel(props, emit) {
    const selectedMaterialLayers = computed(() => (props.selectedLayers || []).filter(layer => Number(layer?.type) === 5));

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

    const emitLayerUpdate = layer => emit("component-event", "mesh:update", clone(layer, "json"));

    const setLayerCamera = camera => {
        const layer = activeLayer.value;
        if (!layer) return;
        const payload = normalizeCamera(camera);
        layer.viewport_camera = payload;
        layer.settings = { ...(layer.settings || {}), animator_viewport: true, viewport_camera: payload };
        layer.preview = {
            ...(layer.preview || {}),
            animator_viewport: true,
            viewport_camera: payload,
            rotate: false,
            idle_rotation: { ...(layer.preview?.idle_rotation || {}), enabled: false },
        };
        layer.material = { ...(layer.material || {}), viewport_camera: payload };
        layer.shader = { ...(layer.shader || {}), viewport_camera: payload };
        emitLayerUpdate(layer);
    };

    const setSavedCameraField = (key, value) => {
        const camera = normalizeCamera(savedCamera.value);
        camera[key] = key === "projection" ? value : toNumber(value, DEFAULT_CAMERA[key] ?? 0);
        if (key === "orthographicScale") camera.orthographic_scale = camera.orthographicScale;
        if (key === "orthographic_scale") camera.orthographicScale = camera.orthographic_scale;
        if (key === "projection") animatorCameraCommand.projection = camera.projection;
        setLayerCamera(camera);
    };

    const applyCurrentCamera = () => {
        animatorCameraCommand.apply += 1;
        setLayerCamera(animatorCameraState.payload || animatorCameraState);
    };

    const setAnimatorView = view => { animatorCameraCommand.view = view; };
    const focusPivot = () => { animatorCameraCommand.focusPivot += 1; };

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
            ]},
        ],
        setSavedCameraField,
        applyCurrentCamera,
        setAnimatorView,
        focusPivot,
    };
}

export const cameraProps = {
    layers: { type: Array, required: false, default: () => [] },
    selectedLayers: { type: Array, required: false, default: () => [] },
};
