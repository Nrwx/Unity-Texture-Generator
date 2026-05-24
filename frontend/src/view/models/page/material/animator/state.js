import {reactive, ref} from "vue";

export const animatorGizmo = reactive({
    tool: "orbit",
    axis: "free",
    pivot: "object",
    space: "local",
});

export const animatorCameraState = reactive({
    projection: "perspective",
    fov: 50,
    near: 0.01,
    far: 1000,
    radius: 4.6,
    orthographicScale: 5,
    theta: 0,
    phi: 0,
    target: {x: 0, y: 0, z: 0},
    position: {x: 0, y: -3.25, z: 0.18},
    payload: null,
});

export const animatorCameraCommand = reactive({
    apply: 0,
    frame: 0,
    reset: 0,
    toggleGrid: 0,
    projection: "",
    view: "",
});

export const animatorActiveLayerId = ref("");
export const animatorObjectLayerId = ref("");
