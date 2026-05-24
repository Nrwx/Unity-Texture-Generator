export const GIZMO_MOUSE_POLICY = Object.freeze({
    selectButton: 0,
    transformButton: 2,
    orbitButton: 2,
});

export const GIZMO_AXIS_OPTIONS = Object.freeze([
    { key: "x", label: "X", components: ["x"] },
    { key: "y", label: "Y", components: ["y"] },
    { key: "z", label: "Z", components: ["z"] },
    { key: "xy", label: "XY", components: ["x", "y"] },
    { key: "xz", label: "XZ", components: ["x", "z"] },
    { key: "yz", label: "YZ", components: ["y", "z"] },
]);
