export const createAnimatorCameraState = (overrides = {}) => ({
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

export const createAnimatorCameraCommand = (overrides = {}) => ({
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

export const animatorCameraState = createAnimatorCameraState();
export const animatorCameraCommand = createAnimatorCameraCommand();

export let animatorActiveLayerId = "";