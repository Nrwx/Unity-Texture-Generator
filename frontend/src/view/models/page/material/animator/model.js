import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
} from "vue";

import { uuid } from "@/utils/uuid";
import { eventRegister } from "@/dataLayer/event";
import { useMouse } from "@/composables/mouse/model";
import { clamp, clone } from "@/utils/tools";
import { Accumulator } from "@/view/models/page/material/core/Accumulator/Accumulator";
import { Camera } from "@/view/models/page/material/core/Camera/Camera";
import { Vector } from "@/view/models/page/material/core/Math/Vector/Vector";
import { Matrix } from "@/view/models/page/material/core/Math/Matrix/Matrix";
import { EditorState } from "@/view/models/page/material/core/Editor/EditorState";
import { TransformController } from "@/view/models/page/material/core/Editor/TransformController";
import { PickingController } from "@/view/models/page/material/core/Editor/PickingController";
import { GizmoGeometry } from "@/view/models/page/material/core/Editor/GizmoGeometry";
import { Ray } from "@/view/models/page/material/core/Ray/Ray";
import { sceneToRendererVector } from "@/models/layer/3D/coordinateSystem";
import {animatorGizmo} from "@/view/models/page/material/animator/state";

const DEG = Math.PI / 180;
const WORLD_PIVOT = Object.freeze({ x: 0, y: 0, z: 0 });

const createAnimatorGizmoDefaults = () => ({
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
});

const createAnimatorCameraStateDefaults = () => ({
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
});

const createAnimatorCameraCommandDefaults = () => ({
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
});

const toNumber = (value, fallback = 0) => {
    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
};

const toVectorObject = (value, fallback = [0, 0, 0]) => Vector
    .from(value, fallback)
    .toObject();

const buildRendererPickCamera = (cameraPayload = {}, viewport = { width: 1, height: 1 }) => {
    const aspect = Math.max(0.0001, viewport.width / Math.max(1, viewport.height));
    const projection = String(cameraPayload.projection || "perspective").toLowerCase();
    const position = sceneToRendererVector(cameraPayload.position, [0, -3.25, 0.18]);
    const target = sceneToRendererVector(cameraPayload.target, [0, 0, 0]);
    const up = Vector.normalize(sceneToRendererVector(cameraPayload.up, [0, 0, 1]), [0, 1, 0]).toArray();
    const view = Matrix.lookAt(position, target, up);
    const projectionMatrix = projection === "orthographic" || projection === "ortho"
        ? (() => {
            const halfHeight = Math.max(0.0001, toNumber(cameraPayload.orthographic_scale ?? cameraPayload.orthographicScale, 5)) * 0.5;
            const halfWidth = halfHeight * aspect;

            return Matrix.orthographic(
                -halfWidth,
                halfWidth,
                -halfHeight,
                halfHeight,
                Math.max(0.0001, toNumber(cameraPayload.near, 0.01)),
                Math.max(0.01, toNumber(cameraPayload.far, 1000)),
            );
        })()
        : Matrix.perspective(
            toNumber(cameraPayload.fov, 50) * DEG,
            aspect,
            Math.max(0.0001, toNumber(cameraPayload.near, 0.01)),
            Math.max(0.01, toNumber(cameraPayload.far, 1000)),
        );

    return {
        viewProjectionMatrix: projectionMatrix.clone().multiply(view),
    };
};

const createDefaultOrbitSettings = settings => ({
    projection: settings?.projection || "perspective",

    fov: toNumber(settings?.fov, 50),
    near: toNumber(settings?.near, 0.01),
    far: toNumber(settings?.far, 1000),

    radius: toNumber(settings?.radius, 4.6),
    minRadius: toNumber(settings?.minRadius ?? settings?.min_radius, 0.18),
    maxRadius: toNumber(settings?.maxRadius ?? settings?.max_radius, 250),

    orthographicScale: toNumber(settings?.orthographicScale ?? settings?.orthographic_scale, 5),
    minOrthographicScale: toNumber(settings?.minOrthographicScale ?? settings?.min_orthographic_scale, 0.05),
    maxOrthographicScale: toNumber(settings?.maxOrthographicScale ?? settings?.max_orthographic_scale, 250),

    theta: toNumber(settings?.theta, -45 * DEG),
    phi: toNumber(settings?.phi, 58 * DEG),

    minPhi: toNumber(settings?.minPhi ?? settings?.min_phi, -89.5 * DEG),
    maxPhi: toNumber(settings?.maxPhi ?? settings?.max_phi, 89.5 * DEG),

    target: toVectorObject(settings?.target, [0, 0, 0]),

    rotateSpeed: toNumber(settings?.rotateSpeed ?? settings?.rotate_speed, 0.0065),
    panSpeed: toNumber(settings?.panSpeed ?? settings?.pan_speed, 0.0028),
    dollySpeed: toNumber(settings?.dollySpeed ?? settings?.dolly_speed, 0.0018),
    wheelSpeed: toNumber(settings?.wheelSpeed ?? settings?.wheel_speed, 0.0012),

    damping: toNumber(settings?.damping, 18),

    invertOrbitX: settings?.invertOrbitX === true,
    invertOrbitY: settings?.invertOrbitY === true,

    blenderMouse: settings?.blenderMouse !== false,
    rightMouseOrbit: settings?.rightMouseOrbit !== false,

    backgroundGrid: settings?.backgroundGrid !== false,
    showAxisGizmo: settings?.showAxisGizmo !== false,
});

const createOrbitSettingsSignature = settings => JSON.stringify({
    projection: settings?.projection,
    fov: settings?.fov,
    near: settings?.near,
    far: settings?.far,
    radius: settings?.radius,
    minRadius: settings?.minRadius ?? settings?.min_radius,
    maxRadius: settings?.maxRadius ?? settings?.max_radius,
    orthographicScale: settings?.orthographicScale ?? settings?.orthographic_scale,
    minOrthographicScale: settings?.minOrthographicScale ?? settings?.min_orthographic_scale,
    maxOrthographicScale: settings?.maxOrthographicScale ?? settings?.max_orthographic_scale,
    theta: settings?.theta,
    phi: settings?.phi,
    minPhi: settings?.minPhi ?? settings?.min_phi,
    maxPhi: settings?.maxPhi ?? settings?.max_phi,
    target: settings?.target,
    rotateSpeed: settings?.rotateSpeed ?? settings?.rotate_speed,
    panSpeed: settings?.panSpeed ?? settings?.pan_speed,
    dollySpeed: settings?.dollySpeed ?? settings?.dolly_speed,
    wheelSpeed: settings?.wheelSpeed ?? settings?.wheel_speed,
    damping: settings?.damping,
    invertOrbitX: settings?.invertOrbitX,
    invertOrbitY: settings?.invertOrbitY,
    blenderMouse: settings?.blenderMouse,
    rightMouseOrbit: settings?.rightMouseOrbit,
    backgroundGrid: settings?.backgroundGrid,
    showAxisGizmo: settings?.showAxisGizmo,
});

