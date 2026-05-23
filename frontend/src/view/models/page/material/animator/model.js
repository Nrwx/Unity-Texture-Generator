import {computed, nextTick, onBeforeUnmount, onMounted, reactive, ref} from "vue";
import {uuid} from "@/utils/uuid";
import {eventRegister} from "@/dataLayer/event";
import {useMouse} from "@/composables/mouse/model";
import {clamp, clone} from "@/utils/tools";
import {Accumulator} from "@/view/models/page/material/core/Accumulator/Accumulator";
import {Camera} from "@/view/models/page/material/core/Camera/Camera";
import {Vector} from "@/view/models/page/material/core/Math/Vector/Vector";
import {TransformController} from "@/view/models/page/material/core/Editor/TransformController";
import {PickingController} from "@/view/models/page/material/core/Editor/PickingController";
import {GizmoGeometry} from "@/view/models/page/material/core/Editor/GizmoGeometry";
import {Ray} from "@/view/models/page/material/core/Ray/Ray";
import {applySculptBrushToMesh, buildSculptBrushOverlay, createDefaultSculptBrush} from "@/view/models/page/material/brush/mesh";
import {applyMeshEditOperation, buildMeshEditOverlay, buildMeshEditTopology, clearMeshEditSelection, getMeshEditSelectionPivot, nextMeshEditTabState, normalizeMeshEditMode, normalizeMeshEditViewMode, selectMeshEditHit, transformMeshEditSelection} from "@/view/models/page/material/meshEdit/model";
import {CoordinateSystem} from "@/models/layer/3D/core/coordinate/model";
import {DEG, isFiniteNumber, number} from "@/utils/math";

const WORLD_PIVOT = Object.freeze({ x: 0, y: 0, z: 0 });
const TAU = Math.PI * 2;

const normalizeAngleRad = value => {
    const n = number(value, 0);
    const normalized = ((n + Math.PI) % TAU + TAU) % TAU - Math.PI;

    return normalized === -Math.PI ? Math.PI : normalized;
};

const normalizeAngleDeg = value => {
    const n = number(value, 0);
    const normalized = ((n + 180) % 360 + 360) % 360 - 180;

    return normalized === -180 ? 180 : normalized;
};

const clampPointerDelta = value => clamp(number(value, 0), -2048, 2048);

const buildRendererPickCamera = (cameraPayload = {}, viewport = { width: 1, height: 1 }) => {
    const viewProjectionMatrix =
        CoordinateSystem.buildViewProjectionMatrix(cameraPayload, viewport);

    return {
        viewProjectionMatrix
    };
};

const normalizeMeshSettings = settings => ({
    ...(settings || {}),

    position_x: number(settings?.position_x, 0),
    position_y: number(settings?.position_y, 0),
    position_z: number(settings?.position_z, 0),

    rotation_x: number(settings?.rotation_x, 0),
    rotation_y: number(settings?.rotation_y, 0),
    rotation_z: number(settings?.rotation_z, 0),

    scale_x: number(settings?.scale_x, 1),
    scale_y: number(settings?.scale_y, 1),
    scale_z: number(settings?.scale_z, 1),

    pivot_x: number(settings?.pivot_x, 0),
    pivot_y: number(settings?.pivot_y, 0),
    pivot_z: number(settings?.pivot_z, 0),
});

