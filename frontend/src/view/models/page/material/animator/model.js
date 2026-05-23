import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
} from "vue";

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (a, b, t) => a + (b - a) * t;

const clonePlain = value => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

const toNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const normalizeVector3 = value => ({
    x: toNumber(value?.x ?? value?.[0], 0),
    y: toNumber(value?.y ?? value?.[1], 0),
    z: toNumber(value?.z ?? value?.[2], 0),
});

const add3 = (a, b) => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
});

const sub3 = (a, b) => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
});

const mul3 = (a, scalar) => ({
    x: a.x * scalar,
    y: a.y * scalar,
    z: a.z * scalar,
});

const length3 = vector => Math.hypot(vector.x, vector.y, vector.z) || 1;

const normalize3 = vector => {
    const length = length3(vector);

    return {
        x: vector.x / length,
        y: vector.y / length,
        z: vector.z / length,
    };
};

const cross3 = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
});

const createDefaultOrbitSettings = settings => ({
    projection: settings?.projection || "perspective",

    fov: toNumber(settings?.fov, 50),
    near: toNumber(settings?.near, 0.01),
    far: toNumber(settings?.far, 1000),

    radius: toNumber(settings?.radius, 4.6),
    minRadius: toNumber(settings?.minRadius, 0.18),
    maxRadius: toNumber(settings?.maxRadius, 250),

    orthographicScale: toNumber(settings?.orthographicScale, 5),
    minOrthographicScale: toNumber(settings?.minOrthographicScale, 0.05),
    maxOrthographicScale: toNumber(settings?.maxOrthographicScale, 250),

    theta: toNumber(settings?.theta, -45 * DEG),
    phi: toNumber(settings?.phi, 58 * DEG),

    minPhi: toNumber(settings?.minPhi, -89.5 * DEG),
    maxPhi: toNumber(settings?.maxPhi, 89.5 * DEG),

    target: normalizeVector3(settings?.target || { x: 0, y: 0, z: 0 }),

    rotateSpeed: toNumber(settings?.rotateSpeed, 0.0065),
    panSpeed: toNumber(settings?.panSpeed, 0.0028),
    dollySpeed: toNumber(settings?.dollySpeed, 0.0018),
    wheelSpeed: toNumber(settings?.wheelSpeed, 0.0012),

    damping: toNumber(settings?.damping, 18),
    invertOrbitX: settings?.invertOrbitX === true,
    invertOrbitY: settings?.invertOrbitY === true,

    blenderMouse: settings?.blenderMouse !== false,
    rightMouseOrbit: settings?.rightMouseOrbit !== false,

    backgroundGrid: settings?.backgroundGrid !== false,
    showAxisGizmo: settings?.showAxisGizmo !== false,
});

const cameraVectorsFromSpherical = camera => {
    const cosPhi = Math.cos(camera.phi);
    const sinPhi = Math.sin(camera.phi);
    const cosTheta = Math.cos(camera.theta);
    const sinTheta = Math.sin(camera.theta);

    const direction = normalize3({
        x: cosPhi * sinTheta,
        y: sinPhi,
        z: cosPhi * cosTheta,
    });

    const position = add3(
        camera.target,
        mul3(direction, camera.radius)
    );

    const forward = normalize3(sub3(camera.target, position));
    const worldUp = { x: 0, y: 1, z: 0 };
    const right = normalize3(cross3(forward, worldUp));
    const up = normalize3(cross3(right, forward));

    return {
        position,
        target: camera.target,
        forward,
        right,
        up,
    };
};

