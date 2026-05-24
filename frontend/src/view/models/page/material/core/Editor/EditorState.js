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
            cursorPivot: { x: 0, y: 0, z: 0 },
            cursorPivotActive: false,
            worldPivot: { x: 0, y: 0, z: 0 },
            pivotPoint: { x: 0, y: 0, z: 0 },
            gizmoOrigin: { x: 0, y: 0, z: 0 },
            gizmoSize: 0.85,

            selection: {
                objectId: "",
                face: null,
                edge: null,
                vertex: null,
            },
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
            state.selection = EditorState.create().selection;
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

        state.cursorPivot = { x: 0, y: 0, z: 0 };
        state.cursorPivotActive = false;
        state.worldPivot = { x: 0, y: 0, z: 0 };
    }

    static setCursorPivot(state, point = {}) {
        if (!state) {
            return;
        }

        state.cursorPivot = {
            x: Number.isFinite(Number(point.x ?? point[0])) ? Number(point.x ?? point[0]) : 0,
            y: Number.isFinite(Number(point.y ?? point[1])) ? Number(point.y ?? point[1]) : 0,
            z: Number.isFinite(Number(point.z ?? point[2])) ? Number(point.z ?? point[2]) : 0,
        };
        state.cursorPivotActive = true;
        state.worldPivot = { x: 0, y: 0, z: 0 };
    }

    static clearLocalTransform(state) {
        if (state && state.localTransform) {
            state.localTransform = null;
        }
    }

    static clearSelection(state) {
        state.selection = {
            objectId: "",
            face: null,
            edge: null,
            vertex: null,
        };
        state.activeObjectId = "";
        state.hover = null;
        EditorState.resetCursorPivot(state);
    }
}
