import { markRaw, shallowRef } from "vue";

export const createAnimatorGizmoState = (overrides = {}) => markRaw({
    tool: "translate",
    axis: "free",
    pivot: "object",
    space: "world",
    showAxisHandles: true,
    showRotateRings: true,
    showScaleHandles: true,
    showPlaneHandles: false,
    showObjectPivot: true,
    showWorldPivot: true,
    showAxisGuide: true,
    showWorldAxis: false,
    pivotAction: "",
    pivotActionTick: 0,
    ...overrides,
});

export const createAnimatorCameraState = (overrides = {}) => markRaw({
    projection: "perspective",
    fov: 50,
    near: 0.01,
    far: 1000,
    radius: 4.6,
    orthographicScale: 5,
    theta: 0,
    phi: 0,
    target: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: -3.25, z: 0.18 },
    forward: { x: 0, y: 1, z: 0 },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    payload: null,
    ...overrides,
});

export const createAnimatorCameraCommand = (overrides = {}) => markRaw({
    apply: 0,
    frame: 0,
    reset: 0,
    restore: 0,
    toggleGrid: 0,
    projection: "",
    view: "",
    focusPivot: 0,
    field: null,
    fieldTick: 0,
    ...overrides,
});

// Compatibility exports for old callers. New code should pass these through props
// from App.vue -> Grid.vue -> Animator and update them via emitted events.
export const animatorGizmo = createAnimatorGizmoState();
export const animatorCameraState = createAnimatorCameraState();
export const animatorCameraCommand = createAnimatorCameraCommand();
export const animatorActiveLayerId = shallowRef("");
export const animatorObjectLayerId = shallowRef("");
