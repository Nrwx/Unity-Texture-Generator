import { Camera } from "@/view/models/page/material/core/Camera/Camera";

const toPlain = value => {
    if (value === null || value === undefined) {
        return value;
    }

    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

const writeRef = (target, payload = {}) => {
    if (!target || typeof target !== "object" || !("value" in target)) {
        return toPlain(payload || {});
    }

    target.value = {
        ...(target.value || {}),
        ...(toPlain(payload || {})),
    };

    return target.value;
};


const setPath = (target, path, value) => {
    const keys = String(path || "").split(".").filter(Boolean);

    if (!target || !keys.length) {
        return target;
    }

    let cursor = target;

    keys.slice(0, -1).forEach(key => {
        cursor[key] = {
            ...(cursor[key] || {}),
        };
        cursor = cursor[key];
    });

    cursor[keys[keys.length - 1]] = value;
    return target;
};

const getPayloadState = payload => toPlain(payload?.state || payload || {});

const writeCameraField = (route, key, value) => {
    if (!key) {
        return route.engineData.camera?.value || {};
    }

    const camera = {
        ...(route.engineData.camera?.value || {}),
    };
    const orbit = {
        ...(route.engineData.orbit?.value || {}),
    };

    if (key === "orthographicScale" || key === "orthographic_scale") {
        camera.orthographicScale = value;
        camera.orthographic_scale = value;
        orbit.orthographicScale = value;
        orbit.orthographic_scale = value;
    } else if (["radius", "theta", "phi"].includes(key)) {
        camera[key] = value;
        orbit[key] = value;
    } else if (String(key).startsWith("target_")) {
        const axis = String(key).slice(-1);
        camera.target = {
            ...(camera.target || {}),
            [axis]: value,
        };
        orbit.target = {
            ...(orbit.target || {}),
            [axis]: value,
        };
    } else {
        camera[key] = value;
    }

    if (route.engineData.camera?.value) {
        route.engineData.camera.value = camera;
    }

    if (route.engineData.orbit?.value) {
        route.engineData.orbit.value = orbit;
    }

    return camera;
};

const bumpCameraCommand = (route, key, extra = {}) => {
    const keyboard = route.engineData.keyboard || {};

    if (!key) {
        return keyboard;
    }

    Object.assign(keyboard, extra || {});
    keyboard[key] = Number(keyboard[key] || 0) + 1;
    route.engineData.keyboard = keyboard;

    return keyboard;
};

const writeCameraCommand = (route, payload = {}) => {
    const keyboard = route.engineData.keyboard || {};
    Object.assign(keyboard, toPlain(payload || {}));
    route.engineData.keyboard = keyboard;
    return keyboard;
};

export const engineEvent = route => ({
    "engine:set-camera": async payload => {
        route.engineSession.camera = new Camera(payload || {});
        await route.emit("engine:update-camera", payload || {});
        return route.engineSession.camera;
    },

    "engine:update-camera": async payload => {
        const next = writeRef(route.engineData.camera, payload);

        if (route.engineData.orbit?.value) {
            const cameraPayload = toPlain(payload || {});
            writeRef(route.engineData.orbit, {
                ...(cameraPayload.radius !== undefined ? { radius: cameraPayload.radius } : {}),
                ...(cameraPayload.theta !== undefined ? { theta: cameraPayload.theta } : {}),
                ...(cameraPayload.phi !== undefined ? { phi: cameraPayload.phi } : {}),
                ...(cameraPayload.target !== undefined ? { target: cameraPayload.target } : {}),
                ...(cameraPayload.orthographicScale !== undefined ? { orthographicScale: cameraPayload.orthographicScale } : {}),
                ...(cameraPayload.orthographic_scale !== undefined ? { orthographic_scale: cameraPayload.orthographic_scale } : {}),
            });
        }

        return next;
    },

    "engine:update-orbit": async payload => writeRef(route.engineData.orbit, payload),

    "camera:projection": async payload => {
        const projection = payload || "perspective";
        writeCameraField(route, "projection", projection);
        return writeCameraCommand(route, { projection });
    },

    "camera:field": async payload => {
        writeCameraField(route, payload?.key, payload?.value);
        return writeCameraCommand(route, {
            field: { key: payload?.key, value: payload?.value },
            fieldTick: Number(route.engineData.keyboard?.fieldTick || 0) + 1,
        });
    },

    "camera:view": async payload => writeCameraCommand(route, { view: payload || "front" }),

    "camera:action": async payload => {
        const action = payload || "apply";

        if (action === "apply") {
            return bumpCameraCommand(route, "apply");
        }

        if (action === "reset") {
            return bumpCameraCommand(route, "reset");
        }

        if (action === "restore") {
            return bumpCameraCommand(route, "restore");
        }

        if (action === "frame") {
            return bumpCameraCommand(route, "frame");
        }

        if (action === "focus-pivot") {
            return bumpCameraCommand(route, "focusPivot");
        }

        return bumpCameraCommand(route, "actionTick", { action });
    },

    "animator:gizmo": async payload => writeRef(route.engineData.gizmo, getPayloadState(payload)),

    "gizmo:tool": async payload => writeRef(route.engineData.gizmo, {
        tool: payload?.tool || "translate",
    }),

    "gizmo:axis": async payload => writeRef(route.engineData.gizmo, {
        axis: payload?.axis || "free",
        ...(payload?.tool ? { tool: payload.tool } : {}),
    }),

    "gizmo:pivot": async payload => writeRef(route.engineData.gizmo, {
        pivot: payload?.pivot || "object",
    }),

    "gizmo:visibility": async payload => writeRef(route.engineData.gizmo, {
        [payload?.key]: payload?.value === true,
    }),

    "gizmo:pivot-action": async payload => writeRef(route.engineData.gizmo, {
        pivotAction: payload?.action || "",
        pivotActionTick: (route.engineData.gizmo.value?.pivotActionTick || 0) + 1,
    }),

    "sculpt:brush": async payload => {
        const current = route.engineData.sculpt.value || {};
        const next = toPlain(payload || {});

        route.engineData.sculpt.value = {
            ...current,
            ...next,
            detail: {
                ...(current.detail || {}),
                ...(next.detail || {}),
            },
            stamp: {
                ...(current.stamp || {}),
                ...(next.stamp || {}),
            },
        };

        return route.engineData.sculpt.value;
    },

    "sculpt:field": async payload => {
        const next = {
            ...(route.engineData.sculpt.value || {}),
        };

        setPath(next, payload?.field, payload?.value);
        route.engineData.sculpt.value = next;
        return next;
    },

    "editor:view-mode": async payload => {
        const mode = payload || "world";

        writeRef(route.engineData.view, { mode });
        writeRef(route.engineData.camera, { viewMode: mode, renderMode: mode });

        if (route.engineData.edit?.value) {
            writeRef(route.engineData.edit, { viewMode: mode });
        }

        return mode;
    },

    "mesh-edit:mode": async payload => {
        if (route.meshStates?.edit) {
            route.meshStates.edit.value = true;
        }
        return writeRef(route.engineData.edit, {
            enabled: true,
            mode: payload || "vertex",
        });
    },

    "mesh-edit:tool": async payload => writeRef(route.engineData.edit, {
        tool: payload || "move",
    }),

    "mesh-edit:field": async payload => {
        const next = {
            ...(route.engineData.edit.value || {}),
        };

        setPath(next, payload?.field, payload?.value);
        route.engineData.edit.value = next;
        return next;
    },

    "mesh-edit:action": async payload => {
        if (payload === "tab-cycle" && route.meshStates?.edit) {
            route.meshStates.edit.value = !route.meshStates.edit.value;
        }
        return writeRef(route.engineData.edit, {
        operation: payload || "",
        operationTick: (route.engineData.edit.value?.operationTick || 0) + 1,
        });
    },

    "animator:camera-state": async payload => writeRef(route.engineData.camera, getPayloadState(payload)),
    "animator:camera-command": async payload => writeCameraCommand(route, getPayloadState(payload)),
    "animator:active-layer-id": async payload => writeRef(route.engineData.editor, { activeLayerId: payload || "" }),
    "animator:object-layer-id": async payload => writeRef(route.engineData.editor, { objectLayerId: payload || "" }),

    "editor:pick": async payload => writeRef(route.engineData.editor, {
        lastPick: toPlain(payload || {}),
    }),

    "editor:pick-clear": async payload => writeRef(route.engineData.editor, {
        lastPick: toPlain(payload || {}),
        selection: { objectId: "", face: null, edge: null, vertex: null },
    }),

    "mesh-edit:commit": async payload => toPlain(payload || {}),
    "sculpt:commit": async payload => toPlain(payload || {}),
});
