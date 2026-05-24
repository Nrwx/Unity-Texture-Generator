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
import {
    animatorActiveLayerId,
    animatorCameraCommand,
    animatorCameraState,
    animatorGizmo,
    animatorObjectLayerId,
} from "@/view/models/page/material/animator/state";

const DEG = Math.PI / 180;

const toNumber = (value, fallback = 0) => {
    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
};

const toVectorObject = (value, fallback = [0, 0, 0]) => Vector
    .from(value, fallback)
    .toObject();

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

    const gizmo = animatorGizmo;

    let commitTimer = null;

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
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
        const cameraPayload = viewportCamera.value;

        return selectedMaterialLayers.value.map(layer => {
            const cloned = clone(layer, "json");
            const geometry = normalizeMeshSettings(
                cloned.geometry ||
                cloned.mesh?.settings ||
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
                    mesh,
                    viewport_camera: cameraPayload,
                },

                preview: {
                    ...(cloned.preview || {}),
                    rotate: false,
                    idle_rotation: {
                        ...(cloned.preview?.idle_rotation || {}),
                        enabled: false,
                    },
                    viewport_camera: cameraPayload,
                },

                settings: {
                    ...(cloned.settings || {}),
                    rotate_preview: false,
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
        frameSelected();
    };

    const commitLayer = layer => {
        if (!layer?.id) {
            return;
        }

        emitEvent("update-layer", clone(layer, "json"));
    };

    const scheduleLayerCommit = (layer, delay = 180) => {
        if (commitTimer) {
            clearTimeout(commitTimer);
        }

        commitTimer = setTimeout(() => {
            commitTimer = null;
            commitLayer(layer);
        }, delay);
    };

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
    };

    const setGeometryNumber = (key, value, commit = true) => {
        const layer = activeLayer.value;
        const geometry = ensureActiveGeometry();

        if (!layer || !geometry) {
            return;
        }

        const fallback = key.startsWith("scale_") ? 1 : 0;
        geometry[key] = toNumber(value, fallback);
        layer.mesh.settings[key] = geometry[key];

        if (commit) {
            scheduleLayerCommit(layer);
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

        commitLayer(activeLayer.value);
    };

    const isObjectHit = event => {
        const rect = viewportRef.value?.getBoundingClientRect?.();

        if (!rect || !activeLayer.value) {
            return false;
        }

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = event.clientX - centerX;
        const dy = event.clientY - centerY;
        const radius = Math.max(42, Math.min(rect.width, rect.height) * 0.28);

        return Math.sqrt(dx * dx + dy * dy) <= radius;
    };

    const selectAnimatorObject = (layer = activeLayer.value) => {
        if (!layer?.id) {
            animatorObjectLayerId.value = "";
            return;
        }

        activeLayerId.value = layer.id;
        animatorActiveLayerId.value = layer.id;
        animatorObjectLayerId.value = layer.id;
        frameSelected();
        rootRef.value?.focus?.();
    };

    const clearAnimatorObjectSelection = () => {
        animatorObjectLayerId.value = "";
        gizmo.axis = "free";
        cameraCore.orbit.setTarget([0, 0, 0]);
        syncCameraState();
    };

    const setObjectGizmoAxis = (layer, payload) => {
        const axis = typeof payload === "object" ? payload?.axis : payload;
        const tool = typeof payload === "object" ? payload?.tool : "";

        selectAnimatorObject(layer);
        if (["translate", "rotate", "scale"].includes(tool)) {
            setGizmoTool(tool);
        }
        setGizmoAxis(axis);
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

        if (key === "orthographicScale") {
            cameraCore.setOrthographicScale(number);
        }

        syncCameraState();
    };

    const applyCameraToActiveLayer = () => {
        const layer = activeLayer.value;

        if (!layer) {
            return;
        }

        const payload = clone(viewportCamera.value, "json");

        layer.viewport_camera = payload;
        layer.settings = {
            ...(layer.settings || {}),
            animator_viewport: true,
            viewport_camera: payload,
        };
        layer.preview = {
            ...(layer.preview || {}),
            animator_viewport: true,
            viewport_camera: payload,
            rotate: false,
            idle_rotation: {
                ...(layer.preview?.idle_rotation || {}),
                enabled: false,
            },
        };

        commitLayer(layer);
    };

    const applyGizmoDelta = (dx, dy) => {
        const layer = activeLayer.value;
        const geometry = ensureActiveGeometry();

        if (!layer || !geometry) {
            return;
        }

        const axis = gizmo.axis;
        const distanceFactor = cameraCore.projection === "orthographic"
            ? cameraCore.orthographicScale
            : cameraCore.orbit.radius;
        const translateScale = Math.max(0.001, distanceFactor * 0.0025);

        if (gizmo.tool === "translate") {
            if (axis === "x" || axis === "free") {
                geometry.position_x += dx * translateScale;
            }

            if (axis === "z" || axis === "free") {
                geometry.position_z -= dy * translateScale;
            }

            if (axis === "y") {
                geometry.position_y += (dx - dy) * translateScale;
            }
        }

        if (gizmo.tool === "rotate") {
            const rotateScale = 0.35;

            if (axis === "x") {
                geometry.rotation_x += dy * rotateScale;
            } else if (axis === "z") {
                geometry.rotation_z += dx * rotateScale;
            } else {
                geometry.rotation_y += dx * rotateScale;

                if (axis === "free") {
                    geometry.rotation_x += dy * rotateScale;
                }
            }
        }

        if (gizmo.tool === "scale") {
            const factor = Math.max(0.01, 1 + (dx - dy) * 0.006);
            const applyScale = key => {
                geometry[key] = Math.max(0.001, geometry[key] * factor);
            };

            if (axis === "x") {
                applyScale("scale_x");
            } else if (axis === "y") {
                applyScale("scale_y");
            } else if (axis === "z") {
                applyScale("scale_z");
            } else {
                applyScale("scale_x");
                applyScale("scale_y");
                applyScale("scale_z");
            }
        }

        layer.mesh.settings = {
            ...(layer.mesh?.settings || {}),
            ...geometry,
        };
    };

    const updateViewportSize = () => {
        const size = normalizeViewportSize();

        viewportSize.width = size.width;
        viewportSize.height = size.height;

        syncCameraState();
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

        if (
            isRight &&
            isGizmoHandle &&
            objectGizmoActive.value &&
            ["translate", "rotate", "scale"].includes(handleTool)
        ) {
            return `gizmo-${handleTool}`;
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
    };

    const panByDelta = (dx, dy) => {
        const distanceFactor = cameraCore.projection === "orthographic"
            ? cameraCore.orthographicScale
            : cameraCore.orbit.radius;

        const scale = distanceFactor * cameraCore.orbit.panSpeed;

        cameraCore.orbit.target
            .addScaled(cameraCore.orbit.right, -dx * scale)
            .addScaled(cameraCore.orbit.up, dy * scale);
    };

    const dollyByDelta = dy => {
        if (cameraCore.projection === "orthographic") {
            cameraCore.setOrthographicScale(
                cameraCore.orthographicScale * Math.exp(dy * cameraCore.orbit.dollySpeed)
            );

            return;
        }

        cameraCore.orbit.setRadius(
            cameraCore.orbit.radius * Math.exp(dy * cameraCore.orbit.dollySpeed)
        );
    };

    const onPointerDown = async event => {
        const mode = resolvePointerMode(event);

        if (!mode) {
            if (event.button === 0) {
                clearAnimatorObjectSelection();
            }

            if (event.button === 2 && isObjectHit(event)) {
                selectAnimatorObject();
            }
            return;
        }

        stopNativeEvent(event);
        rootRef.value?.focus?.();

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
        if (!pointer.active || pointer.pointerId !== event.pointerId) {
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
                applyGizmoDelta(dx, dy);
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
            if (moved) {
                commitLayer(activeLayer.value);
            }
            releaseObjectGizmoAxis();
        }

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
    };

    const preventContextMenu = event => {
        stopNativeEvent(event);
    };

    const setProjection = projection => {
        cameraCore.setProjection(projection);
        syncCameraState();
    };

    const resetView = () => {
        cameraCore = createCameraCore(settings.value);
        cameraCore.setViewport(viewportSize.width, viewportSize.height);
        syncCameraState();
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
    };

    const toggleGrid = () => {
        cameraCore.backgroundGrid = cameraCore.backgroundGrid === false;
        syncCameraState();
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
            emitEvent("animator:state", false);
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
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (key === "r") {
            setGizmoTool("rotate");
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (key === "s") {
            setGizmoTool("scale");
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (key === "x" || key === "y" || key === "z") {
            setGizmoAxis(key);
            stopNativeEvent(event);
            emitEvent("apply-key-down", event);
            return;
        }

        if (event.code === "KeyB") {
            toggleGrid();
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
        updateViewportSize();

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

        startTick();
        frameSelected();
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
            if (
                animatorObjectLayerId.value &&
                !selectedMaterialLayers.value.some(layer => layer.id === animatorObjectLayerId.value)
            ) {
                clearAnimatorObjectSelection();
            }
            if (!animatorObjectLayerId.value) {
                cameraCore.orbit.setTarget([0, 0, 0]);
                syncCameraState();
                return;
            }

            nextTick(frameSelected);
        },
        { immediate: true }
    );

    watch(
        () => createOrbitSettingsSignature(props.orbitSettings || props.settings || {}),
        () => {
            resetView();
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
        () => animatorCameraCommand.view,
        view => {
            if (view) {
                setView(view);
                animatorCameraCommand.view = "";
            }
        }
    );

    watch(
        () => [
            props.viewport?.width,
            props.viewport?.height,
        ],
        () => {
            updateViewportSize();
        },
        { immediate: true }
    );

    onMounted(init);

    onBeforeUnmount(() => {
        stopTick();

        if (commitTimer) {
            clearTimeout(commitTimer);
            commitTimer = null;
        }

        register("removeAll");
    });

    return {
        rootRef,
        viewportRef,
        animator,
        animatorStyle,
        animatorViewportStyle,
        emitEvent,

        pointer,
        camera,
        gizmo,

        selectedMaterialLayers,
        activeLayer,
        objectGizmoLayer,
        objectGizmoActive,
        activeGeometry,
        viewportCamera,
        animatedLayers,
        transformFieldGroups,
        cameraFieldGroups,
        gridLines,
        resetView,
        setView,
        setProjection,
        frameSelected,
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
    };
}

export const animatorProps = {
    selectedLayers: {
        type: Array,
        required: true,
    },

    orbitSettings: {
        type: Object,
        required: true,
    },

    viewport: {
        type: Object,
        required: true
    },

    timelineTime: {
        type: Number,
        required: true
    }
};
