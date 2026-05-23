import { computed, reactive, watch } from "vue";
import { ParticleSystem } from "@/view/models/page/material/core/ParticleSystem/ParticleSystem";

export const PARTICLE_MODE_OPTIONS = Object.freeze(["texture", "mesh", "mixed"]);
export const PARTICLE_SOURCE_OPTIONS = Object.freeze(["texture", "mesh", "volume"]);
export const PARTICLE_EMITTER_OPTIONS = Object.freeze(["volume", "surface", "vertices", "sphere", "plane"]);
export const PARTICLE_ROOT_ANIMATION_OPTIONS = Object.freeze(["point", "inner", "outer"]);
export const PARTICLE_BLEND_OPTIONS = Object.freeze(["alpha", "additive", "screen"]);
export const PARTICLE_INTERPOLATION_ATTRIBUTES = ParticleSystem.INTERPOLATION_ATTRIBUTES;

export const createParticleSystem = () => ParticleSystem.create();

const cloneData = value => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

const normalizeParticleSystem = value => ParticleSystem.fromPlain(value || {});
const toNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};
const clampValue = (value, minimum, maximum) => Math.min(Math.max(toNumber(value), minimum), maximum);
const clamp01 = value => clampValue(value, 0, 1);
const colorToHex = color => {
    const channels = Array.isArray(color) ? color : [1, 1, 1];

    return `#${channels.slice(0, 3).map(value => (
        Math.round(clamp01(value) * 255).toString(16).padStart(2, "0")
    )).join("")}`;
};
const hexToColor = value => {
    const hex = String(value || "").replace("#", "").trim();

    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
        return [1, 1, 1, 1];
    }

    return [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
        1,
    ];
};
const parsePickerColor = value => {
    if (value && typeof value === "object" && Number.isFinite(Number(value.r))) {
        return [
            clamp01(Number(value.r) / 255),
            clamp01(Number(value.g) / 255),
            clamp01(Number(value.b) / 255),
            1,
        ];
    }

    return hexToColor(typeof value === "string" ? value : value?.hex || value?.hexa || value);
};
const normalizeColorRampStop = (stop = {}, index = 0) => ({
    id: stop.id || `particle-color-stop-${index}`,
    t: clamp01(stop.t ?? index),
    color: Array.isArray(stop.color) ? stop.color : [1, 1, 1, 1],
});

export const particleSystemModelProps = {
    particleSystem: {
        type: Object,
        default: () => createParticleSystem(),
    },
    textureLayers: {
        type: Array,
        default: () => [],
    },
};

export const particleSystemModelEmits = [
    "update:particleSystem",
    "change",
    "assign-texture-slot",
];

