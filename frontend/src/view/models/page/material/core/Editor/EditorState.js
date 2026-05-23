import {isFiniteNumber} from "@/utils/math";

const createVectorObject = () => ({ x: 0, y: 0, z: 0 });
const createSelection = () => ({ objectId: "", face: null, edge: null, vertex: null });

const toNumber = (value, fallback = 0) => {
    const number = Number(value);

    return isFiniteNumber(number) ? number : fallback;
};

export class EditorState {
    static create(overrides = {}) {
        return {
            enabled: true,
            mode: "object",
            selectionMode: "object",
            tool: "translate",
            axis: "free",
            pivotMode: "object",
            space: "world",
            active: false,
            dragging: false,
            hover: null,
            cursor: "default",
            activeObjectId: "",

            // Blender-like visual controls. These are visibility controls only.
            // They do not create new persisted backend properties.
            showObjectPivot: true,
            showWorldPivot: true,
            showTransformGizmo: true,
            showAxisHandles: true,
            showRotateRings: true,
            showScaleHandles: true,
            showPlaneHandles: false,
            showAxisGuide: true,

            // World is immutable scene origin. Cursor is a temporary Blender-like anchor.
            // Neither value is persisted to backend mesh payloads.
            cursorPivot: createVectorObject(),
            cursorPivotActive: false,
            worldPivot: createVectorObject(),
            pivotPoint: createVectorObject(),
            gizmoOrigin: createVectorObject(),
            gizmoSize: 0.85,

            selection: createSelection(),
            grid: {
                size: 12,
                divisions: 24,
                majorEvery: 4,
            },
            renderGrid: true,
            renderWorldAxis: false,
            renderPivot: true,
            renderGizmo: true,
            renderPlaneHandles: false,
            renderSelection: true,
            picking: {
                enabled: true,
                framebuffer: true,
                cpuFallback: true,
                edgeThreshold: 0.075,
                vertexThreshold: 0.09,
                gizmoThreshold: 0.34,
                ringThreshold: 0.18,
                axisThreshold: 0.22,
                pointThreshold: 0.24,
            },
            ...overrides,
        };
    }

    static setSelection(state, selection = {}) {
        if (!state.selection) {
            state.selection = createSelection();
        }

        state.selection = {
            ...state.selection,
            ...selection,
        };

        state.activeObjectId = state.selection.objectId || "";
        return state.selection;
    }

    static resetCursorPivot(state) {
        if (!state) {
            return;
        }

        state.cursorPivot = createVectorObject();
        state.cursorPivotActive = false;
        state.worldPivot = createVectorObject();
    }

    static setCursorPivot(state, point = {}) {
        if (!state) {
            return;
        }

        state.cursorPivot = {
            x: toNumber(point.x ?? point[0], 0),
            y: toNumber(point.y ?? point[1], 0),
            z: toNumber(point.z ?? point[2], 0),
        };
        state.cursorPivotActive = true;
        state.worldPivot = createVectorObject();
    }

    static clearLocalTransform(state) {
        if (state?.localTransform) {
            state.localTransform = null;
        }
    }

    static clearSelection(state) {
        if (!state) {
            return;
        }

        state.selection = createSelection();
        state.activeObjectId = "";
        state.hover = null;
        EditorState.resetCursorPivot(state);
    }
}