const createCameraCore = settings => {
    const camera = new Camera({
        projection: settings.projection,
        fov: settings.fov,
        near: settings.near,
        far: settings.far,
        orthographicScale: settings.orthographicScale,
        minOrthographicScale: settings.minOrthographicScale,
        maxOrthographicScale: settings.maxOrthographicScale,
        target: settings.target,
        orbit: {
            radius: settings.radius,
            theta: settings.theta,
            phi: settings.phi,
            target: settings.target,
            minRadius: settings.minRadius,
            maxRadius: settings.maxRadius,
            minPhi: settings.minPhi,
            maxPhi: settings.maxPhi,
            worldUp: [0, 0, 1],
            rotateSpeed: settings.rotateSpeed,
            panSpeed: settings.panSpeed,
            dollySpeed: settings.dollySpeed,
            damping: settings.damping,
        },
    });

    camera.backgroundGrid = settings.backgroundGrid;

    return camera;
};

const normalizeMeshSettings = settings => ({
    ...(settings || {}),

    position_x: toNumber(settings?.position_x, 0),
    position_y: toNumber(settings?.position_y, 0),
    position_z: toNumber(settings?.position_z, 0),

    rotation_x: toNumber(settings?.rotation_x, 0),
    rotation_y: toNumber(settings?.rotation_y, 0),
    rotation_z: toNumber(settings?.rotation_z, 0),

    scale_x: toNumber(settings?.scale_x, 1),
    scale_y: toNumber(settings?.scale_y, 1),
    scale_z: toNumber(settings?.scale_z, 1),

    pivot_x: toNumber(settings?.pivot_x, 0),
    pivot_y: toNumber(settings?.pivot_y, 0),
    pivot_z: toNumber(settings?.pivot_z, 0),
});

const TRANSFORM_FIELD_GROUPS = [
    {
        key: "position",
        title: "Position",
        fields: [
            { key: "position_x", label: "X", step: 0.01 },
            { key: "position_y", label: "Y", step: 0.01 },
            { key: "position_z", label: "Z", step: 0.01 },
        ],
    },
    {
        key: "rotation",
        title: "Rotation",
        fields: [
            { key: "rotation_x", label: "X", step: 0.1 },
            { key: "rotation_y", label: "Y", step: 0.1 },
            { key: "rotation_z", label: "Z", step: 0.1 },
        ],
    },
    {
        key: "scale",
        title: "Scale",
        fields: [
            { key: "scale_x", label: "X", step: 0.01 },
            { key: "scale_y", label: "Y", step: 0.01 },
            { key: "scale_z", label: "Z", step: 0.01 },
        ],
    },
    {
        key: "pivot",
        title: "Pivot",
        fields: [
            { key: "pivot_x", label: "X", step: 0.01 },
            { key: "pivot_y", label: "Y", step: 0.01 },
            { key: "pivot_z", label: "Z", step: 0.01 },
        ],
    },
];

const CAMERA_FIELD_GROUPS = [
    {
        key: "lens",
        title: "Camera",
        fields: [
            { key: "fov", label: "FOV", step: 1, min: 1, max: 175 },
            { key: "near", label: "Near", step: 0.001, min: 0.0001 },
            { key: "far", label: "Far", step: 1, min: 0.01 },
        ],
    },
    {
        key: "orbit",
        title: "Orbit",
        fields: [
            { key: "radius", label: "Radius", step: 0.01, min: 0.0001 },
            { key: "orthographicScale", label: "Ortho", step: 0.01, min: 0.0001 },
        ],
    },
];

