const toNumber = (value, fallback = 0) => {
    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
};

const asVector = (value, fallback = [0, 0, 0]) => {
    if (Array.isArray(value)) {
        return [
            toNumber(value[0], fallback[0]),
            toNumber(value[1], fallback[1]),
            toNumber(value[2], fallback[2]),
        ];
    }

    if (value && typeof value === "object") {
        return [
            toNumber(value.x, fallback[0]),
            toNumber(value.y, fallback[1]),
            toNumber(value.z, fallback[2]),
        ];
    }

    return [...fallback];
};

export const sceneToRendererVector = (value, fallback = [0, 0, 0]) => {
    const vector = asVector(value, fallback);

    return [
        vector[0],
        vector[2],
        vector[1],
    ];
};

export const rendererToSceneVector = sceneToRendererVector;

export const sceneToRendererGeometry = (geometry = {}) => ({
    ...geometry,

    position_x: toNumber(geometry.position_x, 0),
    position_y: toNumber(geometry.position_z, 0),
    position_z: toNumber(geometry.position_y, 0),

    pivot_x: toNumber(geometry.pivot_x, 0),
    pivot_y: toNumber(geometry.pivot_z, 0),
    pivot_z: toNumber(geometry.pivot_y, 0),

    scale_x: toNumber(geometry.scale_x, 1),
    scale_y: toNumber(geometry.scale_z, 1),
    scale_z: toNumber(geometry.scale_y, 1),

    rotation_x: toNumber(geometry.rotation_x, 0),
    rotation_y: toNumber(geometry.rotation_z, 0),
    rotation_z: toNumber(geometry.rotation_y, 0),
});

export const sceneToRendererCamera = (camera = {}) => ({
    ...camera,
    position: sceneToRendererVector(camera.position, [0, -3.25, 0.18]),
    target: sceneToRendererVector(camera.target, [0, 0, 0]),
    up: sceneToRendererVector(camera.up, [0, 0, 1]),
});
