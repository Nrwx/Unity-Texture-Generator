import { computed, reactive, watch } from "vue";
import { ParticleSystem } from "@/view/models/page/material/core/ParticleSystem/ParticleSystem";

export const PARTICLE_MODE_OPTIONS = Object.freeze(["texture", "mesh", "mixed"]);
export const PARTICLE_SOURCE_OPTIONS = Object.freeze(["texture", "mesh", "volume"]);
export const PARTICLE_EMITTER_OPTIONS = Object.freeze(["volume", "surface", "vertices", "sphere", "plane"]);
export const PARTICLE_BLEND_OPTIONS = Object.freeze(["alpha", "additive", "screen"]);
export const PARTICLE_TEXTURE_SLOT_OPTIONS = Object.freeze([
    "baseColor",
    "alpha",
    "emission",
    "roughness",
    "metallic",
    "normal",
]);
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
        .map(point => `${(point.x / lifetimeWidth.value) * 100},${50 - (Number(point.y) || 0)}`)
        .join(" "));

    const pathFollowPoints = computed(() => state.particleSystem.path_follow?.points || []);
    const activePathPoint = computed(() => (
        pathFollowPoints.value.find(point => point.id === state.particleSystem.path_follow?.active_point_id) ||
        pathFollowPoints.value[0] ||
        null
    ));
    const pathTimePolyline = computed(() => pathFollowPoints.value
        .map(point => `${(point.t / lifetimeWidth.value) * 100},5`)
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
        const y = clampValue((rect.top + rect.height / 2 - event.clientY) / Math.max(rect.height / 2, 1) * 50, -50, 50);

        return { x, y };
    };

    const updateInterpolationPoint = (attribute, index, point) => {
        const points = ensureInterpolationPoints(attribute).map((item, itemIndex) => (
            itemIndex === index ? point : item
        ));

        state.particleSystem.interpolations[attribute] = points
            .sort((a, b) => a.x - b.x)
            .map(item => ({
                x: Math.round(item.x * 1000) / 1000,
                y: Math.round(item.y * 1000) / 1000,
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
            y: clampValue(value, -1000, 1000),
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
        state.particleSystem.texture_slot = layer.texture_slot || "baseColor";
        emitParticleSystem({ restart: true });
    };

    const addParticleLayer = () => {
        const layers = ensureParticleLayers();
        const nextLayer = {
            id: `particle-layer-${Date.now()}`,
            name: `Layer ${layers.length + 1}`,
            texture_slot: state.particleSystem.texture_slot || "baseColor",
            layer_id: "",
            url: "",
        };

        state.particleSystem.layers = [...layers, nextLayer];
        state.particleSystem.active_layer_id = nextLayer.id;
        state.particleSystem.texture_slot = nextLayer.texture_slot;
        emitParticleSystem({ restart: true });
    };

    const updateActiveParticleLayerSlot = slotKey => {
        const layers = ensureParticleLayers();
        const activeId = activeParticleLayer.value?.id;

        state.particleSystem.layers = layers.map(layer => (
            layer.id === activeId
                ? { ...layer, texture_slot: slotKey }
                : layer
        ));
        state.particleSystem.texture_slot = slotKey;

        const layerId = activeParticleLayer.value?.layer_id;
        if (layerId) {
            emit("assign-texture-slot", { slotKey, layerId });
        }

        emitParticleSystem({ restart: true });
    };

    const updateActiveParticleTextureLayer = layerId => {
        const layers = ensureParticleLayers();
        const activeId = activeParticleLayer.value?.id;
        const textureLayer = (props.textureLayers || []).find(layer => layer.id === layerId);
        const slotKey = activeParticleLayer.value?.texture_slot || state.particleSystem.texture_slot || "baseColor";

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

        if (textureLayer) {
            emit("assign-texture-slot", { slotKey, layerId: textureLayer.id });
        }

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
        particleBlendOptions: PARTICLE_BLEND_OPTIONS,
        particleTextureSlotOptions: PARTICLE_TEXTURE_SLOT_OPTIONS,
        particleInterpolationAttributes: PARTICLE_INTERPOLATION_ATTRIBUTES,
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
        updateActiveParticleLayerSlot,
        updateActiveParticleTextureLayer,
        resetPathFollow,
        updatePathPoint,
        addPathPoint,
        startPathPointDrag,
        handlePathPointContext,
    };
}