export function animatorModel(props, emit) {
    const rootRef = ref(null);
    const viewportRef = ref(null);
    const rafId = ref(null);
    const activeLayerId = ref("");
    const clock = new Accumulator();

    let lastFrameTime = 0;

    const animator = reactive({
        id: uuid(),
        viewportId: uuid(),
    });

    const pointer = reactive({
        active: false,
        pointerId: null,
        button: -1,
        mode: "",
        x: 0,
        y: 0,
        startX: 0,
        startY: 0,
        moved: false,
    });

    const keys = reactive({
        shift: false,
        alt: false,
        ctrl: false,
        meta: false,
    });

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const animatorProps = props.animator || {};
    const createLocalObject = (source, defaults) => reactive({
        ...defaults(),
        ...(source || {}),
    });
    const createEmittingObject = (source, defaults, eventName, options = {}) => {
        const target = createLocalObject(source, defaults);
        const emitChanges = options.emit !== false;

        if (!emitChanges) {
            return target;
        }

        return new Proxy(target, {
            set(object, key, value) {
                if (object[key] === value) {
                    return true;
                }

                object[key] = value;
                emitEvent(eventName, {
                    key,
                    value,
                    state: { ...object },
                });
                return true;
            },
        });
    };
    const createValueBridge = (initialValue, eventName, options = {}) => {
        const local = ref(initialValue || "");
        const emitChanges = options.emit !== false;

        return {
            get value() {
                return local.value;
            },
            set value(value) {
                if (local.value === value) {
                    return;
                }

                local.value = value || "";

                if (emitChanges) {
                    emitEvent(eventName, local.value);
                }
            },
        };
    };

    const gizmo = createEmittingObject(
        props.animatorGizmo || animatorProps.gizmo,
        createAnimatorGizmoDefaults,
        "animator:gizmo"
    );
    const animatorCameraState = createEmittingObject(
        props.animatorCameraState || animatorProps.cameraState || animatorProps.camera,
        createAnimatorCameraStateDefaults,
        "animator:camera-state",
        { emit: false }
    );
    const animatorCameraCommand = createEmittingObject(
        props.animatorCameraCommand || animatorProps.cameraCommand,
        createAnimatorCameraCommandDefaults,
        "animator:camera-command",
        { emit: false }
    );
    const animatorActiveLayerId = createValueBridge(
        props.animatorActiveLayerId || animatorProps.activeLayerId,
        "animator:active-layer-id"
    );
    const animatorObjectLayerId = createValueBridge(
        props.animatorObjectLayerId || animatorProps.objectLayerId,
        "animator:object-layer-id"
    );
    const editorState = props.editorState || reactive(EditorState.create({
        enabled: true,
        renderPlaneHandles: false,
        renderWorldAxis: false,
    }));
    const transformController = new TransformController();
    const transformRevision = ref(0);

    let transformSession = null;
    let localTransformDirty = false;
    let localTransformVersion = 0;
    let submittedTransformVersion = 0;
    let cameraDirty = false;
    let cameraCommitTimer = null;
    let loadedCameraLayerId = "";

    const markLocalTransformDirty = () => {
        localTransformDirty = true;
        localTransformVersion += 1;
        transformRevision.value += 1;
    };


    const { register } = eventRegister("listener:animator", emitEvent);

    const mouse = useMouse({
        register,
        elementId: animator.viewportId,
        mode: "local"
    });

    const settings = computed(() => createDefaultOrbitSettings(props.orbitSettings || props.settings || {}));
    let cameraCore = createCameraCore(settings.value);

    const camera = reactive({
        projection: cameraCore.projection,
        fov: cameraCore.fov,
        near: cameraCore.near,
        far: cameraCore.far,
        theta: cameraCore.orbit.theta,
        phi: cameraCore.orbit.phi,
        radius: cameraCore.orbit.radius,
        orthographicScale: cameraCore.orthographicScale,
        smoothTheta: cameraCore.orbit.smoothTheta,
        smoothPhi: cameraCore.orbit.smoothPhi,
        smoothRadius: cameraCore.orbit.smoothRadius,
        smoothOrthographicScale: cameraCore.orthographicScale,
        target: cameraCore.orbit.target.toObject(),
        smoothTarget: cameraCore.orbit.smoothTarget.toObject(),
        position: cameraCore.position.toObject(),
        forward: cameraCore.orbit.forward.toObject(),
        right: cameraCore.orbit.right.toObject(),
        up: cameraCore.orbit.up.toObject(),
        backgroundGrid: cameraCore.backgroundGrid,
        showAxisGizmo: settings.value.showAxisGizmo,
    });

    const normalizeViewportSize = () => ({
        width: Math.max(1, Math.round(toNumber(props.viewport?.width, 1))),
        height: Math.max(1, Math.round(toNumber(props.viewport?.height, 1))),
    });

    const viewportSize = reactive(normalizeViewportSize());

    const animatorStyle = computed(() => ({
        width: `${viewportSize.width}px`,
        height: `${viewportSize.height}px`,
    }));

    const animatorViewportStyle = computed(() => ({
        width: `${viewportSize.width}px`,
        height: `${viewportSize.height}px`,
    }));

    const viewportAspect = computed(() => (
        viewportSize.height > 0
            ? viewportSize.width / viewportSize.height
            : 1
    ));

    const syncCameraState = () => {
        cameraCore.setViewport(viewportSize.width, viewportSize.height);

        camera.projection = cameraCore.projection;
        camera.fov = cameraCore.fov;
        camera.near = cameraCore.near;
        camera.far = cameraCore.far;
        camera.theta = cameraCore.orbit.theta;
        camera.phi = cameraCore.orbit.phi;
        camera.radius = cameraCore.orbit.radius;
        camera.orthographicScale = cameraCore.orthographicScale;
        camera.smoothTheta = cameraCore.orbit.smoothTheta;
        camera.smoothPhi = cameraCore.orbit.smoothPhi;
        camera.smoothRadius = cameraCore.orbit.smoothRadius;
        camera.smoothOrthographicScale = cameraCore.orthographicScale;
        camera.target = cameraCore.orbit.target.toObject();
        camera.smoothTarget = cameraCore.orbit.smoothTarget.toObject();
        camera.position = cameraCore.position.toObject();
        camera.forward = cameraCore.orbit.forward.toObject();
        camera.right = cameraCore.orbit.right.toObject();
        camera.up = cameraCore.orbit.up.toObject();
        camera.backgroundGrid = cameraCore.backgroundGrid;
        camera.showAxisGizmo = settings.value.showAxisGizmo;

        animatorCameraState.projection = camera.projection;
        animatorCameraState.fov = camera.fov;
        animatorCameraState.near = camera.near;
        animatorCameraState.far = camera.far;
        animatorCameraState.radius = camera.radius;
        animatorCameraState.orthographicScale = camera.orthographicScale;
        animatorCameraState.theta = camera.theta;
        animatorCameraState.phi = camera.phi;
        animatorCameraState.target = {...camera.target};
        animatorCameraState.position = {...camera.position};
        animatorCameraState.payload = {
            ...cameraCore.toViewportCamera(),
            aspect: viewportAspect.value,
            orthographic_scale: camera.orthographicScale,
            target: {...camera.target},
            position: {...camera.position},
            forward: {...camera.forward},
            right: {...camera.right},
            up: {...camera.up},
        };
    };

    const selectedMaterialLayers = computed(() => (
        (props.selectedLayers || [])
            .filter(layer => Number(layer?.type) === 5)
    ));

    const activeLayer = computed(() => (
        selectedMaterialLayers.value.find(layer => layer.id === activeLayerId.value) ||
        selectedMaterialLayers.value[0] ||
        null
    ));

    const objectGizmoLayer = computed(() => (
        selectedMaterialLayers.value.find(layer => layer.id === animatorObjectLayerId.value) ||
        null
    ));

    const objectGizmoActive = computed(() => !!objectGizmoLayer.value?.id);

    const activeGeometry = computed(() => normalizeMeshSettings(
        activeLayer.value?.geometry ||
        activeLayer.value?.mesh?.settings ||
        {}
    ));

    const transformFieldGroups = computed(() => TRANSFORM_FIELD_GROUPS);

    const cameraFieldGroups = computed(() => CAMERA_FIELD_GROUPS);

    const viewportCamera = computed(() => ({
        ...cameraCore.toViewportCamera(),
        aspect: viewportAspect.value,
        orthographic_scale: camera.smoothOrthographicScale,
        target: { ...camera.smoothTarget },
        position: { ...camera.position },
        forward: { ...camera.forward },
        right: { ...camera.right },
        up: { ...camera.up },
    }));

    const resolveLayerViewportCamera = layer => (
        layer?.viewport_camera ||
        layer?.settings?.viewport_camera ||
        layer?.preview?.viewport_camera ||
        layer?.material?.viewport_camera ||
        layer?.shader?.viewport_camera ||
        null
    );

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
            ...settings.value,
            ...(payload || {}),
            orthographicScale: payload.orthographicScale ?? payload.orthographic_scale ?? settings.value.orthographicScale,
            orthographic_scale: payload.orthographic_scale ?? payload.orthographicScale ?? settings.value.orthographicScale,
        });

        nextCamera.backgroundGrid = payload.backgroundGrid ?? payload.background_grid ?? cameraCore.backgroundGrid ?? settings.value.backgroundGrid;
        nextCamera.setViewport(viewportSize.width, viewportSize.height);
        nextCamera.update(1 / 60);
        cameraCore = nextCamera;
        syncCameraState();
        cameraDirty = false;

        return true;
    };

    const loadCameraFromLayer = (layer, { force = false } = {}) => {
        if (!layer?.id) {
            return false;
        }

        const payload = resolveLayerViewportCamera(layer);

        if (!payload) {
            loadedCameraLayerId = layer.id;
            syncCameraState();
            return false;
        }

        if (!force && loadedCameraLayerId === layer.id) {
            return true;
        }

        loadedCameraLayerId = layer.id;
        return applyViewportCameraToCore(payload);
    };

    const loadCameraFromActiveLayer = (options = {}) => loadCameraFromLayer(activeLayer.value, options);

    const clearCameraCommitTimer = () => {
        if (cameraCommitTimer) {
            clearTimeout(cameraCommitTimer);
            cameraCommitTimer = null;
        }
    };

    const markCameraDirty = () => {
        // Camera movement is local while editing. Persistence happens only on
        // Apply / ESC / component unmount, so Orbit/Pan/Dolly stays smooth and
        // does not spam mesh:update.
        cameraDirty = true;
        syncCameraState();
    };

    const gridLines = computed(() => {
        const lines = [];
        const count = 18;

        for (let index = -count; index <= count; index += 1) {
            const pos = 50 + index * 4;

            lines.push({
                key: `v-${index}`,
                type: index === 0 ? "axis-z" : "minor",
                style: {
                    left: `${pos}%`,
                    top: "0",
                    width: "1px",
                    height: "100%",
                },
            });

            lines.push({
                key: `h-${index}`,
                type: index === 0 ? "axis-x" : "minor",
                style: {
                    top: `${pos}%`,
                    left: "0",
                    height: "1px",
                    width: "100%",
                },
            });
        }

        return lines;
    });

    const animatedLayers = computed(() => {
        // Force recomputation while dragging without pushing through global events.
        transformRevision.value;
        const cameraPayload = viewportCamera.value;
        syncEditorVisualState(activeLayer.value);

        return selectedMaterialLayers.value.map(layer => {
            const cloned = clone(layer, "json");
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

                width: viewportSize.width || cloned.width || 512,
                height: viewportSize.height || cloned.height || 512,

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

    const setActiveLayer = layer => {
        if (!layer?.id) {
            return;
        }

        activeLayerId.value = layer.id;
        animatorActiveLayerId.value = layer.id;
        loadCameraFromLayer(layer, { force: true });
    };

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

        // Use the existing mesh event directly. No animator mesh proxy, no extra parsing layer.
        emitEvent("mesh:update", payload);
        submittedTransformVersion = localTransformVersion;
        localTransformDirty = false;
        cameraDirty = false;

        return true;
    };

    const commitActiveLayerState = ({ force = false } = {}) => {
        if (force || cameraDirty || localTransformDirty || submittedTransformVersion !== localTransformVersion) {
            clearCameraCommitTimer();
            return commitLayer(activeLayer.value);
        }

        return false;
    };

    const scheduleLayerCommit = () => {
        // Local render invalidation only. Persistence happens on pointerup / ESC.
        markLocalTransformDirty();
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
        gizmo.tool = tool;
        rootRef.value?.focus?.();
    };

    const setGizmoAxis = axis => {
        gizmo.axis = axis;
        rootRef.value?.focus?.();
    };

    const setGizmoPivot = pivot => {
        gizmo.pivot = pivot;

        if (pivot === "cursor" && activeLayer.value?.id) {
            setCursorPivotFromObject(activeLayer.value);
        }

        if (pivot === "world") {
            resetCursorPivot();
        }

        syncEditorVisualState(activeLayer.value);
        rootRef.value?.focus?.();
    };

    const setGeometryNumber = (key, value, commit = true) => {
        const layer = activeLayer.value;
        const geometry = ensureActiveGeometry();

        if (!layer || !geometry) {
            return;
        }

        const fallback = key.startsWith("scale_") ? 1 : 0;
        geometry[key] = toNumber(value, fallback);
        syncLayerTransformGeometry(layer, geometry);

        if (!commit) {
            localTransformDirty = false;
        }
    };

    const resetActiveTransform = () => {
        [
            "position_x",
            "position_y",
            "position_z",
            "rotation_x",
            "rotation_y",
            "rotation_z",
            "pivot_x",
            "pivot_y",
            "pivot_z",
        ].forEach(key => setGeometryNumber(key, 0, false));

        [
            "scale_x",
            "scale_y",
            "scale_z",
        ].forEach(key => setGeometryNumber(key, 1, false));

        scheduleLayerCommit(activeLayer.value);
    };

    const applyPivotAction = action => {
        const layer = activeLayer.value;
        const geometry = ensureActiveGeometry();

        if (!layer?.id || !geometry || !action) {
            return false;
        }

        const position = {
            x: toNumber(geometry.position_x, 0),
            y: toNumber(geometry.position_y, 0),
            z: toNumber(geometry.position_z, 0),
        };
        const objectPivot = objectPivotPoint(geometry);
        const cursor = toPointObject(editorState.cursorPivot || WORLD_PIVOT);

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
            EditorState.setCursorPivot(editorState, objectPivot);
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
        const element = viewportRef.value;
        const rect = element?.getBoundingClientRect?.();
        const local = mouse.clientToLocalPoint(event.clientX || 0, event.clientY || 0);
        const layoutWidth = Math.max(1, element?.clientWidth || element?.offsetWidth || rect?.width || viewportSize.width);
        const layoutHeight = Math.max(1, element?.clientHeight || element?.offsetHeight || rect?.height || viewportSize.height);

        // useMouse.clientToLocalPoint already compensates transformed parents.
        // Therefore scale from the element's layout size, not from getBoundingClientRect(),
        // otherwise CSS zoom/scale is applied twice and picking drifts from the rendered gizmo.
        const scaleX = viewportSize.width / layoutWidth;
        const scaleY = viewportSize.height / layoutHeight;

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
        return Ray.fromCamera(cameraCore, local.x, local.y, viewportSize);
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
                width: viewportSize.width,
                height: viewportSize.height,
            },
        };

        emitEvent("editor:pick", payload);
        return payload;
    };

    const pickActiveMesh = event => {
        const layer = activeLayer.value;

        if (!layer?.mesh) {
            return null;
        }

        const hit = PickingController.pickMesh({
            ray: rayFromPointerEvent(event),
            mesh: layer.mesh,
            mode: editorState.selectionMode || "object",
            thresholds: editorState.picking || {},
        });

        if (!hit) {
            return null;
        }

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
            tool: gizmo.tool || editorState.tool || "translate",
            renderPlaneHandles: editorState.showPlaneHandles === true,
            showAxisHandles: editorState.showAxisHandles !== false,
            showRotateRings: editorState.showRotateRings !== false,
            showScaleHandles: editorState.showScaleHandles !== false,
            showPivot: editorState.showObjectPivot !== false || editorState.showWorldPivot !== false,
            showAxisGuide: editorState.dragging === true && editorState.showAxisGuide !== false,
            activeAxis: editorState.axis || gizmo.axis || "free",
        });

        const local = localPointerFromEvent(event);
        const rendererPickCamera = buildRendererPickCamera(viewportCamera.value, viewportSize);

        return GizmoGeometry.pick(
            rayFromPointerEvent(event),
            gizmoGeometry,
            editorState.picking?.gizmoThreshold || 0.34,
            {
                ...(editorState.picking || {}),
                camera: rendererPickCamera,
                viewport: viewportSize,
                local,
                rendererSpace: true,
                strictScreen: true,
                // The WebGL editor overlay draws scene points through sceneToRendererVector()
                // and then matrices.viewProj. Picking must use that exact same projection chain.
                axisPixelThreshold: editorState.picking?.axisPixelThreshold ?? 1.5,
                ringPixelThreshold: editorState.picking?.ringPixelThreshold ?? 3,
                pointPixelExtra: editorState.picking?.pointPixelExtra ?? 2,
                planePixelInset: editorState.picking?.planePixelInset ?? 2,
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
        EditorState.setSelection(editorState, {
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
            animatorObjectLayerId.value = "";
            return;
        }

        activeLayerId.value = layer.id;
        animatorActiveLayerId.value = layer.id;
        animatorObjectLayerId.value = layer.id;
        EditorState.setSelection(editorState, { objectId: layer.id });
        setCursorPivotFromObject(layer);
        editorState.renderPivot = true;
        syncEditorVisualState(layer);
        rootRef.value?.focus?.();
    };

    const clearAnimatorObjectSelection = () => {
        animatorObjectLayerId.value = "";
        gizmo.axis = "free";
        EditorState.clearSelection(editorState);
        editorState.worldPivot = { ...WORLD_PIVOT };
        editorState.renderPivot = true;
        syncEditorVisualState(activeLayer.value);
    };

    const setObjectGizmoAxis = (layer, payload) => {
        const axis = typeof payload === "object" ? payload?.axis : payload;
        const tool = typeof payload === "object" ? payload?.tool : "";

        selectAnimatorObject(layer);
        if (["translate", "rotate", "scale", "pivot"].includes(tool)) {
            setGizmoTool(tool);
            editorState.tool = tool;
        }
        setGizmoAxis(axis);
        editorState.axis = axis || "free";
    };

    const releaseObjectGizmoAxis = () => {
        gizmo.axis = "free";
    };

    const setCameraNumber = (key, value) => {
        const number = toNumber(value, camera[key] ?? 0);

        if (key === "fov") {
            cameraCore.fov = clamp(number, 1, 175);
        }

        if (key === "near") {
            cameraCore.near = Math.max(0.0001, number);
        }

        if (key === "far") {
            cameraCore.far = Math.max(0.01, number);
        }

        if (key === "radius") {
            cameraCore.orbit.setRadius(number);
        }

        if (key === "orthographicScale" || key === "orthographic_scale") {
            cameraCore.setOrthographicScale(number);
        }

        if (key === "theta") {
            cameraCore.orbit.setAngles(number * DEG, cameraCore.orbit.phi);
        }

        if (key === "phi") {
            cameraCore.orbit.setAngles(cameraCore.orbit.theta, number * DEG);
        }

        if (["target_x", "target_y", "target_z"].includes(key)) {
            const nextTarget = cameraCore.orbit.target.toObject();
            const axis = key.slice(-1);
            nextTarget[axis] = number;
            cameraCore.orbit.setTarget([nextTarget.x, nextTarget.y, nextTarget.z]);
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
        x: toNumber(point?.x ?? point?.[0], 0),
        y: toNumber(point?.y ?? point?.[1], 0),
        z: toNumber(point?.z ?? point?.[2], 0),
    });

    const objectPivotPoint = geometry => ({
        x: toNumber(geometry?.position_x, 0) + toNumber(geometry?.pivot_x, 0),
        y: toNumber(geometry?.position_y, 0) + toNumber(geometry?.pivot_y, 0),
        z: toNumber(geometry?.position_z, 0) + toNumber(geometry?.pivot_z, 0),
    });

    const geometryVisualSize = geometry => {
        const sx = Math.abs(toNumber(geometry?.width, 1) * toNumber(geometry?.scale_x, 1));
        const sy = Math.abs(toNumber(geometry?.height, 1) * toNumber(geometry?.scale_y, 1));
        const sz = Math.abs(toNumber(geometry?.depth, 1) * toNumber(geometry?.scale_z, 1));
        const maxDim = Math.max(sx, sy, sz, 0.25);
        return Math.max(0.22, Math.min(1.25, maxDim * 0.62));
    };

    const resolvePivotMode = () => gizmo.pivot || editorState.pivotMode || "object";

    const resetCursorPivot = () => {
        EditorState.resetCursorPivot(editorState);
    };

    const setCursorPivotFromObject = (layer = activeLayer.value) => {
        const geometry = normalizeMeshSettings(layer?.geometry || layer?.mesh?.settings || activeGeometry.value || {});
        EditorState.setCursorPivot(editorState, objectPivotPoint(geometry));
    };

    const resolveWorldCursorPivot = () => {
        const mode = resolvePivotMode();

        if (mode === "cursor" && editorState.cursorPivotActive === true) {
            return toPointObject(editorState.cursorPivot);
        }

        // World pivot is immutable scene origin. It is not an editable transform.
        return { ...WORLD_PIVOT };
    };

    const resolveGizmoPivotPoint = (geometry = activeGeometry.value) => {
        const mode = resolvePivotMode();

        if (mode === "cursor" || mode === "world") {
            return resolveWorldCursorPivot();
        }

        // Single object: object and median collapse to the attached object pivot/origin.
        return objectPivotPoint(geometry);
    };

    const syncEditorVisualState = (layer = activeLayer.value) => {
        const geometry = normalizeMeshSettings(layer?.geometry || layer?.mesh?.settings || activeGeometry.value || {});
        const pivotPoint = resolveGizmoPivotPoint(geometry);
        const gizmoSize = geometryVisualSize(geometry);

        editorState.tool = gizmo.tool || editorState.tool || "translate";
        editorState.axis = gizmo.axis || editorState.axis || "free";
        editorState.pivotMode = resolvePivotMode();
        editorState.activeObjectId = layer?.id || "";
        editorState.pivotPoint = pivotPoint;
        editorState.gizmoOrigin = pivotPoint;
        editorState.objectPivotPoint = objectPivotPoint(geometry);
        editorState.worldPivot = { ...WORLD_PIVOT };
        editorState.cursorPivotActive = editorState.cursorPivotActive === true;
        editorState.gizmoSize = gizmoSize;
        editorState.showAxisHandles = gizmo.showAxisHandles !== false;
        editorState.showRotateRings = gizmo.showRotateRings !== false;
        editorState.showScaleHandles = gizmo.showScaleHandles !== false;
        editorState.showPlaneHandles = gizmo.showPlaneHandles === true;
        editorState.showObjectPivot = gizmo.showObjectPivot !== false;
        editorState.showWorldPivot = gizmo.showWorldPivot !== false;
        editorState.showAxisGuide = gizmo.showAxisGuide !== false;
        editorState.renderWorldAxis = gizmo.showWorldAxis === true;
        editorState.renderGizmo = gizmo.showTransformGizmo !== false;
        editorState.renderPivot = editorState.showObjectPivot !== false || editorState.showWorldPivot !== false;
        editorState.renderPlaneHandles = editorState.showPlaneHandles === true;
        editorState.currentCamera = clone(viewportCamera.value, "json");

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

        transformRevision.value += 1;
        markLocalTransformDirty();
        return true;
    };

    const applyGizmoDelta = event => {
        const layer = activeLayer.value;
        const geometry = ensureActiveGeometry();

        if (!layer?.id || !geometry || !transformSession) {
            return;
        }

        const local = localPointerFromEvent(event);
        const result = transformController.apply({
            event,
            local,
            element: viewportRef.value,
            camera: cameraCore,
            viewport: viewportSize,
            geometry,
            tool: transformSession.tool,
            axis: transformSession.axis,
            pivotMode: transformSession.pivotMode,
            pivotPoint: transformSession.pivotPoint,
        });

        if (!result?.geometry) {
            return;
        }

        syncLayerTransformGeometry(layer, result.geometry);
        EditorState.setSelection(editorState, { objectId: layer.id });
    };

    const beginGizmoTransform = event => {
        const geometry = ensureActiveGeometry();

        if (!geometry) {
            return;
        }

        syncEditorVisualState(activeLayer.value);
        const tool = gizmo.tool || editorState.tool || "translate";
        const axis = gizmo.axis || editorState.axis || "free";
        const pivotMode = resolvePivotMode();
        const pivotPoint = resolveGizmoPivotPoint(geometry);
        const startPointer = localPointerFromEvent(event);

        transformSession = {
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
            element: viewportRef.value,
            camera: cameraCore,
            viewport: viewportSize,
            geometry,
            tool,
            axis,
            pivotMode,
            pivotPoint,
        });

        editorState.active = true;
        editorState.dragging = true;
        editorState.tool = tool;
        editorState.axis = axis;
        editorState.pivotMode = pivotMode;
        editorState.pivotPoint = pivotPoint;
        editorState.gizmoOrigin = pivotPoint;
    };

    const endGizmoTransform = () => {
        const endedTool = transformSession?.tool || "";
        transformController.end();
        transformSession = null;
        editorState.dragging = false;

        if (["translate", "rotate", "scale", "pivot"].includes(endedTool)) {
            resetCursorPivot();
        }

        syncEditorVisualState(activeLayer.value);
    };

    const tick = (frameTime = performance.now()) => {
        const delta = lastFrameTime
            ? Math.min(Math.max((frameTime - lastFrameTime) / 1000, 0), 0.08)
            : 1 / 60;

        lastFrameTime = frameTime;
        clock.update(delta);
        cameraCore.update(clock.deltaTime);
        syncCameraState();

        rafId.value = requestAnimationFrame(tick);
    };

    const startTick = () => {
        stopTick();
        lastFrameTime = performance.now();
        clock.reset(0);
        rafId.value = requestAnimationFrame(tick);
    };

    const stopTick = () => {
        if (rafId.value) {
            cancelAnimationFrame(rafId.value);
            rafId.value = null;
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
        const handleTool = gizmoHandle?.dataset?.gizmoTool || gizmo.tool;

        if (isRight && activeLayer.value) {
            const pickedGizmo = isGizmoHandle
                ? {
                    axis: gizmoHandle?.dataset?.gizmoAxis || gizmo.axis,
                    tool: handleTool,
                }
                : pickGizmo(event);

            if (pickedGizmo && ["translate", "rotate", "scale", "pivot"].includes(pickedGizmo.tool)) {
                selectAnimatorObject(activeLayer.value);
                emitEditorPick("gizmo", pickedGizmo, event);
                gizmo.axis = pickedGizmo.axis || "free";
                gizmo.tool = pickedGizmo.tool;
                editorState.hover = clone(pickedGizmo, "json");
                editorState.cursor = pickedGizmo.tool === "rotate"
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

        if (settings.value.rightMouseOrbit && isRight) {
            return "orbit";
        }

        if (settings.value.blenderMouse && isMiddle) {
            return "orbit";
        }

        if (event.altKey && isLeft) {
            return "orbit";
        }

        return "";
    };

    const orbitByDelta = (dx, dy) => {
        const sx = settings.value.invertOrbitX ? -1 : 1;
        const sy = settings.value.invertOrbitY ? -1 : 1;

        cameraCore.orbit.theta -= dx * cameraCore.orbit.rotateSpeed * sx;
        cameraCore.orbit.phi = cameraCore.orbit.clampPhi(
            cameraCore.orbit.phi + dy * cameraCore.orbit.rotateSpeed * sy
        );
        markCameraDirty();
    };

    const panByDelta = (dx, dy) => {
        const distanceFactor = cameraCore.projection === "orthographic"
            ? cameraCore.orthographicScale
            : cameraCore.orbit.radius;

        const scale = distanceFactor * cameraCore.orbit.panSpeed;

        cameraCore.orbit.target
            .addScaled(cameraCore.orbit.right, -dx * scale)
            .addScaled(cameraCore.orbit.up, dy * scale);
        markCameraDirty();
    };

    const dollyByDelta = dy => {
        if (cameraCore.projection === "orthographic") {
            cameraCore.setOrthographicScale(
                cameraCore.orthographicScale * Math.exp(dy * cameraCore.orbit.dollySpeed)
            );
            markCameraDirty();

            return;
        }

        cameraCore.orbit.setRadius(
            cameraCore.orbit.radius * Math.exp(dy * cameraCore.orbit.dollySpeed)
        );
        markCameraDirty();
    };

    const updateHoverCursor = event => {
        if (pointer.active) {
            return;
        }

        const pickedGizmo = activeLayer.value ? pickGizmo(event) : null;

        if (pickedGizmo) {
            emitEditorPick("hover:gizmo", pickedGizmo, event);
            editorState.hover = clone(pickedGizmo, "json");
            editorState.cursor = pickedGizmo.tool === "rotate"
                ? "grab"
                : pickedGizmo.tool === "scale"
                    ? "nwse-resize"
                    : pickedGizmo.tool === "pivot"
                        ? "crosshair"
                        : "move";
            return;
        }

        editorState.hover = null;
        editorState.cursor = "default";
    };

    const editorCursorStyle = computed(() => ({
        cursor: pointer.active
            ? (pointer.mode === "orbit" ? "grabbing" : pointer.mode === "pan" ? "move" : pointer.mode === "dolly" ? "ns-resize" : editorState.cursor || "default")
            : editorState.cursor || "default",
    }));

    const onPointerDown = async event => {
        const mode = resolvePointerMode(event);

        if (!mode) {
            if (event.button === 0) {
                selectByPicking(event);
            }

            if (event.button === 2 && isObjectHit(event)) {
                selectAnimatorObject();
            }
            return;
        }

        stopNativeEvent(event);
        rootRef.value?.focus?.();

        if (mode.startsWith("gizmo-")) {
            beginGizmoTransform(event);
        }

        await mouse.down(event);

        pointer.active = true;
        pointer.pointerId = event.pointerId;
        pointer.button = event.button;
        pointer.mode = mode;
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.startX = event.clientX;
        pointer.startY = event.clientY;
        pointer.moved = false;

        event.currentTarget?.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = async event => {
        if (!pointer.active) {
            updateHoverCursor(event);
            return;
        }

        if (pointer.pointerId !== event.pointerId) {
            return;
        }

        stopNativeEvent(event);

        await mouse.move(event, ({ client, dx, dy }) => {

            pointer.x = client.x;
            pointer.y = client.y;

            if (Math.abs(client.x - pointer.startX) + Math.abs(client.y - pointer.startY) > 3) {
                pointer.moved = true;
            }

            if (pointer.mode === "orbit") {
                orbitByDelta(dx, dy);
            }

            if (pointer.mode === "pan") {
                panByDelta(dx, dy);
            }

            if (pointer.mode === "dolly") {
                dollyByDelta(dy);
            }

            if (pointer.mode.startsWith("gizmo-")) {
                applyGizmoDelta(event);
            }
        });
    };

    const onPointerUp = async event => {
        if (pointer.pointerId !== null && pointer.pointerId !== event.pointerId) {
            return;
        }

        stopNativeEvent(event);

        await mouse.up(event);

        const mode = pointer.mode;
        const moved = pointer.moved;

        pointer.active = false;
        pointer.pointerId = null;
        pointer.button = -1;
        pointer.mode = "";

        if (mode.startsWith("gizmo-")) {
            endGizmoTransform();
            releaseObjectGizmoAxis();
            if (moved || localTransformDirty) {
                submitAnimatorMesh();
            }
        }

        editorState.cursor = "default";
        event.currentTarget?.releasePointerCapture?.(event.pointerId);
    };

    const onPointerLeave = event => {
        if (!pointer.active) {
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
        cameraCore.setProjection(projection);
        markCameraDirty();
    };

    const resetView = () => {
        // Hard viewport reset: do not reload the saved layer camera.
        // The Camera panel uses this to recover a clean orbit while editing.
        cameraCore = createCameraCore(settings.value);
        cameraCore.setViewport(viewportSize.width, viewportSize.height);
        cameraCore.update(1 / 60);
        markCameraDirty();
    };

    const restoreSavedView = () => {
        loadCameraFromActiveLayer({ force: true });
    };

    const setView = view => {
        if (view === "front") {
            cameraCore.orbit.setAngles(0, 0);
        }

        if (view === "right") {
            cameraCore.orbit.setAngles(90 * DEG, 0);
        }

        if (view === "top") {
            cameraCore.orbit.setAngles(0, 89.4 * DEG);
        }

        if (view === "back") {
            cameraCore.orbit.setAngles(180 * DEG, 0);
        }

        if (view === "left") {
            cameraCore.orbit.setAngles(-90 * DEG, 0);
        }

        markCameraDirty();
    };

    const frameSelected = () => {
        if (!selectedMaterialLayers.value.length) {
            return;
        }

        const bounds = selectedMaterialLayers.value.reduce(
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

        if (!Number.isFinite(bounds.min.x) || !Number.isFinite(bounds.max.x)) {
            cameraCore.orbit.setTarget([0, 0, 0]);
            cameraCore.orbit.setRadius(settings.value.radius);
            cameraCore.setOrthographicScale(settings.value.orthographicScale);
            markCameraDirty();
            return;
        }

        const center = Vector.add(bounds.min, bounds.max).scale(0.5);
        const diagonal = Vector.sub(bounds.max, bounds.min).length();

        cameraCore.orbit.setTarget(center);
        cameraCore.orbit.setRadius(
            clamp(diagonal * 1.8 || settings.value.radius, settings.value.minRadius, settings.value.maxRadius)
        );
        cameraCore.setOrthographicScale(
            clamp(diagonal * 1.35 || settings.value.orthographicScale, settings.value.minOrthographicScale, settings.value.maxOrthographicScale)
        );
        markCameraDirty();
    };

    const focusPivot = () => {
        const geometry = normalizeMeshSettings(activeLayer.value?.geometry || activeLayer.value?.mesh?.settings || activeGeometry.value || {});
        const pivot = resolveGizmoPivotPoint(geometry);
        cameraCore.orbit.setTarget([pivot.x, pivot.y, pivot.z]);
        cameraCore.orbit.smoothTarget?.copy?.(cameraCore.orbit.target);
        markCameraDirty();
    };

    const toggleGrid = () => {
        cameraCore.backgroundGrid = cameraCore.backgroundGrid === false;
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
            commitActiveLayerState({ force: true });
            emitEvent("animator:state", false);
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
            setProjection(cameraCore.projection === "perspective" ? "orthographic" : "perspective");
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }


        if (key === "g") {
            setGizmoTool("translate");
            editorState.tool = "translate";
            editorState.cursor = "move";
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (key === "r") {
            setGizmoTool("rotate");
            editorState.tool = "rotate";
            editorState.cursor = "grab";
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (key === "s") {
            setGizmoTool("scale");
            editorState.tool = "scale";
            editorState.cursor = "nwse-resize";
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (["x", "y", "z"].includes(key)) {
            setGizmoAxis(key);
            editorState.axis = key;
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (key === "a") {
            setGizmoAxis("free");
            editorState.axis = "free";
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (event.code === "Period") {
            const modes = ["object", "median", "cursor"];
            const index = Math.max(0, modes.indexOf(resolvePivotMode()));
            setGizmoPivot(modes[(index + 1) % modes.length]);
            editorState.pivotMode = resolvePivotMode();
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

    const init = async () => {
        await nextTick();

        rootRef.value = document.getElementById(animator.id);
        viewportRef.value = document.getElementById(animator.viewportId);

        mouse.init();
        loadCameraFromActiveLayer();

        if (viewportRef.value) {
            register("add", viewportRef.value, "pointerdown", onPointerDown);
            register("add", viewportRef.value, "pointermove", onPointerMove);
            register("add", viewportRef.value, "pointerup", onPointerUp);
            register("add", viewportRef.value, "pointercancel", onPointerUp);
            register("add", viewportRef.value, "pointerleave", onPointerLeave);
            register("add", viewportRef.value, "wheel", onWheel);
            register("add", viewportRef.value, "contextmenu", preventContextMenu);
        }

        if (rootRef.value) {
            register("add", rootRef.value, "keydown", onKeyDown);
            register("add", rootRef.value, "keyup", onKeyUp);
        }

        register("add", window, "keydown", onKeyDown);
        register("add", window, "keyup", onKeyUp);

        startTick();
        rootRef.value?.focus?.();
    };

    watch(
        () => selectedMaterialLayers.value.map(layer => layer.id).join("|"),
        () => {
            if (
                !activeLayerId.value ||
                !selectedMaterialLayers.value.some(layer => layer.id === activeLayerId.value)
            ) {
                activeLayerId.value = selectedMaterialLayers.value[0]?.id || "";
            }

            animatorActiveLayerId.value = activeLayerId.value;
            loadCameraFromActiveLayer();
            if (
                animatorObjectLayerId.value &&
                !selectedMaterialLayers.value.some(layer => layer.id === animatorObjectLayerId.value)
            ) {
                clearAnimatorObjectSelection();
            }
            if (!animatorObjectLayerId.value) {
                EditorState.clearSelection(editorState);
            }
        },
        { immediate: true }
    );

    watch(
        () => createOrbitSettingsSignature(props.orbitSettings || props.settings || {}),
        () => {
            if (!loadCameraFromActiveLayer({ force: true })) {
                resetView();
            }
        }
    );

    watch(
        () => animatorCameraCommand.apply,
        () => {
            if (animatorCameraCommand.apply > 0) {
                applyCameraToActiveLayer();
            }
        }
    );

    watch(
        () => animatorCameraCommand.frame,
        () => {
            if (animatorCameraCommand.frame > 0) {
                frameSelected();
            }
        }
    );

    watch(
        () => animatorCameraCommand.reset,
        () => {
            if (animatorCameraCommand.reset > 0) {
                resetView();
            }
        }
    );

    watch(
        () => animatorCameraCommand.restore,
        () => {
            if (animatorCameraCommand.restore > 0) {
                restoreSavedView();
            }
        }
    );

    watch(
        () => animatorCameraCommand.toggleGrid,
        () => {
            if (animatorCameraCommand.toggleGrid > 0) {
                toggleGrid();
            }
        }
    );

    watch(
        () => animatorCameraCommand.projection,
        projection => {
            if (projection) {
                setProjection(projection);
                animatorCameraCommand.projection = "";
            }
        }
    );


    watch(
        () => animatorCameraCommand.fieldTick,
        () => {
            const field = animatorCameraCommand.field;

            if (field?.key) {
                setCameraNumber(field.key, field.value);
            }
        }
    );



    watch(
        () => animatorCameraCommand.focusPivot,
        () => {
            if (animatorCameraCommand.focusPivot > 0) {
                focusPivot();
            }
        }
    );

    watch(
        () => animatorCameraCommand.view,
        view => {
            if (view) {
                setView(view);
                animatorCameraCommand.view = "";
            }
        }
    );

    watch(
        () => animatorGizmo.pivotActionTick,
        () => {
            if (animatorGizmo.pivotAction) {
                applyPivotAction(animatorGizmo.pivotAction);
                animatorGizmo.pivotAction = "";
            }
        }
    );

    onMounted(init);

    onBeforeUnmount(() => {
        commitActiveLayerState({ force: true });
        clearCameraCommitTimer();
        stopTick();

        register("removeAll");
    });

    return {
        rootRef,
        viewportRef,
        animator,
        animatorStyle,
        animatorViewportStyle,
        editorCursorStyle,
        emitEvent,

        pointer,
        camera,
        gizmo,

        selectedMaterialLayers,
        activeLayer,
        objectGizmoLayer,
        objectGizmoActive,
        editorState,
        activeGeometry,
        viewportCamera,
        animatedLayers,
        transformFieldGroups,
        cameraFieldGroups,
        gridLines,
        resetView,
        restoreSavedView,
        setView,
        setProjection,
        frameSelected,
        focusPivot,
        toggleGrid,
        isActiveLayer,
        setActiveLayer,
        selectAnimatorObject,
        clearAnimatorObjectSelection,
        setObjectGizmoAxis,
        releaseObjectGizmoAxis,
        setGizmoTool,
        setGizmoAxis,
        setGizmoPivot,
        setGeometryNumber,
        resetActiveTransform,
        setCameraNumber,
        applyCameraToActiveLayer,
        submitAnimatorMesh,
    };
}

export const animatorProps = {
    selectedLayers: {
        type: Array,
        required: false,
        default: () => [],
    },

    orbitSettings: {
        type: Object,
        required: false,
        default: () => ({}),
    },

    settings: {
        type: Object,
        required: false,
        default: () => ({}),
    },

    viewport: {
        type: Object,
        required: true
    },

    editorState: {
        type: Object,
        required: false,
        default: null,
    },

    timelineTime: {
        type: Number,
        required: false,
        default: 0,
    }
};