export function particleSystemModel(props, emit) {
    const state = reactive({
        particleSystem: normalizeParticleSystem(props.particleSystem),
        interpolationAttribute: props.particleSystem?.interpolation_attribute || "alpha",
        interpolationDrag: null,
        layerDragId: "",
        activeColorRampStopId: "",
    });

    watch(
        () => props.particleSystem,
        value => {
            state.particleSystem = normalizeParticleSystem(value);
            state.interpolationAttribute = state.particleSystem.interpolation_attribute || state.interpolationAttribute || "alpha";
        },
        { deep: true }
    );

    const restartParticleSystem = () => {
        state.particleSystem.age = 0;
        state.particleSystem.meta = {
            ...(state.particleSystem.meta || {}),
            restart_at: Date.now(),
        };
    };

    const scaleLifetimeCurves = (oldLifetime, newLifetime) => {
        const from = Math.max(0.001, Number(oldLifetime) || 1);
        const to = Math.max(0.001, Number(newLifetime) || 1);
        const ratio = to / from;

        state.particleSystem.interpolations = Object.entries(state.particleSystem.interpolations || {})
            .reduce((acc, [key, points]) => {
                acc[key] = Array.isArray(points)
                    ? points.map(point => ({
                        ...point,
                        x: Math.round(clampValue((Number(point.x) || 0) * ratio, 0, to) * 1000) / 1000,
                    }))
                    : points;
                return acc;
            }, {});

        if (Array.isArray(state.particleSystem.path_follow?.points)) {
            state.particleSystem.path_follow.points = state.particleSystem.path_follow.points
                .map(point => ({
                    ...point,
                    t: Math.round(clampValue((Number(point.t) || 0) * ratio, 0, to) * 1000) / 1000,
                }))
                .sort((a, b) => a.t - b.t);
        }
    };

    const emitParticleSystem = ({ restart = false } = {}) => {
        if (restart) {
            restartParticleSystem();
        }

        const particleSystem = cloneData(state.particleSystem);

        emit("update:particleSystem", particleSystem);
        emit("change", particleSystem);
    };

    const setParticleValue = (key, value) => {
        state.particleSystem[key] = value;
        if (key === "texture_slot") {
            const activeId = state.particleSystem.active_layer_id;
            state.particleSystem.layers = (state.particleSystem.layers || []).map(layer => (
                layer.id === activeId ? { ...layer, texture_slot: value } : layer
            ));
        }
        emitParticleSystem({ restart: true });
    };

    const setParticleNumber = (key, value) => {
        const nextValue = toNumber(value);

        if (key === "lifetime") {
            scaleLifetimeCurves(state.particleSystem.lifetime, nextValue);
        }

        state.particleSystem[key] = nextValue;
        emitParticleSystem({ restart: key !== "age" });
    };

    const setParticleBoolean = (key, value) => {
        state.particleSystem[key] = value === true;
        if (key === "enabled" && value === true) {
            state.particleSystem = {
                ...state.particleSystem,
                ...ParticleSystem.normalize(state.particleSystem),
            };
        }
        emitParticleSystem({ restart: true });
    };

    const setParticleColor = (index, value) => {
        const color = Array.isArray(state.particleSystem.color)
            ? [...state.particleSystem.color]
            : [1, 1, 1, 1];

        color[index] = toNumber(value);
        state.particleSystem.color = color;
        emitParticleSystem({ restart: true });
    };

    const activeInterpolationPoints = computed(() => (
        state.particleSystem.interpolations?.[state.interpolationAttribute] || []
    ));

    const lifetimeWidth = computed(() => Math.max(0.001, Number(state.particleSystem.lifetime) || 1));

    const interpolationPolyline = computed(() => activeInterpolationPoints.value
        .map(point => `${(point.x / lifetimeWidth.value) * 100},${interpolationPointY(point)}`)
        .join(" "));

    const pathFollowPoints = computed(() => state.particleSystem.path_follow?.points || []);
    const activePathPoint = computed(() => (
        pathFollowPoints.value.find(point => point.id === state.particleSystem.path_follow?.active_point_id) ||
        pathFollowPoints.value[0] ||
        null
    ));
    const pathTimePolyline = computed(() => pathFollowPoints.value
        .map(point => `${(point.t / lifetimeWidth.value) * 100},12`)
        .join(" "));
    const pathSidePolyline = computed(() => pathFollowPoints.value
        .map(point => `${50 + (point.translate?.x || 0) * 24},${50 - (point.translate?.y || 0) * 24}`)
        .join(" "));
    const pathTopPolyline = computed(() => pathFollowPoints.value
        .map(point => `${50 + (point.translate?.x || 0) * 24},${50 - (point.translate?.z || 0) * 24}`)
        .join(" "));
    const particleLayers = computed(() => state.particleSystem.layers || []);
    const activeParticleLayer = computed(() => (
        particleLayers.value.find(layer => layer.id === state.particleSystem.active_layer_id) ||
        particleLayers.value[0] ||
        null
    ));
    const textureLayerOptions = computed(() => [
        { title: "Keine direkte Texture", value: "" },
        ...(props.textureLayers || []).map(layer => ({
            title: layer.name || layer.id,
            value: layer.id,
        })),
    ]);

    const ensureParticleLayers = () => {
        state.particleSystem = {
            ...state.particleSystem,
            ...ParticleSystem.normalize(state.particleSystem),
        };

        return state.particleSystem.layers || [];
    };

    const setInterpolationAttribute = value => {
        state.interpolationAttribute = value;
        state.particleSystem.interpolation_attribute = value;
        emitParticleSystem();
    };

    const ensureInterpolationPoints = attribute => {
        state.particleSystem.interpolations = ParticleSystem.normalizeInterpolations(
            state.particleSystem.interpolations || {},
            lifetimeWidth.value
        );

        if (!state.particleSystem.interpolations[attribute]) {
            state.particleSystem.interpolations[attribute] = ParticleSystem.normalizeInterpolations(
                { [attribute]: [] },
                lifetimeWidth.value
            )[attribute];
        }

        return state.particleSystem.interpolations[attribute];
    };

    const pointerToInterpolationPoint = (event, target = event.currentTarget) => {
        const rect = target.getBoundingClientRect();
        const x = Math.min(Math.max((event.clientX - rect.left) / Math.max(rect.width, 1), 0), 1) * lifetimeWidth.value;
        const rawRatio = Math.min(Math.max((event.clientY - rect.top) / Math.max(rect.height, 1), 0), 1);
        const y = state.interpolationAttribute === "alpha"
            ? Math.round((1 - rawRatio) * 1000) / 1000
            : clampValue((0.5 - rawRatio) * 100, -50, 50);

        return { x, y };
    };

    const interpolationPointY = point => {
        if (state.interpolationAttribute === "alpha") {
            return 100 - clampValue(point?.y, 0, 1) * 100;
        }

        return 50 - (Number(point?.y) || 0);
    };

    const updateInterpolationPoint = (attribute, index, point) => {
        const points = ensureInterpolationPoints(attribute).map((item, itemIndex) => (
            itemIndex === index ? point : item
        ));

        state.particleSystem.interpolations[attribute] = points
            .sort((a, b) => a.x - b.x)
            .map(item => ({
                x: Math.round(item.x * 1000) / 1000,
                y: Math.round((attribute === "alpha" ? clampValue(item.y, 0, 1) : item.y) * 1000) / 1000,
            }));
    };

    const updateInterpolationPointValue = (index, value) => {
        const attribute = state.interpolationAttribute;
        const points = ensureInterpolationPoints(attribute);
        const current = points[index];

        if (!current) {
            return;
        }

        updateInterpolationPoint(attribute, index, {
            ...current,
            y: attribute === "alpha"
                ? clampValue(value, 0, 1)
                : clampValue(value, -1000, 1000),
        });
        emitParticleSystem({ restart: true });
    };

    const stopInterpolationDrag = () => {
        if (!state.interpolationDrag) {
            return;
        }

        state.interpolationDrag = null;
        window.removeEventListener("pointermove", moveInterpolationPoint);
        window.removeEventListener("pointerup", stopInterpolationDrag);
        emitParticleSystem({ restart: true });
    };

    const moveInterpolationPoint = event => {
        if (!state.interpolationDrag) {
            return;
        }

        const { attribute, index, target } = state.interpolationDrag;
        updateInterpolationPoint(attribute, index, pointerToInterpolationPoint(event, target));
    };

    const startInterpolationPoint = (event, index) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        state.interpolationDrag = {
            attribute: state.interpolationAttribute,
            index,
            target: event.currentTarget.closest(".mem-particle-curve-box"),
        };

        updateInterpolationPoint(
            state.interpolationAttribute,
            index,
            pointerToInterpolationPoint(event, state.interpolationDrag.target)
        );

        window.addEventListener("pointermove", moveInterpolationPoint);
        window.addEventListener("pointerup", stopInterpolationDrag);
    };

    const addInterpolationPoint = event => {
        if (!event.altKey || event.button !== 0) {
            return;
        }

        const attribute = state.interpolationAttribute;
        const point = pointerToInterpolationPoint(event);
        const points = ensureInterpolationPoints(attribute);

        points.push(point);
        state.particleSystem.interpolations[attribute] = points.sort((a, b) => a.x - b.x);
        emitParticleSystem({ restart: true });
    };

    const deleteInterpolationPoint = index => {
        const attribute = state.interpolationAttribute;
        const points = ensureInterpolationPoints(attribute);

        if (points.length <= 1) {
            return;
        }

        state.particleSystem.interpolations[attribute] = points.filter((_point, pointIndex) => pointIndex !== index);
        emitParticleSystem({ restart: true });
    };

    const handleInterpolationContext = (event, index = null) => {
        event.preventDefault();

        if (!event.altKey) {
            return;
        }

        if (index !== null) {
            deleteInterpolationPoint(index);
            return;
        }

        const points = ensureInterpolationPoints(state.interpolationAttribute);
        const point = pointerToInterpolationPoint(event);
        const nearestIndex = points.reduce((best, item, itemIndex) => {
            const distance = Math.hypot(item.x - point.x, item.y - point.y);
            return distance < best.distance ? { index: itemIndex, distance } : best;
        }, { index: -1, distance: Infinity }).index;

        if (nearestIndex >= 0) {
            deleteInterpolationPoint(nearestIndex);
        }
    };

    const resetInterpolation = () => {
        const attribute = state.interpolationAttribute;
        const fallback = PARTICLE_INTERPOLATION_ATTRIBUTES.find(item => item.key === attribute)?.defaultValue ?? 0;
        state.particleSystem.interpolations = {
            ...(state.particleSystem.interpolations || {}),
            [attribute]: [
                { x: 0, y: fallback },
                { x: lifetimeWidth.value / 2, y: fallback },
                { x: lifetimeWidth.value, y: fallback },
            ],
        };
        emitParticleSystem({ restart: true });
    };

    const ensurePathFollow = () => {
        state.particleSystem.path_follow = ParticleSystem.normalizePathFollow(
            state.particleSystem.path_follow || {},
            lifetimeWidth.value
        );

        return state.particleSystem.path_follow;
    };

    const setPathFollowEnabled = value => {
        const path = ensurePathFollow();
        path.enabled = value === true;
        emitParticleSystem({ restart: true });
    };

    const setActivePathPoint = pointId => {
        const path = ensurePathFollow();
        path.active_point_id = pointId;
        emitParticleSystem();
    };

    const setActiveParticleLayer = layerId => {
        const layers = ensureParticleLayers();
        const layer = layers.find(item => item.id === layerId) || layers[0];

        if (!layer) {
            return;
        }

        state.particleSystem.active_layer_id = layer.id;
        state.particleSystem.texture_slot = "baseColor";
        emitParticleSystem({ restart: true });
    };

    const colorRampStops = computed(() => {
        const stops = Array.isArray(state.particleSystem.color_ramp) && state.particleSystem.color_ramp.length
            ? state.particleSystem.color_ramp
            : [
                { id: "particle-color-start", t: 0, color: state.particleSystem.color || [1, 1, 1, 1] },
                { id: "particle-color-end", t: 1, color: state.particleSystem.color || [1, 1, 1, 1] },
            ];

        return stops.map(normalizeColorRampStop).sort((a, b) => a.t - b.t);
    });

    const colorRampStyle = computed(() => ({
        background: `linear-gradient(90deg, ${colorRampStops.value
            .map(stop => `${colorToHex(stop.color)} ${Math.round(stop.t * 100)}%`)
            .join(", ")})`,
    }));

    const activeColorRampStop = computed(() => (
        colorRampStops.value.find(stop => stop.id === state.activeColorRampStopId) ||
        colorRampStops.value[0] ||
        null
    ));

    const activeColorRampColor = computed(() => colorToHex(activeColorRampStop.value?.color || [1, 1, 1, 1]));

    const colorRampMarkerStyle = stop => ({
        left: `${clamp01(stop?.t) * 100}%`,
        background: colorToHex(stop?.color || [1, 1, 1, 1]),
    });

    const setColorRampStops = stops => {
        state.particleSystem.color_ramp = stops
            .map(normalizeColorRampStop)
            .sort((a, b) => a.t - b.t);
        emitParticleSystem({ restart: true });
    };

    const addColorRampStopAt = event => {
        if (event.button !== 0) {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const t = clamp01((event.clientX - rect.left) / Math.max(rect.width, 1));
        const stop = {
            id: `particle-color-stop-${Date.now()}`,
            t: Math.round(t * 1000) / 1000,
            color: activeColorRampStop.value?.color || state.particleSystem.color || [1, 1, 1, 1],
        };

        state.activeColorRampStopId = stop.id;
        setColorRampStops([...colorRampStops.value, stop]);
    };

    const selectColorRampStop = stopId => {
        state.activeColorRampStopId = stopId;
    };

    const updateColorRampStop = patch => {
        const stopId = activeColorRampStop.value?.id;

        if (!stopId) {
            return;
        }

        setColorRampStops(colorRampStops.value.map(stop => (
            stop.id === stopId
                ? {
                    ...stop,
                    ...patch,
                    t: patch.t !== undefined ? clamp01(patch.t) : stop.t,
                    color: patch.color !== undefined ? parsePickerColor(patch.color) : stop.color,
                }
                : stop
        )));
    };

    const removeColorRampStop = stopId => {
        if (colorRampStops.value.length <= 2) {
            return;
        }

        const nextStops = colorRampStops.value.filter(stop => stop.id !== stopId);
        state.activeColorRampStopId = nextStops[0]?.id || "";
        setColorRampStops(nextStops);
    };

    const addParticleLayer = () => {
        const layers = ensureParticleLayers();
        const nextLayer = {
            id: `particle-layer-${Date.now()}`,
            name: `Layer ${layers.length + 1}`,
            texture_slot: "baseColor",
            layer_id: "",
            url: "",
        };

        state.particleSystem.layers = [...layers, nextLayer];
        state.particleSystem.active_layer_id = nextLayer.id;
        state.particleSystem.texture_slot = "baseColor";
        emitParticleSystem({ restart: true });
    };

    const startParticleLayerDrag = (event, layerId) => {
        state.layerDragId = layerId;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", layerId);
    };

    const dropParticleLayer = (event, targetLayerId) => {
        event.preventDefault();
        const sourceId = state.layerDragId || event.dataTransfer.getData("text/plain");
        state.layerDragId = "";

        if (!sourceId || sourceId === targetLayerId) {
            return;
        }

        const layers = ensureParticleLayers();
        const sourceIndex = layers.findIndex(layer => layer.id === sourceId);
        const targetIndex = layers.findIndex(layer => layer.id === targetLayerId);

        if (sourceIndex < 0 || targetIndex < 0) {
            return;
        }

        const nextLayers = layers.slice();
        const [sourceLayer] = nextLayers.splice(sourceIndex, 1);
        nextLayers.splice(targetIndex, 0, sourceLayer);
        state.particleSystem.layers = nextLayers;
        emitParticleSystem({ restart: true });
    };

    const updateActiveParticleTextureLayer = layerId => {
        const layers = ensureParticleLayers();
        const activeId = activeParticleLayer.value?.id;
        const textureLayer = (props.textureLayers || []).find(layer => layer.id === layerId);
        const slotKey = "baseColor";

        state.particleSystem.layers = layers.map(layer => (
            layer.id === activeId
                ? {
                    ...layer,
                    layer_id: layerId || "",
                    url: textureLayer?.texture?.url || textureLayer?.url || textureLayer?.masked || "",
                    name: textureLayer?.name || layer.name,
                    texture_slot: slotKey,
                }
                : layer
        ));

        emitParticleSystem({ restart: true });
    };

    const removeParticleLayer = layerId => {
        const layers = ensureParticleLayers();

        if (layers.length <= 1) {
            return;
        }

        const nextLayers = layers.filter(layer => layer.id !== layerId);
        const nextActive = nextLayers[0];

        state.particleSystem.layers = nextLayers;
        state.particleSystem.active_layer_id = nextActive?.id || "";
        state.particleSystem.texture_slot = "baseColor";
        emitParticleSystem({ restart: true });
    };

    const resetPathFollow = () => {
        const wasEnabled = state.particleSystem.path_follow?.enabled === true;
        state.particleSystem.path_follow = ParticleSystem.normalizePathFollow({
            enabled: wasEnabled,
            points: [],
        }, lifetimeWidth.value);
        emitParticleSystem({ restart: true });
    };

    const updatePathPoint = (pointId, group, axis, value) => {
        const path = ensurePathFollow();
        path.points = path.points.map(point => (
            point.id === pointId
                ? {
                    ...point,
                    [group]: {
                        ...(point[group] || {}),
                        [axis]: toNumber(value),
                    },
                }
                : point
        ));
        emitParticleSystem({ restart: true });
    };

    const pointerToPathPoint = (event, target, view = "side") => {
        const rect = target.getBoundingClientRect();
        const t = Math.min(Math.max((event.clientX - rect.left) / Math.max(rect.width, 1), 0), 1) * lifetimeWidth.value;
        const vertical = (rect.top + rect.height / 2 - event.clientY) / Math.max(rect.height / 2, 1);
        const horizontal = (event.clientX - rect.left - rect.width / 2) / Math.max(rect.width / 2, 1);

        if (view === "time") {
            return {
                t,
                translate: {
                    x: activePathPoint.value?.translate?.x || 0,
                    y: activePathPoint.value?.translate?.y || 0,
                    z: activePathPoint.value?.translate?.z || 0,
                },
            };
        }

        if (view === "top") {
            return {
                t,
                translate: {
                    x: horizontal * 2,
                    y: activePathPoint.value?.translate?.y || 0,
                    z: vertical * 2,
                },
            };
        }

        return {
            t,
            translate: {
                x: horizontal * 2,
                y: vertical * 2,
                z: activePathPoint.value?.translate?.z || 0,
            },
        };
    };

    const pointerToPathTime = (event, target) => {
        const rect = target.getBoundingClientRect();
        return Math.min(Math.max((event.clientX - rect.left) / Math.max(rect.width, 1), 0), 1) * lifetimeWidth.value;
    };

    const updatePathPointFromPointer = (pointId, event, target, view = "side") => {
        const path = ensurePathFollow();
        const pointData = pointerToPathPoint(event, target, view);

        path.points = path.points
            .map(point => {
                if (point.id !== pointId) {
                    return point;
                }

                if (view === "time") {
                    return {
                        ...point,
                        t: pointerToPathTime(event, target),
                    };
                }

                if (view === "top") {
                    return {
                        ...point,
                        translate: {
                            ...(point.translate || {}),
                            x: pointData.translate.x,
                            z: pointData.translate.z,
                        },
                    };
                }

                return {
                    ...point,
                    translate: {
                        ...(point.translate || {}),
                        x: pointData.translate.x,
                        y: pointData.translate.y,
                    },
                };
            })
            .sort((a, b) => a.t - b.t);
        path.active_point_id = pointId;
    };

    const stopPathPointDrag = () => {
        if (!state.pathPointDrag) {
            return;
        }

        state.pathPointDrag = null;
        window.removeEventListener("pointermove", movePathPoint);
        window.removeEventListener("pointerup", stopPathPointDrag);
        emitParticleSystem({ restart: true });
    };

    const movePathPoint = event => {
        if (!state.pathPointDrag) {
            return;
        }

        const { pointId, target, view } = state.pathPointDrag;
        updatePathPointFromPointer(pointId, event, target, view);
    };

    const startPathPointDrag = (event, pointId, view = "side") => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        state.pathPointDrag = {
            pointId,
            view,
            target: event.currentTarget.closest("svg"),
        };
        updatePathPointFromPointer(pointId, event, state.pathPointDrag.target, view);
        window.addEventListener("pointermove", movePathPoint);
        window.addEventListener("pointerup", stopPathPointDrag);
    };

    const addPathPoint = (event, view = "side") => {
        if (!event.altKey || event.button !== 0) {
            return;
        }

        const path = ensurePathFollow();
        const point = pointerToPathPoint(event, event.currentTarget, view);
        const lastTime = path.points.reduce((value, item) => Math.max(value, Number(item.t) || 0), 0);
        const nextTime = view === "time"
            ? point.t
            : clampValue(lastTime + lifetimeWidth.value / Math.max(path.points.length + 1, 1), 0, lifetimeWidth.value);
        const nextPoint = {
            id: `path-point-${Date.now()}`,
            t: nextTime,
            translate: point.translate,
        };

        path.points = [...path.points, nextPoint].sort((a, b) => a.t - b.t);
        path.active_point_id = nextPoint.id;
        emitParticleSystem({ restart: true });
    };

    const deletePathPoint = pointId => {
        const path = ensurePathFollow();

        if (path.points.length <= 1) {
            return;
        }

        path.points = path.points.filter(point => point.id !== pointId);
        path.active_point_id = path.points[0]?.id || "";
        emitParticleSystem({ restart: true });
    };

    const handlePathPointContext = (event, pointId, force = false) => {
        event.preventDefault();
        if (!force && !event.altKey) {
            return;
        }

        deletePathPoint(pointId);
    };

    return {
        state,
        particleModeOptions: PARTICLE_MODE_OPTIONS,
        particleSourceOptions: PARTICLE_SOURCE_OPTIONS,
        particleEmitterOptions: PARTICLE_EMITTER_OPTIONS,
        particleRootAnimationOptions: PARTICLE_ROOT_ANIMATION_OPTIONS,
        particleBlendOptions: PARTICLE_BLEND_OPTIONS,
        particleInterpolationAttributes: PARTICLE_INTERPOLATION_ATTRIBUTES,
        colorRampStops,
        colorRampStyle,
        activeColorRampStop,
        activeColorRampColor,
        colorRampMarkerStyle,
        activeInterpolationPoints,
        interpolationPolyline,
        lifetimeWidth,
        pathFollowPoints,
        activePathPoint,
        pathTimePolyline,
        pathSidePolyline,
        pathTopPolyline,
        particleLayers,
        activeParticleLayer,
        textureLayerOptions,
        setParticleValue,
        setParticleNumber,
        setParticleBoolean,
        setParticleColor,
        addColorRampStopAt,
        selectColorRampStop,
        updateColorRampStop,
        removeColorRampStop,
        setInterpolationAttribute,
        startInterpolationPoint,
        addInterpolationPoint,
        deleteInterpolationPoint,
        updateInterpolationPointValue,
        handleInterpolationContext,
        resetInterpolation,
        setPathFollowEnabled,
        setActivePathPoint,
        setActiveParticleLayer,
        addParticleLayer,
        removeParticleLayer,
        startParticleLayerDrag,
        dropParticleLayer,
        updateActiveParticleTextureLayer,
        interpolationPointY,
        resetPathFollow,
        updatePathPoint,
        addPathPoint,
        startPathPointDrag,
        handlePathPointContext,
    };
}