export function animatorModel(props, emit) {

    const session = ref({
        id: uuid('engine-session')
    })

    const ui = ref({
        root: {
            id: uuid('engine-root'),
            ref: null,
        },
        viewport: {
            id: uuid('engine-viewport'),
            ref: null,
        },
        pointer: {
            active: false,
            pointerId: null,
            button: -1,
            mode: "",
            x: 0,
            y: 0,
            startX: 0,
            startY: 0,
            moved: false,
        },
    });

    const temp = ref({
        rafId: 0,
        activeLayerId: '',
        lastFrameTime: 0,
        transform: {
            session: null,
            revision: 0
        },
        edit: {
            session: null,
            layer: null
        },
        sculpt: {
            session: null,
            lastPoint: null,
            lastHit: null
        },
        commands: {
            selectedLayersSignature: "",
            apply: 0,
            frame: 0,
            reset: 0,
            restore: 0,
            toggleGrid: 0,
            fieldTick: 0,
            focusPivot: 0,
            projection: "",
            view: "",
            pivotActionTick: 0,
            operationTick: 0,
            viewMode: ""
        }
    });

    const clock = new Accumulator();

    const emitEvent = (event, payload) => {emit("update:component-event", event, payload);};

    const setEditorSelection = selection => {
        props.editorConfig.selection = {
            objectId: "",
            face: null,
            edge: null,
            vertex: null,
            ...(selection || {}),
        };
        props.editorConfig.activeObjectId = props.editorConfig.selection.objectId || "";
    };

    const clearEditorSelection = () => {
        props.editorConfig.selection = { objectId: "", face: null, edge: null, vertex: null };
        props.editorConfig.activeObjectId = "";
    };

    const setCursorPivotState = point => {
        props.editorConfig.cursorPivot = {
            x: number(point?.x ?? point?.[0], 0),
            y: number(point?.y ?? point?.[1], 0),
            z: number(point?.z ?? point?.[2], 0),
        };
        props.editorConfig.cursorPivotActive = true;
    };

    const resetCursorPivotState = () => {
        props.editorConfig.cursorPivot = { x: 0, y: 0, z: 0 };
        props.editorConfig.cursorPivotActive = false;
    };

    const isMeshEditStateActive = () => props.meshStates?.edit?.value === true || props.editConfig.enabled === true;
    const setMeshEditStateActive = enabled => {
        if (props.meshStates?.edit) {
            props.meshStates.edit.value = enabled === true;
        }
        props.editConfig.enabled = enabled === true;
    };
    const isSculptStateActive = () => props.meshStates?.sculpt?.value === true || props.sculptConfig.enabled === true;
    const setSculptStateActive = enabled => {
        if (props.meshStates?.sculpt) {
            props.meshStates.sculpt.value = enabled === true;
        }
        props.sculptConfig.enabled = enabled === true;
    };

    const { register } = eventRegister("listener:animator", emitEvent);

    const mouse = useMouse({register, elementId: ui.value.viewport.id, mode: "local"});

    const keys = reactive({shift: false, alt: false, ctrl: false, meta: false,});


    const transformController = new TransformController();

    let localTransformDirty = false;
    let cameraDirty = false;

    const markLocalTransformDirty = () => {
        localTransformDirty = true;
        temp.value.transform.revision += 1;
    };

    const toVectorObject = (value, fallback = { x: 0, y: 0, z: 0 }) => ({
        x: number(value?.x ?? value?.[0], fallback.x),
        y: number(value?.y ?? value?.[1], fallback.y),
        z: number(value?.z ?? value?.[2], fallback.z),
    });

    const createCameraFromConfig = () => Camera.fromPayload({
        ...(props.orbitConfig || {}),
        ...(props.cameraConfig || {}),
        orthographicScale:
            props.cameraConfig?.orthographicScale ??
            props.cameraConfig?.orthographic_scale ??
            props.orbitConfig?.orthographicScale ??
            5,
        orthographic_scale:
            props.cameraConfig?.orthographic_scale ??
            props.cameraConfig?.orthographicScale ??
            props.orbitConfig?.orthographicScale ??
            5,
        orbit: {
            ...(props.orbitConfig || {}),
            radius: props.orbitConfig?.radius ?? props.cameraConfig?.radius ?? 4.6,
            theta: props.orbitConfig?.theta ?? props.cameraConfig?.theta ?? -Math.PI / 4,
            phi: props.orbitConfig?.phi ?? props.cameraConfig?.phi ?? 58 * DEG,
            target: props.orbitConfig?.target ?? props.cameraConfig?.target ?? { x: 0, y: 0, z: 0 },
            minRadius: props.orbitConfig?.minRadius ?? 0.18,
            maxRadius: props.orbitConfig?.maxRadius ?? 250,
            minPhi: props.orbitConfig?.minPhi ?? -89.5 * DEG,
            maxPhi: props.orbitConfig?.maxPhi ?? 89.5 * DEG,
        },
    });

    const getCameraCore = () => {
        if (!props.engineSession.camera) {
            props.engineSession.camera = createCameraFromConfig();
        }

        return props.engineSession.camera;
    };

    const readCameraState = () => {
        const core = getCameraCore();
        const orbit = core.orbit || {};
        const target = orbit.target?.toObject?.() || toVectorObject(props.cameraConfig?.target);
        const smoothTarget = orbit.smoothTarget?.toObject?.() || toVectorObject(props.orbitConfig?.smoothTarget, target);
        const position = core.position?.toObject?.() || toVectorObject(props.cameraConfig?.position, { x: -1.7236637240151509, y: 1.7236637240151513, z: 3.901021242319559 });
        const forward = orbit.forward?.toObject?.() || toVectorObject(props.cameraConfig?.forward, { x: 0.374709505220685, y: -0.3747095052206851, z: -0.848048096156426 });
        const right = orbit.right?.toObject?.() || toVectorObject(props.cameraConfig?.right, { x: -0.7071067811865476, y: -0.7071067811865475, z: 0 });
        const up = orbit.up?.toObject?.() || toVectorObject(props.cameraConfig?.up, { x: 0, y: 0, z: 1 });

        return {
            projection: core.projection || props.cameraConfig?.projection || "perspective",
            fov: number(core.fov, props.cameraConfig?.fov ?? 50),
            near: number(core.near, props.cameraConfig?.near ?? 0.01),
            far: number(core.far, props.cameraConfig?.far ?? 1000),
            theta: normalizeAngleRad(number(orbit.theta, props.cameraConfig?.theta ?? props.orbitConfig?.theta ?? -Math.PI / 4)),
            phi: number(orbit.phi, props.cameraConfig?.phi ?? props.orbitConfig?.phi ?? 58 * DEG),
            radius: number(orbit.radius, props.cameraConfig?.radius ?? props.orbitConfig?.radius ?? 4.6),
            orthographicScale: number(core.orthographicScale, props.cameraConfig?.orthographicScale ?? props.orbitConfig?.orthographicScale ?? 5),
            smoothTheta: normalizeAngleRad(number(orbit.smoothTheta, props.orbitConfig?.smoothTheta ?? orbit.theta ?? -Math.PI / 4)),
            smoothPhi: number(orbit.smoothPhi, props.orbitConfig?.smoothPhi ?? orbit.phi ?? 58 * DEG),
            smoothRadius: number(orbit.smoothRadius, props.orbitConfig?.smoothRadius ?? orbit.radius ?? 4.6),
            smoothOrthographicScale: number(core.orthographicScale, props.orbitConfig?.smoothOrthographicScale ?? props.cameraConfig?.orthographicScale ?? 5),
            target,
            smoothTarget,
            position,
            forward,
            right,
            up,
            backgroundGrid: core.backgroundGrid !== false,
            showAxisGizmo: props.orbitConfig?.showAxisGizmo !== false,
        };
    };

    const writeCameraConfig = (state, payload = {}) => {
        Object.assign(props.cameraConfig, {
            projection: state.projection,
            fov: state.fov,
            near: state.near,
            far: state.far,
            radius: state.radius,
            orthographicScale: state.orthographicScale,
            orthographic_scale: state.orthographicScale,
            theta: state.theta,
            phi: state.phi,
            target: { ...state.target },
            position: { ...state.position },
            forward: { ...state.forward },
            right: { ...state.right },
            up: { ...state.up },
            backgroundGrid: state.backgroundGrid,
            showAxisGizmo: state.showAxisGizmo,
            payload: {
                ...getCameraCore().toViewportCamera(),
                orthographic_scale: state.orthographicScale,
                target: { ...state.target },
                position: { ...state.position },
                forward: { ...state.forward },
                right: { ...state.right },
                up: { ...state.up },
                ...(payload || {}),
            },
        });
    };

    const syncCameraState = () => {
        const core = getCameraCore();
        core.setViewport(props.viewport.width, props.viewport.height);
        writeCameraConfig(readCameraState());
    };

    const setCameraCore = (nextCamera = {}) => {
        if (!nextCamera) {
            return false;
        }

        props.engineSession.camera = nextCamera;
        getCameraCore().setViewport(props.viewport.width, props.viewport.height);
        getCameraCore().update(1 / 60);

        syncCameraState();

        return true;
    };

    const activeLayer = computed(() => (props.selectedLayers.find(layer => layer.id === temp.value.activeLayerId) || props.selectedLayers[0] || null));
    const objectGizmoLayer = computed(() => (props.selectedLayers.find(layer => layer.id === temp.value.activeLayerId) || null));

    const viewportCamera = computed(() => {
        const state = readCameraState();

        return {
            ...getCameraCore().toViewportCamera(),
            orthographic_scale: state.smoothOrthographicScale,
            target: { ...state.smoothTarget },
            position: { ...state.position },
            forward: { ...state.forward },
            right: { ...state.right },
            up: { ...state.up },
        };
    });

    const resolveLayerViewportCamera = layer => (layer?.viewport_camera || layer?.settings?.viewport_camera || layer?.preview?.viewport_camera || layer?.material?.viewport_camera || layer?.shader?.viewport_camera || null);

    const writeViewportCameraToLayer = (layer, payload = viewportCamera.value) => {
        if (!layer?.id || !payload) {
            return null;
        }

        const cameraPayload = clone(payload, "json");

        layer.viewport_camera = cameraPayload;
        layer.settings = {
            ...(layer.settings || {}),
            animator_viewport: true,
            viewport_camera: cameraPayload,
        };
        layer.preview = {
            ...(layer.preview || {}),
            animator_viewport: true,
            viewport_camera: cameraPayload,
        };
        layer.material = {
            ...(layer.material || {}),
            viewport_camera: cameraPayload,
        };
        layer.shader = {
            ...(layer.shader || {}),
            viewport_camera: cameraPayload,
        };

        return cameraPayload;
    };

    const applyViewportCameraToCore = payload => {
        if (!payload) {
            return false;
        }

        const nextCamera = Camera.fromPayload({
            ...props.orbitConfig,
            ...(payload || {}),
            orthographicScale:
                payload.orthographicScale ??
                payload.orthographic_scale ??
                props.orbitConfig.orthographicScale,
            orthographic_scale:
                payload.orthographic_scale ??
                payload.orthographicScale ??
                props.orbitConfig.orthographicScale,
        });

        nextCamera.backgroundGrid =
            payload.backgroundGrid ??
            props.engineSession.camera?.backgroundGrid ??
            props.orbitConfig.backgroundGrid;

        cameraDirty = false;

        return setCameraCore(nextCamera);
    };


    const loadCameraFromLayer = (layer, { force = false } = {}) => {
        if (!layer?.id) {
            return false;
        }

        const payload = resolveLayerViewportCamera(layer);

        if (!payload) {
            temp.value.activeLayerId = layer.id;
            syncCameraState();
            return false;
        }

        if (!force && temp.value.activeLayerId === layer.id) {
            return true;
        }

        temp.value.activeLayerId = layer.id;
        return applyViewportCameraToCore(payload);
    };

    const loadCameraFromActiveLayer = (options = {}) => loadCameraFromLayer(activeLayer.value, options);

    const markCameraDirty = () => {
        cameraDirty = true;
        syncCameraState();
    };

    const animatedLayers = computed(() => {
        const cameraPayload = viewportCamera.value;
        syncEditorVisualState(activeLayer.value);

        return props.selectedLayers.map(layer => {
            const sourceLayer = temp.value.edit.layer?.id === layer.id ? temp.value.edit.layer : layer;
            const cloned = clone(sourceLayer, "json");
            const geometry = normalizeMeshSettings(
                layer.geometry ||
                layer.mesh?.settings ||
                {}
            );
            const mesh = {
                ...(cloned.mesh || {}),
                settings: {
                    ...normalizeMeshSettings(cloned.mesh?.settings),
                    ...geometry,
                },
            };

            return {
                ...cloned,

                width: props.viewport.width || cloned.width || 512,
                height: props.viewport.height || cloned.height || 512,

                time: props.timelineTime,

                geometry,

                mesh,

                shader: {
                    ...(cloned.shader || {}),
                    geometry: {
                        ...(cloned.shader?.geometry || {}),
                        ...geometry,
                    },
                    mesh,
                    viewport_camera: cameraPayload,
                },

                material: {
                    ...(cloned.material || {}),
                    geometry: {
                        ...(cloned.material?.geometry || {}),
                        ...geometry,
                    },
                    mesh,
                    viewport_camera: cameraPayload,
                },

                preview: {
                    ...(cloned.preview || {}),
                    viewport_camera: cameraPayload,
                },

                settings: {
                    ...(cloned.settings || {}),
                    viewport_camera: cameraPayload,
                    animator_viewport: true,
                    animator_active: cloned.id === activeLayer.value?.id,
                },

                viewport_camera: cameraPayload,
            };
        });
    });

    const isActiveLayer = layer => layer?.id && activeLayer.value?.id === layer.id;


    const createAnimatorMeshPayload = layer => {
        if (!layer?.id) {
            return null;
        }

        const geometry = normalizeMeshSettings(
            layer.geometry ||
            layer.mesh?.settings ||
            {}
        );
        const mesh = {
            ...(layer.mesh || {}),
            settings: {
                ...(layer.mesh?.settings || {}),
                ...geometry,
            },
        };
        const cameraPayload = writeViewportCameraToLayer(layer, viewportCamera.value);

        return clone({
            id: layer.id,
            name: layer.name,
            width: layer.width,
            height: layer.height,
            hidden: layer.hidden,
            opacity: layer.opacity,
            order: layer.order,
            matrix: layer.matrix,
            keyframes: layer.keyframes,
            geometry,
            mesh,
            settings: {
                ...(layer.settings || {}),
                animator_viewport: true,
                viewport_camera: cameraPayload,
            },
            preview: {
                ...(layer.preview || {}),
                animator_viewport: true,
                viewport_camera: cameraPayload,
            },
            viewport_camera: cameraPayload,
            material: {
                ...(layer.material || {}),
                geometry: {
                    ...(layer.material?.geometry || {}),
                    ...geometry,
                },
                mesh,
                viewport_camera: cameraPayload,
            },
            shader: {
                ...(layer.shader || {}),
                geometry: {
                    ...(layer.shader?.geometry || {}),
                    ...geometry,
                },
                mesh,
                viewport_camera: cameraPayload,
            },
            particle_system: layer.particle_system,
        }, "json");
    };

    const commitLayer = layer => {
        const payload = createAnimatorMeshPayload(layer);

        if (!payload) {
            return false;
        }

        emitEvent("mesh:update", payload);
        localTransformDirty = false;
        cameraDirty = false;

        return true;
    };

    const commitActiveLayerState = ({ force = false } = {}) => {
        if (force || cameraDirty || localTransformDirty ) {
            return commitLayer(activeLayer.value);
        }

        return false;
    };


    const cloneLayerForLocalMeshEdit = layer => {
        const draft = clone(layer, "json");
        const geometry = normalizeMeshSettings(draft.geometry || draft.mesh?.settings || {});

        draft.geometry = geometry;
        draft.mesh = {
            ...(draft.mesh || {}),
            settings: {
                ...(draft.mesh?.settings || {}),
                ...geometry,
            },
            meta: {
                ...(draft.mesh?.meta || {}),
                localEditDraft: true,
                localEditSourceId: layer.id,
            },
        };
        draft.material = {
            ...(draft.material || {}),
            mesh: draft.mesh,
        };
        draft.shader = {
            ...(draft.shader || {}),
            mesh: draft.mesh,
        };

        return draft;
    };

    const ensureMeshEditDraftLayer = () => {
        const layer = activeLayer.value;

        if (!layer?.id || !layer.mesh) {
            temp.value.edit.layer = null;
            return null;
        }

        if (!temp.value.edit.layer) {
            temp.value.edit.layer = cloneLayerForLocalMeshEdit(layer);
        }

        return temp.value.edit.layer;
    };

    const getMeshEditLayer = () => (
        isMeshEditStateActive()
            ? (ensureMeshEditDraftLayer() || activeLayer.value)
            : activeLayer.value
    );

    const clearMeshEditDraftLayer = () => {
        temp.value.edit.layer = null;
    };

    const commitDraftLayerWithEvent = (eventName = "mesh:update") => {
        if (!temp.value.edit.layer?.id) {
            return false;
        }

        const payload = createAnimatorMeshPayload(temp.value.edit.layer);

        if (!payload) {
            return false;
        }

        emitEvent(eventName, payload);
        localTransformDirty = false;
        cameraDirty = false;
        clearMeshEditDraftLayer();

        return true;
    };

    const commitMeshEditDraftLayer = () => commitDraftLayerWithEvent("mesh-edit:commit");
    const commitSculptDraftLayer = () => commitDraftLayerWithEvent("sculpt:commit");

    const meshEditActive = () => isMeshEditStateActive() && Boolean((temp.value.edit.layer || activeLayer.value)?.mesh);

    const refreshMeshEditOverlay = () => {
        const layer = getMeshEditLayer();
        props.editorConfig.meshEdit = buildMeshEditOverlay({
            mesh: layer?.mesh,
            geometry: layer?.geometry || layer?.mesh?.settings || {},
            state: props.editConfig,
        });
    };

    const setMeshEditEnabled = enabled => {
        setMeshEditStateActive(enabled);

        if (isMeshEditStateActive()) {
            ensureMeshEditDraftLayer();
            props.editConfig.mode = normalizeMeshEditMode(props.editConfig.mode);
            props.editorConfig.tool = "mesh-edit";
            props.editorConfig.axis = "free";
            props.gizmoConfig.axis = "free";
        } else {
            commitMeshEditDraftLayer();
            clearMeshEditSelection(props.editConfig);
        }

        refreshMeshEditOverlay();
        syncEditorVisualState(activeLayer.value);
        return isMeshEditStateActive();
    };

    const setEditorViewMode = mode => {
        const viewMode = normalizeMeshEditViewMode(mode);
        props.editConfig.viewMode = viewMode;
        props.editorConfig.viewMode = viewMode;
        syncEditorVisualState(activeLayer.value);
        return viewMode;
    };

    const toggleMeshEditMode = () => {
        const next = nextMeshEditTabState(props.editConfig);
        const leavingEditMode = isMeshEditStateActive() && next.enabled !== true;

        if (leavingEditMode) {
            commitMeshEditDraftLayer();
        }

        setMeshEditStateActive(next.enabled);
        props.editConfig.mode = next.mode;

        if (isMeshEditStateActive()) {
            ensureMeshEditDraftLayer();
            props.editConfig.tool = props.editConfig.tool || "move";
            setEditorViewMode(props.editConfig.viewMode || "wireframe");
            props.editorConfig.tool = "mesh-edit";
            props.gizmoConfig.axis = "free";
        } else {
            clearMeshEditSelection(props.editConfig);
        }

        refreshMeshEditOverlay();
        syncEditorVisualState(getMeshEditLayer());
        return isMeshEditStateActive();
    };

    const setMeshEditMode = mode => {
        setMeshEditStateActive(true);
        ensureMeshEditDraftLayer();
        props.editConfig.mode = normalizeMeshEditMode(mode);
        refreshMeshEditOverlay();
        syncEditorVisualState(activeLayer.value);
        return props.editConfig.mode;
    };

    const runMeshEditOperation = (action, payload = {}) => {
        const result = applyMeshEditOperation({
            state: props.editConfig,
            layer: getMeshEditLayer(),
            action,
            payload,
        });

        if (result?.message) {
            props.editConfig.lastError = result.changed ? "" : result.message;
            props.editConfig.lastAction = result.message;
        }

        refreshMeshEditOverlay();
        syncEditorVisualState(activeLayer.value);

        if (result?.changed) {
            markLocalTransformDirty();
        }

        return result;
    };

    const isMeshEditHitSelected = hit => {
        if (!hit || !props.editConfig.selection) {
            return false;
        }

        const mode = normalizeMeshEditMode(props.editConfig.mode);

        if (mode === "vertex" && Number.isInteger(hit.index)) {
            return (props.editConfig.selection.vertices || []).map(String).includes(String(hit.index));
        }

        if (mode === "edge" && Array.isArray(hit.indices) && hit.indices.length >= 2) {
            const key = hit.indices[0] < hit.indices[1]
                ? `${hit.indices[0]}:${hit.indices[1]}`
                : `${hit.indices[1]}:${hit.indices[0]}`;
            return (props.editConfig.selection.edges || []).includes(key);
        }

        if (mode === "face" && Number.isInteger(hit.triangleIndex)) {
            return (props.editConfig.selection.faces || []).map(String).includes(String(hit.triangleIndex));
        }

        return false;
    };

    const projectScenePointToScreen = (point, viewport = props.viewport) => {
        if (!Array.isArray(point)) {
            return null;
        }

        const cameraPayload = buildRendererPickCamera(viewportCamera.value, viewport);
        const matrix = cameraPayload.viewProjectionMatrix;
        const rendererPoint = CoordinateSystem.sceneToRendererVector(point);
        const projected = matrix?.transformPoint
            ? matrix.transformPoint(rendererPoint, 1)
            : null;

        if (!projected) {
            return null;
        }

        const w = Math.abs(number(projected.w, 1)) > 0.000001 ? number(projected.w, 1) : 1;
        const ndcX = number(projected.x, 0) / w;
        const ndcY = number(projected.y, 0) / w;

        if (!isFiniteNumber(ndcX) || !isFiniteNumber(ndcY)) {
            return null;
        }

        return {
            x: (ndcX * 0.5 + 0.5) * Math.max(1, viewport.width),
            y: (1 - (ndcY * 0.5 + 0.5)) * Math.max(1, viewport.height),
        };
    };

    const distanceToSegment2D = (point, a, b) => {
        if (!point || !a || !b) {
            return Infinity;
        }

        const vx = b.x - a.x;
        const vy = b.y - a.y;
        const wx = point.x - a.x;
        const wy = point.y - a.y;
        const lenSq = vx * vx + vy * vy;
        const t = lenSq <= 0.000001 ? 0 : Math.min(1, Math.max(0, (wx * vx + wy * vy) / lenSq));
        const px = a.x + vx * t;
        const py = a.y + vy * t;

        return Math.hypot(point.x - px, point.y - py);
    };

    const pointInTriangle2D = (point, a, b, c) => {
        if (!point || !a || !b || !c) {
            return false;
        }

        const area = (p1, p2, p3) => (
            (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) * 0.5
        );
        const total = Math.abs(area(a, b, c));

        if (total <= 0.000001) {
            return false;
        }

        const a0 = Math.abs(area(point, b, c));
        const a1 = Math.abs(area(a, point, c));
        const a2 = Math.abs(area(a, b, point));

        return Math.abs((a0 + a1 + a2) - total) <= Math.max(0.5, total * 0.035);
    };

    const pickMeshEditElement = event => {
        if (!meshEditActive()) {
            return null;
        }

        const layer = getMeshEditLayer();
        const local = localPointerFromEvent(event);

        if (!layer?.mesh || !local) {
            return null;
        }

        const topology = buildMeshEditTopology(
            layer.mesh,
            layer.geometry || layer.mesh?.settings || {},
        );
        const pointerPoint = { x: local.x, y: local.y };
        const mode = normalizeMeshEditMode(props.editConfig.mode);

        if (mode === "vertex") {
            let best = null;
            const threshold = Math.max(8, number(props.editorConfig.picking?.vertexPixelThreshold, 12));

            topology.vertices.forEach(vertex => {
                const screen = projectScenePointToScreen(vertex.point);

                if (!screen) {
                    return;
                }

                const distance = Math.hypot(pointerPoint.x - screen.x, pointerPoint.y - screen.y);

                if (distance <= threshold && (!best || distance < best.distance)) {
                    best = {
                        type: "vertex",
                        index: vertex.index,
                        point: vertex.point,
                        distance,
                        objectId: layer.id,
                    };
                }
            });

            return best;
        }

        if (mode === "edge") {
            let best = null;
            const threshold = Math.max(7, number(props.editorConfig.picking?.edgePixelThreshold, 10));

            topology.edges.forEach(edge => {
                if (!Array.isArray(edge.points) || edge.points.length < 2) {
                    return;
                }

                const a = projectScenePointToScreen(edge.points[0]);
                const b = projectScenePointToScreen(edge.points[1]);
                const distance = distanceToSegment2D(pointerPoint, a, b);

                if (distance <= threshold && (!best || distance < best.distance)) {
                    best = {
                        type: "edge",
                        key: edge.key,
                        indices: edge.indices,
                        points: edge.points,
                        distance,
                        objectId: layer.id,
                    };
                }
            });

            return best;
        }

        let bestFace = null;

        topology.faces.forEach(face => {
            if (!Array.isArray(face.points) || face.points.length < 3) {
                return;
            }

            const a = projectScenePointToScreen(face.points[0]);
            const b = projectScenePointToScreen(face.points[1]);
            const c = projectScenePointToScreen(face.points[2]);

            if (!pointInTriangle2D(pointerPoint, a, b, c)) {
                return;
            }

            const centroid = {
                x: (a.x + b.x + c.x) / 3,
                y: (a.y + b.y + c.y) / 3,
            };
            const distance = Math.hypot(pointerPoint.x - centroid.x, pointerPoint.y - centroid.y);

            if (!bestFace || distance < bestFace.distance) {
                bestFace = {
                    type: "face",
                    triangleIndex: face.index,
                    indices: face.indices,
                    points: face.points,
                    distance,
                    objectId: layer.id,
                };
            }
        });

        return bestFace;
    };

    const selectMeshEditElement = event => {
        const hit = pickMeshEditElement(event);
        const changed = selectMeshEditHit({
            state: props.editConfig,
            hit,
            additive: event?.shiftKey === true,
        });

        if (!hit && event?.shiftKey !== true) {
            clearMeshEditSelection(props.editConfig);
        }

        refreshMeshEditOverlay();
        syncEditorVisualState(getMeshEditLayer());
        return changed;
    };

    const meshEditWorldDeltaFromPointer = (dx = 0, dy = 0) => {
        const state = readCameraState();
        const height = Math.max(1, props.viewport.height || 1);
        const perspectiveScale = Math.tan((state.fov || 50) * DEG * 0.5) * Math.max(0.001, state.radius || 1) * 2 / height;
        const orthoScale = Math.max(0.001, state.orthographicScale || 5) / height;
        const amount = state.projection === "orthographic" ? orthoScale : perspectiveScale;
        const right = state.right || { x: -0.7071067811865476, y: -0.7071067811865475, z: 0 };
        const up = state.up || { x: 0, y: 0, z: 1 };

        return [
            (right.x * dx - up.x * dy) * amount,
            (right.y * dx - up.y * dy) * amount,
            (right.z * dx - up.z * dy) * amount,
        ];
    };

    const rayPlaneIntersection = (ray, point, normal) => {
        const origin = ray?.origin || [0, 0, 0];
        const dir = ray?.dir || ray?.direction || [0, 1, 0];
        const denom = dir[0] * normal[0] + dir[1] * normal[1] + dir[2] * normal[2];

        if (Math.abs(denom) < 0.000001) {
            return null;
        }

        const distance = (
            (point[0] - origin[0]) * normal[0] +
            (point[1] - origin[1]) * normal[1] +
            (point[2] - origin[2]) * normal[2]
        ) / denom;

        if (!isFiniteNumber(distance)) {
            return null;
        }

        return [
            origin[0] + dir[0] * distance,
            origin[1] + dir[1] * distance,
            origin[2] + dir[2] * distance,
        ];
    };

    const rotateVectorX = (value, angle) => {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return [value[0], value[1] * c - value[2] * s, value[1] * s + value[2] * c];
    };

    const rotateVectorY = (value, angle) => {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return [value[0] * c + value[2] * s, value[1], -value[0] * s + value[2] * c];
    };

    const rotateVectorZ = (value, angle) => {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return [value[0] * c - value[1] * s, value[0] * s + value[1] * c, value[2]];
    };

    const worldDeltaToLocalMeshDelta = (worldDelta, geometry = {}) => {
        const sx = Math.max(0.000001, Math.abs(number(geometry.width, 1) * number(geometry.scale_x, 1)));
        const sy = Math.max(0.000001, Math.abs(number(geometry.height, 1) * number(geometry.scale_y, 1)));
        const sz = Math.max(0.000001, Math.abs(number(geometry.depth, 1) * number(geometry.scale_z, 1)));
        const rx = number(geometry.rotation_x, 0) * DEG;
        const ry = number(geometry.rotation_y, 0) * DEG;
        const rz = number(geometry.rotation_z, 0) * DEG;
        let value = [worldDelta[0], worldDelta[1], worldDelta[2]];

        value = rotateVectorZ(value, -rz);
        value = rotateVectorY(value, -ry);
        value = rotateVectorX(value, -rx);

        return [value[0] / sx, value[1] / sy, value[2] / sz];
    };

    const resolveMeshEditSelectionPivot = () => {
        const layer = getMeshEditLayer();
        const pivot = getMeshEditSelectionPivot({
            state: props.editConfig,
            mesh: layer?.mesh,
            geometry: layer?.geometry || layer?.mesh?.settings || {},
        });

        if (pivot) {
            return pivot;
        }

        return [
            number(props.editorConfig.gizmoOrigin?.x ?? props.editorConfig.gizmoOrigin?.[0], 0),
            number(props.editorConfig.gizmoOrigin?.y ?? props.editorConfig.gizmoOrigin?.[1], 0),
            number(props.editorConfig.gizmoOrigin?.z ?? props.editorConfig.gizmoOrigin?.[2], 0),
        ];
    };

    const resolveMeshEditDragDelta = (event, dx = 0, dy = 0) => {
        if (!temp.value.edit.session?.pivotWorld || !temp.value.edit.session?.planeNormal) {
            const layer = getMeshEditLayer();
            return worldDeltaToLocalMeshDelta(
                meshEditWorldDeltaFromPointer(dx, dy),
                layer?.geometry || layer?.mesh?.settings || {},
            );
        }

        const current = rayPlaneIntersection(
            rayFromPointerEvent(event),
            temp.value.edit.session.pivotWorld,
            temp.value.edit.session.planeNormal,
        );

        if (!current || !temp.value.edit.session.lastWorld) {
            const layer = getMeshEditLayer();
            return worldDeltaToLocalMeshDelta(
                meshEditWorldDeltaFromPointer(dx, dy),
                layer?.geometry || layer?.mesh?.settings || {},
            );
        }

        const worldDelta = [
            current[0] - temp.value.edit.session.lastWorld[0],
            current[1] - temp.value.edit.session.lastWorld[1],
            current[2] - temp.value.edit.session.lastWorld[2],
        ];
        temp.value.edit.session.lastWorld = current;

        const layer = getMeshEditLayer();
        return worldDeltaToLocalMeshDelta(worldDelta, layer?.geometry || layer?.mesh?.settings || {});
    };

    const beginMeshEditDrag = event => {
        const state = readCameraState();
        const pivotWorld = resolveMeshEditSelectionPivot();
        const planeNormal = [
            number(state.forward?.x, 0),
            number(state.forward?.y, 1),
            number(state.forward?.z, 0),
        ];
        const startWorld = rayPlaneIntersection(rayFromPointerEvent(event), pivotWorld, planeNormal);

        temp.value.edit.session = {
            pivotWorld,
            planeNormal,
            startWorld,
            lastWorld: startWorld,
            startX: event.clientX || 0,
            startY: event.clientY || 0,
            lastX: event.clientX || 0,
            lastY: event.clientY || 0,
            changed: false,
            tool: props.editConfig.tool || "move",
        };
        props.editorConfig.dragging = true;
        props.editorConfig.cursor = temp.value.edit.session.tool === "scale" ? "nwse-resize" : "move";
    };

    const updateMeshEditDrag = event => {
        if (!temp.value.edit.session) {
            return;
        }

        const dx = (event.clientX || 0) - temp.value.edit.session.lastX;
        const dy = (event.clientY || 0) - temp.value.edit.session.lastY;
        temp.value.edit.session.lastX = event.clientX || 0;
        temp.value.edit.session.lastY = event.clientY || 0;

        if (Math.abs(dx) + Math.abs(dy) <= 0) {
            return;
        }

        const result = temp.value.edit.session.tool === "scale"
            ? transformMeshEditSelection({
                state: props.editConfig,
                layer: getMeshEditLayer(),
                scale: Math.max(0.05, 1 + (dx - dy) * 0.006),
            })
            : transformMeshEditSelection({
                state: props.editConfig,
                layer: getMeshEditLayer(),
                delta: resolveMeshEditDragDelta(event, dx, dy),
            });

        if (result?.changed) {
            temp.value.edit.session.changed = true;
            markLocalTransformDirty();
            refreshMeshEditOverlay();
            syncEditorVisualState(activeLayer.value);
        }
    };

    const endMeshEditDrag = () => {
        const changed = temp.value.edit.session?.changed === true;
        temp.value.edit.session = null;
        props.editorConfig.dragging = false;

        if (changed) {
            markLocalTransformDirty();
        }
    };

    const resolveSculptBrush = () => {
        return {
            ...createDefaultSculptBrush(),
            ...(props.sculptConfig || {}),
            detail: {
                ...createDefaultSculptBrush().detail,
                ...(props.sculptConfig?.detail || {}),
            },
        };
    };

    const sculptBrushActive = () => {
        return isSculptStateActive() && activeLayer.value?.mesh;
    };

    const toggleSculptBrushMode = () => {
        const nextEnabled = !sculptBrushActive();
        setSculptStateActive(nextEnabled);

        if (nextEnabled && isMeshEditStateActive()) {
            setMeshEditEnabled(false);
        }

        if (nextEnabled) {
            setEditorViewMode('soft');
            props.editorConfig.tool = 'sculpt-brush';
            props.editorConfig.axis = 'free';
            props.gizmoConfig.axis = 'free';
        } else {
            endSculptStroke();
            commitSculptDraftLayer();
            setEditorViewMode(isMeshEditStateActive() ? props.editConfig.viewMode || 'wireframe' : 'world');
            props.editorConfig.tool = isMeshEditStateActive() ? 'mesh-edit' : (props.gizmoConfig.tool || 'translate');
        }

        emitEvent('sculpt:brush', {
            ...resolveSculptBrush(),
            enabled: nextEnabled,
        });
        emitEvent('editor:view-mode', nextEnabled ? 'soft' : (isMeshEditStateActive() ? props.editConfig.viewMode || 'wireframe' : 'world'));

        syncEditorVisualState(getMeshEditLayer());
        return nextEnabled;
    };

    const applySculptStroke = event => {
        const layer = ensureMeshEditDraftLayer() || activeLayer.value;
        if (!layer?.mesh) return false;
        const hit = pickActiveMesh(event);
        if (!hit?.point) return false;

        const brush = resolveSculptBrush();
        const currentPoint = hit.point;
        temp.value.sculpt.lastHit = hit;

        if (temp.value.sculpt.lastPoint) {
            const dx = currentPoint[0] - temp.value.sculpt.lastPoint[0];
            const dy = currentPoint[1] - temp.value.sculpt.lastPoint[1];
            const dz = currentPoint[2] - temp.value.sculpt.lastPoint[2];
            const minSpacing = Math.max(0.002, Number(brush.radius || 0.18) * 0.18);

            if (Math.sqrt(dx * dx + dy * dy + dz * dz) < minSpacing) {
                return false;
            }
        }

        const result = applySculptBrushToMesh({
            mesh: layer.mesh,
            hit,
            brush,
        });

        if (!result.changed) {
            return false;
        }

        layer.mesh = result.mesh;
        layer.mesh.settings = {
            ...(layer.mesh.settings || {}),
            ...(layer.geometry || {}),
        };
        layer.shader = {
            ...(layer.shader || {}),
            mesh: result.mesh,
        };
        layer.material = {
            ...(layer.material || {}),
            mesh: result.mesh,
        };

        temp.value.sculpt.lastPoint = currentPoint.slice();
        markLocalTransformDirty();
        syncEditorVisualState(layer);
        return true;
    };

    const beginSculptStroke = event => {
        selectAnimatorObject(activeLayer.value);
        temp.value.sculpt.session = {
            start: localPointerFromEvent(event),
            changed: false,
        };
        temp.value.sculpt.lastPoint = null;
        temp.value.sculpt.lastHit = null;
        props.editorConfig.dragging = true;
        props.editorConfig.cursor = "crosshair";
        temp.value.sculpt.session.changed = applySculptStroke(event);
    };

    const updateSculptStroke = event => {
        if (!temp.value.sculpt.session) {
            return;
        }

        temp.value.sculpt.session.changed = applySculptStroke(event) || temp.value.sculpt.session.changed;
    };

    const endSculptStroke = () => {
        const changed = temp.value.sculpt.session?.changed === true;
        temp.value.sculpt.session = null;
        temp.value.sculpt.lastPoint = null;
        temp.value.sculpt.lastHit = null;
        props.editorConfig.dragging = false;
        props.editorConfig.cursor = "default";

        if (changed || localTransformDirty) {
            markLocalTransformDirty();
        }
    };

    const submitAnimatorMesh = () => commitActiveLayerState();

    const ensureActiveGeometry = () => {
        const layer = activeLayer.value;

        if (!layer) {
            return null;
        }

        const geometry = normalizeMeshSettings(
            layer.geometry ||
            layer.mesh?.settings ||
            {}
        );

        layer.geometry = geometry;
        layer.mesh = {
            ...(layer.mesh || {}),
            settings: {
                ...(layer.mesh?.settings || {}),
                ...geometry,
            },
        };

        return geometry;
    };

    const setGizmoTool = tool => {
        props.gizmoConfig.tool = tool;
        ui.value.root.ref?.focus?.();
    };

    const setGizmoAxis = axis => {
        props.gizmoConfig.axis = axis;
        ui.value.root.ref?.focus?.();
    };

    const setGizmoPivot = pivot => {
        props.gizmoConfig.pivot = pivot;

        if (pivot === "cursor" && activeLayer.value?.id) {
            setCursorPivotFromObject(activeLayer.value);
        }

        if (pivot === "world") {
            resetCursorPivot();
        }

        syncEditorVisualState(activeLayer.value);
        ui.value.root.ref?.focus?.();
    };

    const applyPivotAction = action => {
        const layer = activeLayer.value;
        const geometry = ensureActiveGeometry();

        if (!layer?.id || !geometry || !action) {
            return false;
        }

        const position = {
            x: number(geometry.position_x, 0),
            y: number(geometry.position_y, 0),
            z: number(geometry.position_z, 0),
        };
        const objectPivot = objectPivotPoint(geometry);
        const cursor = toPointObject(props.editorConfig.cursorPivot || WORLD_PIVOT);

        if (action === "pivot-to-center") {
            geometry.pivot_x = 0;
            geometry.pivot_y = 0;
            geometry.pivot_z = 0;
        }

        if (action === "center-to-pivot") {
            geometry.position_x = objectPivot.x;
            geometry.position_y = objectPivot.y;
            geometry.position_z = objectPivot.z;
            geometry.pivot_x = 0;
            geometry.pivot_y = 0;
            geometry.pivot_z = 0;
        }

        if (action === "pivot-to-cursor") {
            geometry.pivot_x = cursor.x - position.x;
            geometry.pivot_y = cursor.y - position.y;
            geometry.pivot_z = cursor.z - position.z;
        }

        if (action === "cursor-to-pivot") {
            setCursorPivotState(objectPivot);
            setGizmoPivot("cursor");
            syncEditorVisualState(layer);
            return true;
        }

        if (action === "pivot-to-world") {
            geometry.pivot_x = -position.x;
            geometry.pivot_y = -position.y;
            geometry.pivot_z = -position.z;
        }

        if (action === "cursor-to-world") {
            resetCursorPivot();
            syncEditorVisualState(layer);
            return true;
        }

        syncLayerTransformGeometry(layer, geometry);
        submitAnimatorMesh();
        syncEditorVisualState(layer);
        return true;
    };

    const localPointerFromEvent = event => {
        const element = ui.value.viewport.ref;
        const rect = element?.getBoundingClientRect?.();
        const local = mouse.clientToLocalPoint(event.clientX || 0, event.clientY || 0);
        const layoutWidth = Math.max(1, element?.clientWidth || element?.offsetWidth || rect?.width || props.viewport.width);
        const layoutHeight = Math.max(1, element?.clientHeight || element?.offsetHeight || rect?.height || props.viewport.height);

        // useMouse.clientToLocalPoint already compensates transformed parents.
        // Therefore scale from the element's layout size, not from getBoundingClientRect(),
        // otherwise CSS zoom/scale is applied twice and picking drifts from the rendered props.gizmoConfig.
        const scaleX = props.viewport.width / layoutWidth;
        const scaleY = props.viewport.height / layoutHeight;

        return {
            x: local.x * scaleX,
            y: local.y * scaleY,
            clientX: event.clientX,
            clientY: event.clientY,
            rect: rect
                ? {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                }
                : null,
            layout: {
                width: layoutWidth,
                height: layoutHeight,
            },
        };
    };

    const rayFromPointerEvent = event => {
        const local = localPointerFromEvent(event);
        return Ray.fromCamera(getCameraCore(), local.x, local.y, props.viewport);
    };

    const emitEditorPick = (type, hit = null, event = null) => {
        const local = event ? localPointerFromEvent(event) : null;
        const payload = {
            type,
            hit: hit ? clone(hit, "json") : null,
            pointer: local
                ? {
                    x: local.x,
                    y: local.y,
                    clientX: local.clientX,
                    clientY: local.clientY,
                }
                : null,
            viewport: {
                width: props.viewport.width,
                height: props.viewport.height,
            },
        };

        emitEvent("editor:pick", payload);
        return payload;
    };

    const pickActiveMesh = event => {
        const layer = meshEditActive() ? getMeshEditLayer() : activeLayer.value;

        if (!layer?.mesh) return null;

        const hit = PickingController.pickMesh({
            ray: rayFromPointerEvent(event),
            mesh: layer.mesh,
            mode: meshEditActive() ? normalizeMeshEditMode(props.editConfig.mode) : (props.editorConfig.selectionMode || "object"),
            thresholds: props.editorConfig.picking || {},
        });

        if (!hit) return null;

        return {
            ...hit,
            objectId: layer.id,
        };
    };

    const pickGizmo = event => {
        const layer = objectGizmoLayer.value || activeLayer.value;

        if (!layer?.id) {
            return null;
        }

        const geometry = normalizeMeshSettings(layer.geometry || layer.mesh?.settings || {});
        const visual = syncEditorVisualState(layer);
        const gizmoGeometry = GizmoGeometry.build({
            geometry,
            origin: visual.pivotPoint,
            size: visual.gizmoSize,
            tool: props.gizmoConfig.tool || props.editorConfig.tool || "translate",
            renderPlaneHandles: props.editorConfig.showPlaneHandles === true,
            showAxisHandles: props.editorConfig.showAxisHandles !== false,
            showRotateRings: props.editorConfig.showRotateRings !== false,
            showScaleHandles: props.editorConfig.showScaleHandles !== false,
            showPivot: props.editorConfig.showObjectPivot !== false || props.editorConfig.showWorldPivot !== false,
            showAxisGuide: props.editorConfig.dragging === true && props.editorConfig.showAxisGuide !== false,
            activeAxis: props.editorConfig.axis || props.gizmoConfig.axis || "free",
        });

        const local = localPointerFromEvent(event);
        const rendererPickCamera = buildRendererPickCamera(viewportCamera.value, props.viewport);

        return GizmoGeometry.pick(
            rayFromPointerEvent(event),
            gizmoGeometry,
            props.editorConfig.picking?.gizmoThreshold || 0.34,
            {
                ...(props.editorConfig.picking || {}),
                camera: rendererPickCamera,
                viewport: props.viewport,
                local,
                rendererSpace: true,
                strictScreen: true,
                axisPixelThreshold: props.editorConfig.picking?.axisPixelThreshold ?? 7,
                ringPixelThreshold: props.editorConfig.picking?.ringPixelThreshold ?? 6,
                pointPixelExtra: props.editorConfig.picking?.pointPixelExtra ?? 2,
                planePixelInset: props.editorConfig.picking?.planePixelInset ?? 2,
            }
        );
    };

    const isObjectHit = event => Boolean(pickActiveMesh(event));

    const selectByPicking = event => {
        const hit = pickActiveMesh(event);

        if (!hit) {
            clearAnimatorObjectSelection();
            emitEditorPick("clear", null, event);
            return null;
        }

        selectAnimatorObject(activeLayer.value);
        setEditorSelection({
            objectId: hit.objectId,
            face: hit.type === "face" ? hit : null,
            edge: hit.type === "edge" ? hit : null,
            vertex: hit.type === "vertex" ? hit : null,
        });

        emitEditorPick("mesh", hit, event);
        return hit;
    };

    const selectAnimatorObject = (layer = activeLayer.value) => {
        if (!layer?.id) {
            temp.value.activeLayerId = "";
            return;
        }

        temp.value.activeLayerId = layer.id;
        setEditorSelection({ objectId: layer.id });
        setCursorPivotFromObject(layer);
        props.editorConfig.renderPivot = true;
        syncEditorVisualState(layer);
        ui.value.root.ref?.focus?.();
    };

    const clearAnimatorObjectSelection = () => {
        temp.value.activeLayerId = "";
        props.gizmoConfig.axis = "free";
        clearEditorSelection();
        props.editorConfig.worldPivot = { ...WORLD_PIVOT };
        props.editorConfig.renderPivot = true;
        syncEditorVisualState(activeLayer.value);
    };

    const releaseObjectGizmoAxis = () => {
        props.gizmoConfig.axis = "free";
    };

    const setCameraNumber = (key, value) => {
        const core = getCameraCore();
        const state = readCameraState();
        const n = number(value, state[key] ?? 0);

        if (key === "fov") {
            core.fov = clamp(n, 1, 175);
        }

        if (key === "near") {
            core.near = Math.max(0.0001, n);
        }

        if (key === "far") {
            core.far = Math.max(0.01, n);
        }

        if (key === "radius") {
            core.orbit.setRadius(n);
        }

        if (key === "orthographicScale" || key === "orthographic_scale") {
            core.setOrthographicScale(n);
        }

        if (key === "theta") {
            core.orbit.setAngles(normalizeAngleDeg(n) * DEG, core.orbit.phi);
        }

        if (key === "phi") {
            core.orbit.setAngles(core.orbit.theta, clamp(n, -89.5, 89.5) * DEG);
        }

        if (["target_x", "target_y", "target_z"].includes(key)) {
            const nextTarget = core.orbit.target.toObject();
            const axis = key.slice(-1);
            nextTarget[axis] = n;
            core.orbit.setTarget([nextTarget.x, nextTarget.y, nextTarget.z]);
        }

        markCameraDirty();
    };

    const applyCameraToActiveLayer = () => {
        const layer = activeLayer.value;

        if (!layer) {
            return false;
        }

        writeViewportCameraToLayer(layer, viewportCamera.value);
        cameraDirty = true;
        return commitActiveLayerState({ force: true });
    };

    const toPointObject = point => ({
        x: number(point?.x ?? point?.[0], 0),
        y: number(point?.y ?? point?.[1], 0),
        z: number(point?.z ?? point?.[2], 0),
    });

    const objectPivotPoint = geometry => ({
        x: number(geometry?.position_x, 0) + number(geometry?.pivot_x, 0),
        y: number(geometry?.position_y, 0) + number(geometry?.pivot_y, 0),
        z: number(geometry?.position_z, 0) + number(geometry?.pivot_z, 0),
    });

    const geometryVisualSize = geometry => {
        const sx = Math.abs(number(geometry?.width, 1) * number(geometry?.scale_x, 1));
        const sy = Math.abs(number(geometry?.height, 1) * number(geometry?.scale_y, 1));
        const sz = Math.abs(number(geometry?.depth, 1) * number(geometry?.scale_z, 1));
        const maxDim = Math.max(sx, sy, sz, 0.25);
        return Math.max(0.22, Math.min(1.25, maxDim * 0.62));
    };

    const resolvePivotMode = () => props.gizmoConfig.pivot || props.editorConfig.pivotMode || "object";

    const resetCursorPivot = () => {
        resetCursorPivotState();
    };

    const setCursorPivotFromObject = (layer = activeLayer.value) => {
        const geometry = normalizeMeshSettings(layer?.geometry || layer?.mesh?.settings || {});
        setCursorPivotState(objectPivotPoint(geometry));
    };

    const resolveWorldCursorPivot = () => {
        const mode = resolvePivotMode();

        if (mode === "cursor" && props.editorConfig.cursorPivotActive === true) {
            return toPointObject(props.editorConfig.cursorPivot);
        }

        // World pivot is immutable scene origin. It is not an editable transform.
        return { ...WORLD_PIVOT };
    };

    const resolveGizmoPivotPoint = (geometry) => {
        const mode = resolvePivotMode();

        if (mode === "cursor" || mode === "world") {
            return resolveWorldCursorPivot();
        }

        // Single object: object and median collapse to the attached object pivot/origin.
        return objectPivotPoint(geometry);
    };

    const syncEditorVisualState = (layer = activeLayer.value) => {
        const editLayer = meshEditActive() ? getMeshEditLayer() : layer;
        const geometry = normalizeMeshSettings(editLayer?.geometry || editLayer?.mesh?.settings || {});
        const selectionPivot = meshEditActive()
            ? getMeshEditSelectionPivot({ state: props.editConfig, mesh: editLayer?.mesh, geometry })
            : null;
        const pivotPoint = selectionPivot
            ? { x: selectionPivot[0], y: selectionPivot[1], z: selectionPivot[2] }
            : resolveGizmoPivotPoint(geometry);
        const gizmoSize = geometryVisualSize(geometry);

        props.editorConfig.tool = props.gizmoConfig.tool || props.editorConfig.tool || "translate";
        props.editorConfig.axis = props.gizmoConfig.axis || props.editorConfig.axis || "free";
        props.editorConfig.pivotMode = resolvePivotMode();
        props.editorConfig.activeObjectId = layer?.id || "";
        props.editorConfig.pivotPoint = pivotPoint;
        props.editorConfig.gizmoOrigin = pivotPoint;
        props.editorConfig.objectPivotPoint = objectPivotPoint(geometry);
        props.editorConfig.worldPivot = { ...WORLD_PIVOT };
        props.editorConfig.cursorPivotActive = props.editorConfig.cursorPivotActive === true;
        props.editorConfig.gizmoSize = gizmoSize;
        props.editorConfig.showAxisHandles = props.gizmoConfig.showAxisHandles !== false;
        props.editorConfig.showRotateRings = props.gizmoConfig.showRotateRings !== false;
        props.editorConfig.showScaleHandles = props.gizmoConfig.showScaleHandles !== false;
        props.editorConfig.showPlaneHandles = props.gizmoConfig.showPlaneHandles === true;
        props.editorConfig.showObjectPivot = props.gizmoConfig.showObjectPivot !== false;
        props.editorConfig.showWorldPivot = props.gizmoConfig.showWorldPivot !== false;
        props.editorConfig.showAxisGuide = props.gizmoConfig.showAxisGuide !== false;
        props.editorConfig.renderWorldAxis = props.gizmoConfig.showWorldAxis === true;
        props.editorConfig.renderGizmo = props.gizmoConfig.showTransformGizmo !== false;
        props.editorConfig.renderPivot = props.editorConfig.showObjectPivot !== false || props.editorConfig.showWorldPivot !== false;
        props.editorConfig.renderPlaneHandles = props.editorConfig.showPlaneHandles === true;
        props.editorConfig.viewMode = isMeshEditStateActive() || isSculptStateActive() ? normalizeMeshEditViewMode(props.editConfig.viewMode || props.viewConfig.mode || "wireframe") : (props.viewConfig.mode || "world");
        props.editorConfig.currentCamera = clone(viewportCamera.value, "json");
        props.editorConfig.sculptBrush = buildSculptBrushOverlay({
            brush: resolveSculptBrush(),
            hit: temp.value.sculpt.lastHit,
        });
        refreshMeshEditOverlay();

        return { geometry, pivotPoint, gizmoSize };
    };

    const syncLayerTransformGeometry = (layer, geometry) => {
        if (!layer?.id || !geometry) {
            return false;
        }

        const nextGeometry = normalizeMeshSettings(geometry);
        const mesh = {
            ...(layer.mesh || {}),
            settings: {
                ...(layer.mesh?.settings || {}),
                ...nextGeometry,
            },
        };

        layer.geometry = nextGeometry;
        layer.mesh = mesh;
        layer.material = {
            ...(layer.material || {}),
            geometry: {
                ...(layer.material?.geometry || {}),
                ...nextGeometry,
            },
            mesh,
        };
        layer.shader = {
            ...(layer.shader || {}),
            geometry: {
                ...(layer.shader?.geometry || {}),
                ...nextGeometry,
            },
            mesh,
        };

        temp.value.transform.revision += 1;
        markLocalTransformDirty();
        return true;
    };

    const applyGizmoDelta = event => {
        const layer = activeLayer.value;
        const geometry = ensureActiveGeometry();

        if (!layer?.id || !geometry || !temp.value.transform.session) {
            return;
        }

        const local = localPointerFromEvent(event);
        const result = transformController.apply({
            event,
            local,
            element: ui.value.viewport.ref,
            camera: getCameraCore(),
            viewport: props.viewport,
            geometry,
            tool: temp.value.transform.session.tool,
            axis: temp.value.transform.session.axis,
            pivotMode: temp.value.transform.session.pivotMode,
            pivotPoint: temp.value.transform.session.pivotPoint,
        });

        if (!result?.geometry) {
            return;
        }

        syncLayerTransformGeometry(layer, result.geometry);
        setEditorSelection({ objectId: layer.id });
    };

    const beginGizmoTransform = event => {
        const geometry = ensureActiveGeometry();

        if (!geometry) {
            return;
        }

        syncEditorVisualState(activeLayer.value);
        const tool = props.gizmoConfig.tool || props.editorConfig.tool || "translate";
        const axis = props.gizmoConfig.axis || props.editorConfig.axis || "free";
        const pivotMode = resolvePivotMode();
        const pivotPoint = resolveGizmoPivotPoint(geometry);
        const startPointer = localPointerFromEvent(event);

        temp.value.transform.session = {
            startPointer,
            startGeometry: clone(geometry, "json"),
            tool,
            axis,
            pivotMode,
            pivotPoint,
        };

        transformController.begin({
            event,
            local: startPointer,
            element: ui.value.viewport.ref,
            camera: getCameraCore(),
            viewport: props.viewport,
            geometry,
            tool,
            axis,
            pivotMode,
            pivotPoint,
        });

        props.editorConfig.active = true;
        props.editorConfig.dragging = true;
        props.editorConfig.tool = tool;
        props.editorConfig.axis = axis;
        props.editorConfig.pivotMode = pivotMode;
        props.editorConfig.pivotPoint = pivotPoint;
        props.editorConfig.gizmoOrigin = pivotPoint;
        refreshMeshEditOverlay();
    };

    const endGizmoTransform = () => {
        const endedTool = temp.value.transform.session?.tool || "";
        transformController.end();
        temp.value.transform.session = null;
        props.editorConfig.dragging = false;

        if (["translate", "rotate", "scale", "pivot"].includes(endedTool)) {
            resetCursorPivot();
        }

        syncEditorVisualState(activeLayer.value);
    };

    const tick = (frameTime = performance.now()) => {
        const delta = temp.value.lastFrameTime ? Math.min(Math.max((frameTime - temp.value.lastFrameTime) / 1000, 0), 0.08) : 1 / 60;

        temp.value.lastFrameTime = frameTime;
        clock.update(delta);
        processExternalCommands();
        getCameraCore().update(clock.deltaTime);
        syncCameraState();

        temp.value.rafId = requestAnimationFrame(tick);
    };

    const startTick = () => {
        stopTick();
        temp.value.lastFrameTime = performance.now();
        clock.reset(0);
        temp.value.rafId = requestAnimationFrame(tick);
    };

    const stopTick = () => {
        if (temp.value.rafId) {
            cancelAnimationFrame(temp.value.rafId);
            temp.value.rafId = 0;
        }
    };

    const stopNativeEvent = event => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
    };

    const resolvePointerMode = event => {
        const isRight = event.button === 2;
        const isMiddle = event.button === 1;
        const isLeft = event.button === 0;
        const gizmoHandle = event.target?.closest?.("[data-gizmo-handle='true']");
        const isGizmoHandle = Boolean(gizmoHandle);
        const handleTool = gizmoHandle?.dataset?.gizmoTool || props.gizmoConfig.tool;

        if (meshEditActive()) {
            const hit = isLeft || isRight ? pickMeshEditElement(event) : null;

            if (isLeft && hit) {
                return "mesh-edit-select";
            }

            if (isRight && hit) {
                return "mesh-edit-transform";
            }
        }

        if (isLeft && sculptBrushActive() && !meshEditActive()) {
            return "sculpt-brush";
        }

        if (isRight && activeLayer.value && !meshEditActive()) {
            const pickedGizmo = isGizmoHandle
                ? {
                    axis: gizmoHandle?.dataset?.gizmoAxis || props.gizmoConfig.axis,
                    tool: handleTool,
                }
                : pickGizmo(event);

            if (pickedGizmo && ["translate", "rotate", "scale", "pivot"].includes(pickedGizmo.tool)) {
                selectAnimatorObject(activeLayer.value);
                emitEditorPick("gizmo", pickedGizmo, event);
                props.gizmoConfig.axis = pickedGizmo.axis || "free";
                props.gizmoConfig.tool = pickedGizmo.tool;
                props.editorConfig.hover = clone(pickedGizmo, "json");
                props.editorConfig.cursor = pickedGizmo.tool === "rotate"
                    ? "grab"
                    : pickedGizmo.tool === "scale"
                        ? "nwse-resize"
                        : "move";
                return `gizmo-${pickedGizmo.tool}`;
            }
        }

        if (event.shiftKey && (isRight || isMiddle || isLeft)) {
            return "pan";
        }

        if ((event.ctrlKey || event.metaKey) && (isRight || isMiddle)) {
            return "dolly";
        }

        if (props.orbitConfig.rightMouseOrbit && isRight) {
            return "orbit";
        }

        if (props.orbitConfig.blenderMouse && isMiddle) {
            return "orbit";
        }

        if (event.altKey && isLeft) {
            return "orbit";
        }

        return "";
    };

    const orbitByDelta = (dx, dy) => {
        const core = getCameraCore();
        const sx = props.orbitConfig.invertOrbitX ? -1 : 1;
        const sy = props.orbitConfig.invertOrbitY ? -1 : 1;

        core.orbit.orbit(clampPointerDelta(dx) * sx, clampPointerDelta(dy) * sy);
        markCameraDirty();
    };

    const panByDelta = (dx, dy) => {
        const core = getCameraCore();
        const distanceFactor = core.projection === "orthographic"
            ? core.orthographicScale
            : core.orbit.radius;

        const scale = distanceFactor * core.orbit.panSpeed;
        const safeDx = clampPointerDelta(dx);
        const safeDy = clampPointerDelta(dy);

        core.orbit.target
            .addScaled(core.orbit.right, -safeDx * scale)
            .addScaled(core.orbit.up, safeDy * scale);
        markCameraDirty();
    };

    const dollyByDelta = dy => {
        const core = getCameraCore();
        const safeDy = clampPointerDelta(dy);

        if (core.projection === "orthographic") {
            core.setOrthographicScale(core.orthographicScale * Math.exp(safeDy * core.orbit.dollySpeed));
            markCameraDirty();

            return;
        }

        core.orbit.setRadius(core.orbit.radius * Math.exp(safeDy * core.orbit.dollySpeed));
        markCameraDirty();
    };

    const updateHoverCursor = event => {
        if (ui.value.pointer.active) {
            return;
        }

        if (meshEditActive()) {
            const hit = pickMeshEditElement(event);
            props.editorConfig.hover = hit ? clone(hit, "json") : null;
            props.editorConfig.cursor = hit ? "pointer" : "default";
            return;
        }

        const pickedGizmo = activeLayer.value ? pickGizmo(event) : null;

        if (pickedGizmo) {
            emitEditorPick("hover:gizmo", pickedGizmo, event);
            props.editorConfig.hover = clone(pickedGizmo, "json");
            props.editorConfig.cursor = pickedGizmo.tool === "rotate"
                ? "grab"
                : pickedGizmo.tool === "scale"
                    ? "nwse-resize"
                    : pickedGizmo.tool === "pivot"
                        ? "crosshair"
                        : "move";
            return;
        }

        props.editorConfig.hover = null;
        props.editorConfig.cursor = "default";
    };

    const editorCursorStyle = computed(() => ({
        cursor: ui.value.pointer.active
            ? (ui.value.pointer.mode === "orbit" ? "grabbing" : ui.value.pointer.mode === "pan" ? "move" : ui.value.pointer.mode === "dolly" ? "ns-resize" : ui.value.pointer.mode === "sculpt-brush" ? "crosshair" : ui.value.pointer.mode === "mesh-edit-select" ? "pointer" : props.editorConfig.cursor || "default")
            : props.editorConfig.cursor || "default",
    }));

    const onPointerDown = async event => {
        const mode = resolvePointerMode(event);

        if (!mode) {
            if (meshEditActive()) {
                return;
            }

            if (event.button === 0) {
                selectByPicking(event);
            }

            if (event.button === 2 && isObjectHit(event)) {
                selectAnimatorObject();
            }
            return;
        }

        stopNativeEvent(event);
        ui.value.root.ref?.focus?.();

        if (mode === "mesh-edit-select") {
            selectMeshEditElement(event);
        }

        if (mode === "mesh-edit-transform") {
            const hit = pickMeshEditElement(event);
            if (!isMeshEditHitSelected(hit)) {
                selectMeshEditElement(event);
            }
            beginMeshEditDrag(event);
        }

        if (mode === "sculpt-brush") {
            beginSculptStroke(event);
        }

        if (mode.startsWith("gizmo-")) {
            beginGizmoTransform(event);
        }

        await mouse.down(event);

        ui.value.pointer.active = true;
        ui.value.pointer.pointerId = event.pointerId;
        ui.value.pointer.button = event.button;
        ui.value.pointer.mode = mode;
        ui.value.pointer.x = event.clientX;
        ui.value.pointer.y = event.clientY;
        ui.value.pointer.startX = event.clientX;
        ui.value.pointer.startY = event.clientY;
        ui.value.pointer.moved = false;

        event.currentTarget?.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = async event => {
        if (!ui.value.pointer.active) {
            updateHoverCursor(event);
            return;
        }

        if (ui.value.pointer.pointerId !== event.pointerId) {
            return;
        }

        stopNativeEvent(event);

        await mouse.move(event, ({ client, dx, dy }) => {

            ui.value.pointer.x = client.x;
            ui.value.pointer.y = client.y;

            if (Math.abs(client.x - ui.value.pointer.startX) + Math.abs(client.y - ui.value.pointer.startY) > 3) {
                ui.value.pointer.moved = true;
            }

            if (ui.value.pointer.mode === "orbit") {
                orbitByDelta(dx, dy);
            }

            if (ui.value.pointer.mode === "pan") {
                panByDelta(dx, dy);
            }

            if (ui.value.pointer.mode === "dolly") {
                dollyByDelta(dy);
            }

            if (ui.value.pointer.mode === "mesh-edit-transform") {
                updateMeshEditDrag(event);
            }

            if (ui.value.pointer.mode === "sculpt-brush") {
                updateSculptStroke(event);
            }

            if (ui.value.pointer.mode.startsWith("gizmo-")) {
                applyGizmoDelta(event);
            }
        });
    };

    const onPointerUp = async event => {
        if (ui.value.pointer.pointerId !== null && ui.value.pointer.pointerId !== event.pointerId) {
            return;
        }

        stopNativeEvent(event);

        await mouse.up(event);

        const mode = ui.value.pointer.mode;
        const moved = ui.value.pointer.moved;

        ui.value.pointer.active = false;
        ui.value.pointer.pointerId = null;
        ui.value.pointer.button = -1;
        ui.value.pointer.mode = "";

        if (mode === "mesh-edit-transform") {
            endMeshEditDrag();
        }

        if (mode === "sculpt-brush") {
            endSculptStroke();
        }

        if (mode.startsWith("gizmo-")) {
            endGizmoTransform();
            releaseObjectGizmoAxis();
            if (moved || localTransformDirty) {
                submitAnimatorMesh();
            }
        }

        props.editorConfig.cursor = "default";
        event.currentTarget?.releasePointerCapture?.(event.pointerId);
    };

    const onPointerLeave = event => {
        if (!ui.value.pointer.active) {
            return;
        }

        onPointerUp(event);
    };

    const onWheel = event => {
        stopNativeEvent(event);

        const multiplier = event.shiftKey ? 0.35 : 1;
        const ctrlMultiplier = event.ctrlKey || event.metaKey ? 2 : 1;

        dollyByDelta(event.deltaY * multiplier * ctrlMultiplier);
        markCameraDirty();
    };

    const preventContextMenu = event => {
        stopNativeEvent(event);
    };

    const setProjection = projection => {
        getCameraCore().setProjection(projection);
        markCameraDirty();
    };

    const resetView = () => {
        // Hard viewport reset: do not reload the saved layer camera.
        // The Camera panel uses this to recover a clean orbit while editing.
        const core = getCameraCore();
        core.setViewport(props.viewport.width, props.viewport.height);
        core.update(1 / 60);
        setCameraCore(core);
        cameraDirty = true;
    };

    const restoreSavedView = () => {
        loadCameraFromActiveLayer({ force: true });
    };

    const setView = view => {
        const core = getCameraCore();

        if (view === "front") {
            core.orbit.setAngles(0, 0);
        }

        if (view === "right") {
            core.orbit.setAngles(90 * DEG, 0);
        }

        if (view === "top") {
            core.orbit.setAngles(0, 89.4 * DEG);
        }

        if (view === "back") {
            core.orbit.setAngles(180 * DEG, 0);
        }

        if (view === "left") {
            core.orbit.setAngles(-90 * DEG, 0);
        }

        markCameraDirty();
    };

    const frameSelected = () => {
        if (!props.selectedLayers.length) {
            return;
        }

        const bounds = props.selectedLayers.reduce(
            (acc, layer) => {
                const meshBounds = layer?.mesh?.bounds || layer?.bounds || {};
                const min = Vector.from(meshBounds.min || [-0.5, -0.5, -0.5]);
                const max = Vector.from(meshBounds.max || [0.5, 0.5, 0.5]);

                acc.min.x = Math.min(acc.min.x, min.x);
                acc.min.y = Math.min(acc.min.y, min.y);
                acc.min.z = Math.min(acc.min.z, min.z);

                acc.max.x = Math.max(acc.max.x, max.x);
                acc.max.y = Math.max(acc.max.y, max.y);
                acc.max.z = Math.max(acc.max.z, max.z);

                return acc;
            },
            {
                min: new Vector(Infinity, Infinity, Infinity),
                max: new Vector(-Infinity, -Infinity, -Infinity),
            }
        );

        const core = getCameraCore();

        if (!isFiniteNumber(bounds.min.x) || !isFiniteNumber(bounds.max.x)) {
            core.orbit.setTarget([0, 0, 0]);
            core.orbit.setRadius(props.orbitConfig.radius);
            core.setOrthographicScale(props.orbitConfig.orthographicScale);
            markCameraDirty();
            return;
        }

        const center = Vector.add(bounds.min, bounds.max).scale(0.5);
        const diagonal = Vector.sub(bounds.max, bounds.min).length();

        core.orbit.setTarget(center);
        core.orbit.setRadius(
            clamp(diagonal * 1.8 || props.orbitConfig.radius, props.orbitConfig.minRadius, props.orbitConfig.maxRadius)
        );
        core.setOrthographicScale(
            clamp(diagonal * 1.35 || props.orbitConfig.orthographicScale, props.orbitConfig.minOrthographicScale, props.orbitConfig.maxOrthographicScale)
        );
        markCameraDirty();
    };

    const focusPivot = () => {
        const core = getCameraCore();
        const geometry = normalizeMeshSettings(activeLayer.value?.geometry || activeLayer.value?.mesh?.settings || {});
        const pivot = resolveGizmoPivotPoint(geometry);
        core.orbit.setTarget([pivot.x, pivot.y, pivot.z]);
        core.orbit.smoothTarget?.copy?.(core.orbit.target);
        markCameraDirty();
    };

    const toggleGrid = () => {
        const core = getCameraCore();
        core.backgroundGrid = core.backgroundGrid === false;
        markCameraDirty();
    };

    const normalizeKey = key => {
        if (!key) {
            return "";
        }

        const value = key.toLowerCase();

        if (value === " ") return "Space";
        if (value === "alt") return "Alt";
        if (value === "altgraph") return "Alt";
        if (value === "shift") return "Shift";
        if (value === "control") return "Control";

        return value;
    };

    const onKeyDown = event => {
        keys.shift = event.shiftKey;
        keys.alt = event.altKey;
        keys.ctrl = event.ctrlKey;
        keys.meta = event.metaKey;

        const key = normalizeKey(event.key);

        if (event.code === "Escape" || key === "escape") {
            stopNativeEvent(event);
            if (isMeshEditStateActive()) {
                commitMeshEditDraftLayer();
            } else {
                commitActiveLayerState({ force: true });
            }
            emitEvent("orbit:state", false);
            emitEvent("apply-key-down", event);
            return;
        }

        if (event.code === "Comma") {
            focusPivot();
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (event.code === "Home" || event.code === "KeyF") {
            frameSelected();
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (event.code === "Numpad1" || event.code === "Digit1") {
            setView(event.ctrlKey ? "back" : "front");
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (event.code === "Numpad3" || event.code === "Digit3") {
            setView(event.ctrlKey ? "left" : "right");
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (event.code === "Numpad7" || event.code === "Digit7") {
            setView("top");
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (event.code === "Numpad5" || event.code === "Digit5") {
            setProjection(getCameraCore().projection === "perspective" ? "orthographic" : "perspective");
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (event.code === "Tab") {
            toggleMeshEditMode();
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (event.code === "KeyB" && !event.ctrlKey && !event.metaKey && !event.altKey) {
            toggleSculptBrushMode();
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (isMeshEditStateActive() && ["1", "2", "3"].includes(key)) {
            setMeshEditMode(key === "1" ? "vertex" : key === "2" ? "edge" : "face");
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (isMeshEditStateActive() && key === "f") {
            runMeshEditOperation("make-face");
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (isMeshEditStateActive() && key === "e") {
            runMeshEditOperation("extrude");
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (isMeshEditStateActive() && key === "j") {
            runMeshEditOperation("connect");
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (isMeshEditStateActive() && (key === "delete" || key === "backspace")) {
            runMeshEditOperation("delete");
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }


        if (key === "g") {
            setGizmoTool("translate");
            props.editorConfig.tool = "translate";
            props.editorConfig.cursor = "move";
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (key === "r") {
            setGizmoTool("rotate");
            props.editorConfig.tool = "rotate";
            props.editorConfig.cursor = "grab";
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (key === "s") {
            setGizmoTool("scale");
            props.editorConfig.tool = "scale";
            props.editorConfig.cursor = "nwse-resize";
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (["x", "y", "z"].includes(key)) {
            setGizmoAxis(key);
            props.editorConfig.axis = key;
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (key === "a") {
            setGizmoAxis("free");
            props.editorConfig.axis = "free";
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (event.code === "Period") {
            const modes = ["object", "median", "cursor"];
            const index = Math.max(0, modes.indexOf(resolvePivotMode()));
            setGizmoPivot(modes[(index + 1) % modes.length]);
            props.editorConfig.pivotMode = resolvePivotMode();
            syncEditorVisualState(activeLayer.value);
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (key === "Shift" || key === "Alt" || key === "Control") {
            emitEvent("apply-key-down", event);
        }
    };

    const onKeyUp = event => {
        keys.shift = event.shiftKey;
        keys.alt = event.altKey;
        keys.ctrl = event.ctrlKey;
        keys.meta = event.metaKey;

        emitEvent("apply-key-up", event);
    };

    const getSelectedLayersSignature = () => (props.selectedLayers || [])
        .map(layer => layer?.id || "")
        .join("|");

    const processSelectedLayerState = ({ force = false } = {}) => {
        const signature = getSelectedLayersSignature();

        if (!force && temp.value.commands.selectedLayersSignature === signature) {
            return;
        }

        temp.value.commands.selectedLayersSignature = signature;

        if (
            !temp.value.activeLayerId ||
            !props.selectedLayers.some(layer => layer.id === temp.value.activeLayerId)
        ) {
            temp.value.activeLayerId = props.selectedLayers[0]?.id || "";
        }

        loadCameraFromActiveLayer();

        if (
            temp.value.activeLayerId &&
            !props.selectedLayers.some(layer => layer.id === temp.value.activeLayerId)
        ) {
            clearAnimatorObjectSelection();
        }

        if (!temp.value.activeLayerId) {
            clearEditorSelection();
        }
    };

    const processKeyboardCommands = () => {
        const keyboard = props.keyboard || {};
        const commands = temp.value.commands;

        if (keyboard.apply !== commands.apply) {
            commands.apply = keyboard.apply || 0;
            if (commands.apply > 0) {
                applyCameraToActiveLayer();
            }
        }

        if (keyboard.frame !== commands.frame) {
            commands.frame = keyboard.frame || 0;
            if (commands.frame > 0) {
                frameSelected();
            }
        }

        if (keyboard.reset !== commands.reset) {
            commands.reset = keyboard.reset || 0;
            if (commands.reset > 0) {
                resetView();
            }
        }

        if (keyboard.restore !== commands.restore) {
            commands.restore = keyboard.restore || 0;
            if (commands.restore > 0) {
                restoreSavedView();
            }
        }

        if (keyboard.toggleGrid !== commands.toggleGrid) {
            commands.toggleGrid = keyboard.toggleGrid || 0;
            if (commands.toggleGrid > 0) {
                toggleGrid();
            }
        }

        if (keyboard.focusPivot !== commands.focusPivot) {
            commands.focusPivot = keyboard.focusPivot || 0;
            if (commands.focusPivot > 0) {
                focusPivot();
            }
        }

        if (keyboard.projection && keyboard.projection !== commands.projection) {
            commands.projection = keyboard.projection;
            setProjection(keyboard.projection);
            keyboard.projection = "";
        }

        if (keyboard.view && keyboard.view !== commands.view) {
            commands.view = keyboard.view;
            setView(keyboard.view);
            keyboard.view = "";
        }

        if (keyboard.fieldTick !== commands.fieldTick) {
            commands.fieldTick = keyboard.fieldTick || 0;
            const field = keyboard.field;

            if (field?.key) {
                setCameraNumber(field.key, field.value);
            }
        }
    };

    const processGizmoCommands = () => {
        const commands = temp.value.commands;

        if (props.gizmoConfig.pivotActionTick !== commands.pivotActionTick) {
            commands.pivotActionTick = props.gizmoConfig.pivotActionTick || 0;

            if (props.gizmoConfig.pivotAction) {
                applyPivotAction(props.gizmoConfig.pivotAction);
                props.gizmoConfig.pivotAction = "";
            }
        }
    };

    const processViewCommands = () => {
        const mode = props.viewConfig?.mode || "world";

        if (mode !== temp.value.commands.viewMode) {
            temp.value.commands.viewMode = mode;
            setEditorViewMode(mode);
        }
    };

    const processMeshEditCommands = () => {
        const commands = temp.value.commands;

        if (props.editConfig.operationTick !== commands.operationTick) {
            commands.operationTick = props.editConfig.operationTick || 0;

            if (props.editConfig.operation) {
                runMeshEditOperation(props.editConfig.operation);
                props.editConfig.operation = "";
            }
        }
    };

    const processExternalCommands = () => {
        processSelectedLayerState();
        processKeyboardCommands();
        processGizmoCommands();
        processViewCommands();
        processMeshEditCommands();
    };

    const _init = async () => {
        ui.value.root.ref = document.getElementById(ui.value.root.id);
        ui.value.viewport.ref = document.getElementById(ui.value.viewport.id);
        await nextTick();
        mouse.init();
        processSelectedLayerState({ force: true });

        if (ui.value.root.ref) {
            register("add", ui.value.root.ref, "keydown", onKeyDown);
            register("add", ui.value.root.ref, "keyup", onKeyUp);
        }

        if (ui.value.viewport.ref) {
            register("add", ui.value.viewport.ref, "pointerdown", onPointerDown);
            register("add", ui.value.viewport.ref, "pointermove", onPointerMove);
            register("add", ui.value.viewport.ref, "pointerup", onPointerUp);
            register("add", ui.value.viewport.ref, "pointercancel", onPointerUp);
            register("add", ui.value.viewport.ref, "pointerleave", onPointerLeave);
            register("add", ui.value.viewport.ref, "wheel", onWheel);
            register("add", ui.value.viewport.ref, "contextmenu", preventContextMenu);
        }

        register("add", window, "keydown", onKeyDown);
        register("add", window, "keyup", onKeyUp);

        startTick();
        ui.value.root.ref?.focus?.();
    };

    onMounted(async () => {
        await _init();
    });

    onBeforeUnmount(() => {
        commitActiveLayerState({ force: true });
        stopTick();

        register("removeAll");
    });

    return {
        ui,
        session,
        temp,

        editorCursorStyle,
        emitEvent,

        animatedLayers,
        isActiveLayer
    };
}

export const animatorProps = {
    engineSession: {
        type: Object,
        required: true
    },

    editorConfig: {
        type: Object,
        required: true
    },

    cameraConfig: {
        type: Object,
        required: true
    },

    gizmoConfig: {
        type: Object,
        required: true
    },

    orbitConfig: {
        type: Object,
        required: true
    },

    controlConfig: {
        type: Object,
        required: true
    },

    gridConfig: {
        type: Object,
        required: true
    },

    viewConfig: {
        type: Object,
        required: true
    },

    editConfig: {
        type: Object,
        required: true
    },

    sculptConfig: {
        type: Object,
        required: true
    },

    keyboard: {
        type: Object,
        required: true
    },

    meshStates: {
        type: Object,
        required: true
    },

    viewport: {
        type: Object,
        required: true
    },

    selectedLayers: {
        type: Array,
        required: true
    },

    timelineTime: {
        type: Number,
        required: false,
        default: 0,
    }
};