const normalizeMeshSettings = settings => ({
    ...(settings || {}),
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

export function animatorModel(props, emit) {
    const rootRef = ref(null);
    const viewportRef = ref(null);
    const rafId = ref(null);
    const activeLayerId = ref("");

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

    const settings = computed(() => createDefaultOrbitSettings(props.orbitSettings || {}));

    const camera = reactive({
        projection: settings.value.projection,

        fov: settings.value.fov,
        near: settings.value.near,
        far: settings.value.far,

        theta: settings.value.theta,
        phi: settings.value.phi,
        radius: settings.value.radius,

        orthographicScale: settings.value.orthographicScale,
        target: { ...settings.value.target },

        smoothTheta: settings.value.theta,
        smoothPhi: settings.value.phi,
        smoothRadius: settings.value.radius,
        smoothOrthographicScale: settings.value.orthographicScale,
        smoothTarget: { ...settings.value.target },

        position: { x: 0, y: 0, z: 0 },
        forward: { x: 0, y: 0, z: -1 },
        right: { x: 1, y: 0, z: 0 },
        up: { x: 0, y: 1, z: 0 },
    });

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
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

    const activeLayerLabel = computed(() => (
        activeLayer.value?.name ||
        activeLayer.value?.id ||
        "None"
    ));

    const formattedTimelineTime = computed(() => {
        const value = toNumber(props.timelineTime, 0);
        return Number.isInteger(value) ? String(value) : value.toFixed(3);
    });

    const viewportSize = reactive({
        width: 1,
        height: 1,
    });

    const viewportAspect = computed(() => (
        viewportSize.height > 0
            ? viewportSize.width / viewportSize.height
            : 1
    ));

    const viewportCamera = computed(() => ({
        mode: "world_orbit",
        projection: camera.projection,

        fov: camera.fov,
        near: camera.near,
        far: camera.far,
        aspect: viewportAspect.value,

        radius: camera.smoothRadius,
        orthographic_scale: camera.smoothOrthographicScale,

        theta: camera.smoothTheta,
        phi: camera.smoothPhi,

        target: {
            ...camera.smoothTarget,
        },

        position: {
            ...camera.position,
        },

        forward: {
            ...camera.forward,
        },

        right: {
            ...camera.right,
        },

        up: {
            ...camera.up,
        },
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
            const cloned = clonePlain(layer);
            const mesh = {
                ...(cloned.mesh || {}),
                settings: normalizeMeshSettings(cloned.mesh?.settings),
            };

            return {
                ...cloned,

                width: viewportSize.width || cloned.width || 512,
                height: viewportSize.height || cloned.height || 512,

                time: props.timelineTime,

                mesh,
                shader: {
                    ...(cloned.shader || {}),
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
                },
                viewport_camera: cameraPayload,
            };
        });
    });

    const isActiveLayer = layer => layer?.id && activeLayer.value?.id === layer.id;

    const updateViewportSize = () => {
        const rect = viewportRef.value?.getBoundingClientRect?.();

        if (!rect) {
            return;
        }

        viewportSize.width = Math.max(1, Math.round(rect.width));
        viewportSize.height = Math.max(1, Math.round(rect.height));
    };

    let resizeObserver = null;

    const syncCameraVectors = () => {
        const vectors = cameraVectorsFromSpherical({
            theta: camera.smoothTheta,
            phi: camera.smoothPhi,
            radius: camera.smoothRadius,
            target: camera.smoothTarget,
        });

        camera.position = vectors.position;
        camera.forward = vectors.forward;
        camera.right = vectors.right;
        camera.up = vectors.up;
    };

    const tick = () => {
        const damping = Math.max(1, settings.value.damping);
        const t = 1 - Math.exp(-damping / 60);

        camera.smoothTheta = lerp(camera.smoothTheta, camera.theta, t);
        camera.smoothPhi = lerp(camera.smoothPhi, camera.phi, t);
        camera.smoothRadius = lerp(camera.smoothRadius, camera.radius, t);
        camera.smoothOrthographicScale = lerp(
            camera.smoothOrthographicScale,
            camera.orthographicScale,
            t
        );

        camera.smoothTarget = {
            x: lerp(camera.smoothTarget.x, camera.target.x, t),
            y: lerp(camera.smoothTarget.y, camera.target.y, t),
            z: lerp(camera.smoothTarget.z, camera.target.z, t),
        };

        syncCameraVectors();

        rafId.value = requestAnimationFrame(tick);
    };

    const stopTick = () => {
        if (rafId.value) {
            cancelAnimationFrame(rafId.value);
            rafId.value = null;
        }
    };

    const startTick = () => {
        stopTick();
        rafId.value = requestAnimationFrame(tick);
    };

    const resolvePointerMode = event => {
        const isRight = event.button === 2;
        const isMiddle = event.button === 1;
        const isLeft = event.button === 0;

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

    const stopNativeEvent = event => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
    };

    const onPointerDown = event => {
        const mode = resolvePointerMode(event);

        if (!mode) {
            return;
        }

        stopNativeEvent(event);

        rootRef.value?.focus?.();

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

    const orbitByDelta = (dx, dy) => {
        const sx = settings.value.invertOrbitX ? -1 : 1;
        const sy = settings.value.invertOrbitY ? -1 : 1;

        camera.theta -= dx * settings.value.rotateSpeed * sx;
        camera.phi += dy * settings.value.rotateSpeed * sy;
        camera.phi = clamp(camera.phi, settings.value.minPhi, settings.value.maxPhi);
    };

    const panByDelta = (dx, dy) => {
        const distanceFactor = camera.projection === "orthographic"
            ? camera.orthographicScale
            : camera.radius;

        const scale = distanceFactor * settings.value.panSpeed;
        const rightMove = mul3(camera.right, -dx * scale);
        const upMove = mul3(camera.up, dy * scale);

        camera.target = add3(camera.target, add3(rightMove, upMove));
    };

    const dollyByDelta = dy => {
        if (camera.projection === "orthographic") {
            const nextScale = camera.orthographicScale * Math.exp(dy * settings.value.dollySpeed);
            camera.orthographicScale = clamp(
                nextScale,
                settings.value.minOrthographicScale,
                settings.value.maxOrthographicScale
            );
            return;
        }

        const nextRadius = camera.radius * Math.exp(dy * settings.value.dollySpeed);
        camera.radius = clamp(nextRadius, settings.value.minRadius, settings.value.maxRadius);
    };

    const onPointerMove = event => {
        if (!pointer.active || pointer.pointerId !== event.pointerId) {
            return;
        }

        stopNativeEvent(event);

        const dx = event.clientX - pointer.x;
        const dy = event.clientY - pointer.y;

        pointer.x = event.clientX;
        pointer.y = event.clientY;

        if (Math.abs(event.clientX - pointer.startX) + Math.abs(event.clientY - pointer.startY) > 3) {
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
    };

    const onPointerUp = event => {
        if (pointer.pointerId !== null && pointer.pointerId !== event.pointerId) {
            return;
        }

        stopNativeEvent(event);

        pointer.active = false;
        pointer.pointerId = null;
        pointer.button = -1;
        pointer.mode = "";

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

        const delta = event.deltaY;
        const multiplier = event.shiftKey ? 0.35 : 1;

        if (event.ctrlKey || event.metaKey) {
            dollyByDelta(delta * multiplier * 2);
        } else {
            dollyByDelta(delta * multiplier);
        }
    };

    const setProjection = projection => {
        camera.projection = projection === "orthographic"
            ? "orthographic"
            : "perspective";
    };

    const resetView = () => {
        const next = createDefaultOrbitSettings(props.orbitSettings || {});

        camera.projection = next.projection;
        camera.fov = next.fov;
        camera.near = next.near;
        camera.far = next.far;
        camera.theta = next.theta;
        camera.phi = next.phi;
        camera.radius = next.radius;
        camera.orthographicScale = next.orthographicScale;
        camera.target = { ...next.target };
    };

    const setView = view => {
        if (view === "front") {
            camera.theta = 0;
            camera.phi = 0;
        }

        if (view === "right") {
            camera.theta = 90 * DEG;
            camera.phi = 0;
        }

        if (view === "top") {
            camera.theta = 0;
            camera.phi = 89.4 * DEG;
        }

        if (view === "back") {
            camera.theta = 180 * DEG;
            camera.phi = 0;
        }

        if (view === "left") {
            camera.theta = -90 * DEG;
            camera.phi = 0;
        }

        camera.phi = clamp(camera.phi, settings.value.minPhi, settings.value.maxPhi);
    };

    const frameSelected = () => {
        if (!selectedMaterialLayers.value.length) {
            return;
        }

        const bounds = selectedMaterialLayers.value.reduce(
            (acc, layer) => {
                const meshBounds = layer?.mesh?.bounds || layer?.bounds || {};
                const min = normalizeVector3(meshBounds.min || [-0.5, -0.5, -0.5]);
                const max = normalizeVector3(meshBounds.max || [0.5, 0.5, 0.5]);

                acc.min.x = Math.min(acc.min.x, min.x);
                acc.min.y = Math.min(acc.min.y, min.y);
                acc.min.z = Math.min(acc.min.z, min.z);

                acc.max.x = Math.max(acc.max.x, max.x);
                acc.max.y = Math.max(acc.max.y, max.y);
                acc.max.z = Math.max(acc.max.z, max.z);

                return acc;
            },
            {
                min: { x: Infinity, y: Infinity, z: Infinity },
                max: { x: -Infinity, y: -Infinity, z: -Infinity },
            }
        );

        if (!Number.isFinite(bounds.min.x) || !Number.isFinite(bounds.max.x)) {
            camera.target = { x: 0, y: 0, z: 0 };
            camera.radius = settings.value.radius;
            return;
        }

        const center = mul3(add3(bounds.min, bounds.max), 0.5);
        const diagonal = length3(sub3(bounds.max, bounds.min));

        camera.target = center;
        camera.radius = clamp(
            diagonal * 1.8 || settings.value.radius,
            settings.value.minRadius,
            settings.value.maxRadius
        );
        camera.orthographicScale = clamp(
            diagonal * 1.35 || settings.value.orthographicScale,
            settings.value.minOrthographicScale,
            settings.value.maxOrthographicScale
        );
    };

    const onKeyDown = event => {
        keys.shift = event.shiftKey;
        keys.alt = event.altKey;
        keys.ctrl = event.ctrlKey;
        keys.meta = event.metaKey;

        if (event.code === "Home" || event.code === "KeyF") {
            frameSelected();
            event.preventDefault();
        }

        if (event.code === "Numpad1" || event.code === "Digit1") {
            setView(event.ctrlKey ? "back" : "front");
            event.preventDefault();
        }

        if (event.code === "Numpad3" || event.code === "Digit3") {
            setView(event.ctrlKey ? "left" : "right");
            event.preventDefault();
        }

        if (event.code === "Numpad7" || event.code === "Digit7") {
            setView("top");
            event.preventDefault();
        }

        if (event.code === "Numpad5" || event.code === "Digit5") {
            setProjection(camera.projection === "perspective" ? "orthographic" : "perspective");
            event.preventDefault();
        }
    };

    const onKeyUp = event => {
        keys.shift = event.shiftKey;
        keys.alt = event.altKey;
        keys.ctrl = event.ctrlKey;
        keys.meta = event.metaKey;
    };

    const degrees = value => value * RAD;

    watch(
        () => selectedMaterialLayers.value.map(layer => layer.id).join("|"),
        () => {
            if (
                !activeLayerId.value ||
                !selectedMaterialLayers.value.some(layer => layer.id === activeLayerId.value)
            ) {
                activeLayerId.value = selectedMaterialLayers.value[0]?.id || "";
            }

            nextTick(frameSelected);
        },
        { immediate: true }
    );

    watch(
        () => props.orbitSettings,
        () => {
            resetView();
        },
        { deep: true }
    );

    onMounted(() => {
        nextTick(() => {
            updateViewportSize();

            if (typeof ResizeObserver !== "undefined" && viewportRef.value) {
                resizeObserver = new ResizeObserver(updateViewportSize);
                resizeObserver.observe(viewportRef.value);
            }

            startTick();
            frameSelected();
            rootRef.value?.focus?.();
        });
    });

    onBeforeUnmount(() => {
        stopTick();

        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
    });

    return {
        emitEvent,
        rootRef,
        viewportRef,

        pointer,
        camera,

        selectedMaterialLayers,
        activeLayer,
        activeLayerLabel,
        formattedTimelineTime,
        viewportCamera,
        animatedLayers,
        gridLines,

        isActiveLayer,
        setProjection,
        resetView,
        frameSelected,

        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerLeave,
        onWheel,
        onKeyDown,
        onKeyUp,

        degrees,
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
    timeline: {
        type: Boolean,
        required: false,
        default: false,
    },
    miniTimeline: {
        type: Boolean,
        required: false,
        default: false,
    },
    timelinePlay: {
        type: Boolean,
        required: false,
        default: false,
    },
    timelineTime: {
        type: Number,
        required: false,
        default: 0,
    },
    viewport: {
        type: Object,
        required: false,
        default: () => ({}),
    },
    settings: {
        type: Object,
        required: false,
        default: () => ({}),
    },
};