export const createAnimatorCameraState = (overrides = {}) => ({
    projection: "perspective",
    fov: 50,
    near: 0.01,
    far: 1000,
    radius: 4.6,
    orthographicScale: 5,
    theta: -Math.PI / 4,
    phi: 58 * Math.PI / 180,
    target: { x: 0, y: 0, z: 0 },
    position: { x: -1.7236637240151509, y: 1.7236637240151513, z: 3.901021242319559 },
    forward: { x: 0.374709505220685, y: -0.3747095052206851, z: -0.848048096156426 },
    right: { x: -0.7071067811865476, y: -0.7071067811865475, z: 0 },
    up: { x: 0.5996605595645501, y: -0.5996605595645502, z: 0.529919264233205 },
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