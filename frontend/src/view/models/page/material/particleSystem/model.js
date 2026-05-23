import {computed, ref} from "vue";
import { ParticleSystem } from "@/view/models/page/material/core/ParticleSystem/ParticleSystem";
import {clamp, clone} from "@/utils/tools";
import {
    INTERPOLATION_RANGES,
    PARTICLE_BLEND_OPTIONS, PARTICLE_INTERPOLATION_ATTRIBUTES,
    PARTICLE_LAYER_SETTING_KEYS,
    PARTICLE_MODE_OPTIONS,
    PARTICLE_ROOT_ANIMATION_OPTIONS, PARTICLE_SEQUENCE_MODE_OPTIONS,
    PARTICLE_VOLUME_FLOW_OPTIONS, PATH_GRID_MODES, PATH_VIEW_DEFINITIONS, PATH_VIEW_OPTIONS
} from "@/dataLayer/webgl";

const toNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const colorToHex = color => {
    const channels = Array.isArray(color) ? color : [1, 1, 1];

    return `#${channels.slice(0, 3).map(value => (
        Math.round(clamp(value) * 255).toString(16).padStart(2, "0")
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
            clamp(Number(value.r) / 255),
            clamp(Number(value.g) / 255),
            clamp(Number(value.b) / 255),
            1,
        ];
    }

    return hexToColor(typeof value === "string" ? value : value?.hex || value?.hexa || value);
};
const normalizeColorRampStop = (stop = {}, index = 0) => ({
    id: stop.id || `particle-color-stop-${index}`,
    t: clamp(stop.t ?? index),
    color: Array.isArray(stop.color) ? stop.color : [1, 1, 1, 1],
});

export const particleSystemModelProps = {
    particleSystem: {
        type: Object,
        required: true
    },
    textureLayers: {
        type: Array,
        required: true
    },
};

export const particleSystemModelEmits = [
    "update:particleSystem",
    "change",
    "assign-texture-slot",
];

export function particleSystemModel(props, emit) {
    const ui = ref({
        interpolationAttribute: props.particleSystem?.interpolation_attribute || "alpha",
        interpolationDrag: null,
        layerDragId: "",
        pathPointDrag: null,
        activeColorRampStopId: "",
        colorRampDrag: null,
        pathGridMode: "normal",
        pathViewSlots: ["left", "top"],
    });

    const snapshotLayerSettings = (source = props.particleSystem) => (
        PARTICLE_LAYER_SETTING_KEYS.reduce((settings, key) => {
            settings[key] = clone(source?.[key], 'json');
            return settings;
        }, {})
    );

    const syncActiveParticleLayerSettings = () => {
        const activeId = props.particleSystem.active_layer_id;

        if (!activeId || !Array.isArray(props.particleSystem.layers)) {
            return;
        }

        const settings = snapshotLayerSettings();
        props.particleSystem.layers = props.particleSystem.layers.map(layer => (
            layer.id === activeId
                ? { ...layer, settings }
                : layer
        ));
    };

    const applyParticleLayerSettings = layer => {
        if (!layer?.settings || typeof layer.settings !== "object") {
            return;
        }

        PARTICLE_LAYER_SETTING_KEYS.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(layer.settings, key)) {
                props.particleSystem[key] = clone(layer.settings[key], 'json');
            }
        });

        ui.value.interpolationAttribute = props.particleSystem.interpolation_attribute || ui.value.interpolationAttribute || "alpha";
    };

    const restartParticleSystem = () => {
        props.particleSystem.age = 0;
        props.particleSystem.meta = {
            ...(props.particleSystem.meta || {}),
            restart_at: Date.now(),
        };
    };

    const scaleLifetimeCurves = (oldLifetime, newLifetime) => {
        const from = Math.max(0.001, Number(oldLifetime) || 1);
        const to = Math.max(0.001, Number(newLifetime) || 1);
        const ratio = to / from;

        props.particleSystem.interpolations = Object.entries(props.particleSystem?.interpolations || {})
            .reduce((acc, [key, points]) => {
                acc[key] = Array.isArray(points)
                    ? points.map(point => ({
                        ...point,
                        x: Math.round(clamp((Number(point.x) || 0) * ratio, 0, to) * 1000) / 1000,
                    }))
                    : points;
                return acc;
            }, {});

        if (Array.isArray(props.particleSystem.path_follow?.points)) {
            props.particleSystem.path_follow.points = props.particleSystem.path_follow.points
                .map(point => ({
                    ...point,
                    t: Math.round(clamp((Number(point.t) || 0) * ratio, 0, to) * 1000) / 1000,
                }))
                .sort((a, b) => a.t - b.t);
        }
    };

    const emitParticleSystem = ({ restart = false, syncLayer = true } = {}) => {
        if (syncLayer) {
            syncActiveParticleLayerSettings();
        }

        if (restart) {
            restartParticleSystem();
        }

        const particleSystem = clone(props.particleSystem, 'json');

        emit("update:particleSystem", particleSystem);
        emit("change", particleSystem);
    };

    const setParticleValue = (key, value) => {
        props.particleSystem[key] = value;
        if (key === "texture_slot") {
            const activeId = props.particleSystem.active_layer_id;
            props.particleSystem.layers = (props.particleSystem.layers || []).map(layer => (
                layer.id === activeId ? { ...layer, texture_slot: value } : layer
            ));
        }
        emitParticleSystem({ restart: true });
    };

    const setParticleNumber = (key, value) => {
        const nextValue = toNumber(value);

        if (key === "lifetime") {
            scaleLifetimeCurves(props.particleSystem.lifetime, nextValue);
        }

        props.particleSystem[key] = nextValue;
        emitParticleSystem({ restart: key !== "age" });
    };

    const setParticleBoolean = (key, value) => {
        props.particleSystem[key] = value === true;
        if (key === "enabled" && value === true) {
            props.particleSystem = {
                ...props.particleSystem,
                ...ParticleSystem.normalize(props.particleSystem),
            };
        }
        emitParticleSystem({ restart: true });
    };

    const setParticleColor = (index, value) => {
        const color = Array.isArray(props.particleSystem.color)
            ? [...props.particleSystem.color]
            : [1, 1, 1, 1];

        color[index] = toNumber(value);
        props.particleSystem.color = color;
        emitParticleSystem({ restart: true });
    };

    const activeInterpolationPoints = computed(() => ensureInterpolationPoints(ui.value.interpolationAttribute));

    const lifetimeWidth = computed(() => Math.max(0.001, Number(props.particleSystem.lifetime) || 1));

    const interpolationPolyline = computed(() => activeInterpolationPoints.value
        .map(point => `${(point.x / lifetimeWidth.value) * 100},${interpolationPointY(point)}`)
        .join(" "));

    const pathFollowPoints = computed(() => props.particleSystem.path_follow?.points || []);
    const activePathPoint = computed(() => (
        pathFollowPoints.value.find(point => point.id === props.particleSystem.path_follow?.active_point_id) ||
        pathFollowPoints.value[0] ||
        null
    ));
    const pathTimePolyline = computed(() => pathFollowPoints.value
        .map(point => `${(point.t / lifetimeWidth.value) * 100},12`)
        .join(" "));
    const pathViewItems = computed(() => (
        ui.value.pathGridMode === "all"
            ? [
                PATH_VIEW_DEFINITIONS.top,
                PATH_VIEW_DEFINITIONS.bottom,
                PATH_VIEW_DEFINITIONS.left,
                PATH_VIEW_DEFINITIONS.right,
                PATH_VIEW_DEFINITIONS.front,
                PATH_VIEW_DEFINITIONS.back,
            ]
            : ui.value.pathViewSlots.map(key => PATH_VIEW_DEFINITIONS[key] || PATH_VIEW_DEFINITIONS.top)
    ));
    const particleLayers = computed(() => props.particleSystem.layers || []);
    const activeParticleLayer = computed(() => (
        particleLayers.value.find(layer => layer.id === props.particleSystem.active_layer_id) ||
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
    const activeLayerTextureSequence = computed(() => (
        Array.isArray(activeParticleLayer.value?.texture_sequence)
            ? activeParticleLayer.value.texture_sequence
            : []
    ));
    const activeLayerSequenceOnline = computed(() => (
        activeParticleLayer.value?.sequence_enabled === true &&
        activeLayerTextureSequence.value.filter(item => item?.url).length > 1
    ));

    const ensureParticleLayers = () => {
        props.particleSystem = {
            ...props.particleSystem,
            ...ParticleSystem.normalize(props.particleSystem),
        };

        return props.particleSystem.layers || [];
    };

    const setInterpolationAttribute = value => {
        ui.value.interpolationAttribute = value;
        props.particleSystem.interpolation_attribute = value;
        emitParticleSystem();
    };

    const ensureInterpolationPoints = attribute => {
        props.particleSystem.interpolations = ParticleSystem.normalizeInterpolations(
            props.particleSystem.interpolations || {},
            lifetimeWidth.value
        );

        if (!props.particleSystem.interpolations[attribute]) {
            props.particleSystem.interpolations[attribute] = ParticleSystem.normalizeInterpolations(
                { [attribute]: [] },
                lifetimeWidth.value
            )[attribute];
        }

        const range = INTERPOLATION_RANGES[attribute];

        if (range) {
            props.particleSystem.interpolations[attribute] = props.particleSystem.interpolations[attribute]
                .map(point => ({
                    ...point,
                    y: clampInterpolationValue(attribute, point.y),
                }));
        }

        return props.particleSystem.interpolations[attribute];
    };

    const pointerToInterpolationPoint = (event, target = event.currentTarget) => {
        const rect = target.getBoundingClientRect();
        const x = Math.min(Math.max((event.clientX - rect.left) / Math.max(rect.width, 1), 0), 1) * lifetimeWidth.value;
        const rawRatio = Math.min(Math.max((event.clientY - rect.top) / Math.max(rect.height, 1), 0), 1);
        const range = INTERPOLATION_RANGES[ui.value.interpolationAttribute];

        if (range) {
            const visualMin = range.visualMin ?? range.min ?? 0;
            const visualMax = range.visualMax ?? range.max ?? 1;
            const y = visualMin + (1 - rawRatio) * (visualMax - visualMin);

            return { x, y: Math.round(y * 1000) / 1000 };
        }

        const y = clamp((0.5 - rawRatio) * 100, -50, 50);

        return { x, y };
    };

    const interpolationPointY = point => {
        const range = INTERPOLATION_RANGES[ui.value.interpolationAttribute];

        if (range) {
            const visualMin = range.visualMin ?? range.min ?? 0;
            const visualMax = range.visualMax ?? range.max ?? 1;
            const amount = (clamp(point?.y, visualMin, visualMax) - visualMin) / Math.max(visualMax - visualMin, 0.00001);
            return 100 - amount * 100;
        }

        return 50 - (Number(point?.y) || 0);
    };

    const clampInterpolationValue = (attribute, value) => {
        const range = INTERPOLATION_RANGES[attribute];

        if (!range) {
            return value;
        }

        const number = toNumber(value);

        if (range.min !== null && range.min !== undefined && (range.max === null || range.max === undefined)) {
            return Math.max(range.min, number);
        }

        if (range.min === null || range.min === undefined) {
            return range.max === null || range.max === undefined
                ? number
                : Math.min(range.max, number);
        }

        return clamp(number, range.min, range.max);
    };

    const updateInterpolationPoint = (attribute, index, point) => {
        const points = ensureInterpolationPoints(attribute).map((item, itemIndex) => (
            itemIndex === index ? point : item
        ));

        props.particleSystem.interpolations[attribute] = points
            .sort((a, b) => a.x - b.x)
            .map(item => ({
                x: Math.round(item.x * 1000) / 1000,
                y: Math.round(clampInterpolationValue(attribute, item.y) * 1000) / 1000,
            }));
    };

    const updateInterpolationPointValue = (index, value) => {
        const attribute = ui.value.interpolationAttribute;
        const points = ensureInterpolationPoints(attribute);
        const current = points[index];

        if (!current) {
            return;
        }

        updateInterpolationPoint(attribute, index, {
            ...current,
            y: clampInterpolationValue(
                attribute,
                INTERPOLATION_RANGES[attribute] ? value : clamp(value, -1000, 1000)
            ),
        });
        emitParticleSystem({ restart: true });
    };

    const interpolationInputRange = computed(() => (
        INTERPOLATION_RANGES[ui.value.interpolationAttribute]
            ? {
                ...INTERPOLATION_RANGES[ui.value.interpolationAttribute],
                max: INTERPOLATION_RANGES[ui.value.interpolationAttribute].max ?? undefined,
            }
            : {
            min: undefined,
            max: undefined,
            step: 1,
            label: "Y Offset",
        }
    ));

    const stopInterpolationDrag = () => {
        if (!ui.value.interpolationDrag) {
            return;
        }

        ui.value.interpolationDrag = null;
        window.removeEventListener("pointermove", moveInterpolationPoint);
        window.removeEventListener("pointerup", stopInterpolationDrag);
        emitParticleSystem({ restart: true });
    };

    const moveInterpolationPoint = event => {
        if (!ui.value.interpolationDrag) {
            return;
        }

        const { attribute, index, target } = ui.value.interpolationDrag;
        updateInterpolationPoint(attribute, index, pointerToInterpolationPoint(event, target));
    };

    const startInterpolationPoint = (event, index) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        ui.value.interpolationDrag = {
            attribute: ui.value.interpolationAttribute,
            index,
            target: event.currentTarget.closest(".mem-particle-curve-box"),
        };

        updateInterpolationPoint(
            ui.value.interpolationAttribute,
            index,
            pointerToInterpolationPoint(event, ui.value.interpolationDrag?.target)
        );

        window.addEventListener("pointermove", moveInterpolationPoint);
        window.addEventListener("pointerup", stopInterpolationDrag);
    };

    const addInterpolationPoint = event => {
        if (!event.altKey || event.button !== 0) {
            return;
        }

        const attribute = ui.value.interpolationAttribute;
        const point = pointerToInterpolationPoint(event);
        const points = ensureInterpolationPoints(attribute);

        points.push(point);
        props.particleSystem.interpolations[attribute] = points.sort((a, b) => a.x - b.x);
        emitParticleSystem({ restart: true });
    };

    const deleteInterpolationPoint = index => {
        const attribute = ui.value.interpolationAttribute;
        const points = ensureInterpolationPoints(attribute);

        if (points.length <= 1) {
            return;
        }

        props.particleSystem.interpolations[attribute] = points.filter((_point, pointIndex) => pointIndex !== index);
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

        const points = ensureInterpolationPoints(ui.value.interpolationAttribute);
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
        const attribute = ui.value.interpolationAttribute;
        const fallback = PARTICLE_INTERPOLATION_ATTRIBUTES.find(item => item.key === attribute)?.defaultValue ?? 0;
        props.particleSystem.interpolations = {
            ...(props.particleSystem.interpolations || {}),
            [attribute]: [
                { x: 0, y: fallback },
                { x: lifetimeWidth.value / 2, y: fallback },
                { x: lifetimeWidth.value, y: fallback },
            ],
        };
        emitParticleSystem({ restart: true });
    };

    const ensurePathFollow = () => {
        props.particleSystem.path_follow = ParticleSystem.normalizePathFollow(
            props.particleSystem.path_follow || {},
            lifetimeWidth.value
        );

        return props.particleSystem.path_follow;
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
        syncActiveParticleLayerSettings();
        const layers = ensureParticleLayers();
        const layer = layers.find(item => item.id === layerId) || layers[0];

        if (!layer) {
            return;
        }

        props.particleSystem.active_layer_id = layer.id;
        props.particleSystem.texture_slot = "baseColor";
        applyParticleLayerSettings(layer);
        emitParticleSystem({ restart: true });
    };

    const colorRampStops = computed(() => {
        const stops = Array.isArray(props.particleSystem.color_ramp) && props.particleSystem.color_ramp.length
            ? props.particleSystem.color_ramp
            : [
                { id: "particle-color-start", t: 0, color: props.particleSystem.color || [1, 1, 1, 1] },
                { id: "particle-color-end", t: 1, color: props.particleSystem.color || [1, 1, 1, 1] },
            ];

        return stops.map(normalizeColorRampStop).sort((a, b) => a.t - b.t);
    });

    const colorRampStyle = computed(() => ({
        background: `linear-gradient(90deg, ${colorRampStops.value
            .map(stop => `${colorToHex(stop.color)} ${Math.round(stop.t * 100)}%`)
            .join(", ")})`,
    }));

    const activeColorRampStop = computed(() => (
        colorRampStops.value.find(stop => stop.id === ui.value.activeColorRampStopId) ||
        colorRampStops.value[0] ||
        null
    ));

    const activeColorRampColor = computed(() => colorToHex(activeColorRampStop.value?.color || [1, 1, 1, 1]));

    const colorRampMarkerStyle = stop => ({
        left: `${clamp(stop?.t) * 100}%`,
        background: colorToHex(stop?.color || [1, 1, 1, 1]),
    });

    const setColorRampStops = stops => {
        props.particleSystem.color_ramp = stops
            .map(normalizeColorRampStop)
            .sort((a, b) => a.t - b.t);
        emitParticleSystem({ restart: true });
    };

    const pointerToColorRampT = (event, target) => {
        const rect = target.getBoundingClientRect();
        return Math.round(clamp((event.clientX - rect.left) / Math.max(rect.width, 1)) * 1000) / 1000;
    };

    const addColorRampStopAt = event => {
        if (event.button !== 0) {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const t = clamp((event.clientX - rect.left) / Math.max(rect.width, 1));
        const stop = {
            id: `particle-color-stop-${Date.now()}`,
            t: Math.round(t * 1000) / 1000,
            color: activeColorRampStop.value?.color || props.particleSystem.color || [1, 1, 1, 1],
        };

        ui.value.activeColorRampStopId = stop.id;
        setColorRampStops([...colorRampStops.value, stop]);
    };

    const selectColorRampStop = stopId => {
        ui.value.activeColorRampStopId = stopId;
    };

    const moveColorRampStop = event => {
        if (!ui.value.colorRampDrag) {
            return;
        }

        const { stopId, target } = ui.value.colorRampDrag;
        const t = pointerToColorRampT(event, target);
        props.particleSystem.color_ramp = colorRampStops.value
            .map(stop => stop.id === stopId ? { ...stop, t } : stop)
            .sort((a, b) => a.t - b.t);
    };

    const stopColorRampDrag = () => {
        if (!ui.value.colorRampDrag) {
            return;
        }

        ui.value.colorRampDrag = null;
        window.removeEventListener("pointermove", moveColorRampStop);
        window.removeEventListener("pointerup", stopColorRampDrag);
        emitParticleSystem({ restart: true });
    };

    const startColorRampStopDrag = (event, stopId) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        ui.value.activeColorRampStopId = stopId;
        ui.value.colorRampDrag = {
            stopId,
            target: event.currentTarget.closest(".mem-particle-gradient-bar"),
        };
        moveColorRampStop(event);
        window.addEventListener("pointermove", moveColorRampStop);
        window.addEventListener("pointerup", stopColorRampDrag);
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
                    t: patch.t !== undefined ? clamp(patch.t) : stop.t,
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
        ui.value.activeColorRampStopId = nextStops[0]?.id || "";
        setColorRampStops(nextStops);
    };

    const addParticleLayer = () => {
        syncActiveParticleLayerSettings();
        const layers = ensureParticleLayers();
        const nextLayer = {
            id: `particle-layer-${Date.now()}`,
            name: `Layer ${layers.length + 1}`,
            texture_slot: "baseColor",
            layer_id: "",
            url: "",
            sequence_enabled: false,
            sequence_mode: "clockwise",
            sequence_interval_ms: 100,
            texture_sequence: [],
            settings: snapshotLayerSettings(),
        };

        props.particleSystem.layers = [...layers, nextLayer];
        props.particleSystem.active_layer_id = nextLayer.id;
        props.particleSystem.texture_slot = "baseColor";
        emitParticleSystem({ restart: true });
    };

    const startParticleLayerDrag = (event, layerId) => {
        ui.value.layerDragId = layerId;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", layerId);
    };

    const dropParticleLayer = (event, targetLayerId) => {
        event.preventDefault();
        const sourceId = ui.value.layerDragId || event.dataTransfer.getData("text/plain");
        ui.value.layerDragId = "";

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
        props.particleSystem.layers = nextLayers;
        emitParticleSystem({ restart: true });
    };

    const updateActiveParticleTextureLayer = layerId => {
        const layers = ensureParticleLayers();
        const activeId = activeParticleLayer.value?.id;
        const textureLayer = (props.textureLayers || []).find(layer => layer.id === layerId);
        const slotKey = "baseColor";

        props.particleSystem.layers = layers.map(layer => (
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

    const updateActiveParticleLayerPatch = patch => {
        const layers = ensureParticleLayers();
        const activeId = activeParticleLayer.value?.id;

        props.particleSystem.layers = layers.map(layer => (
            layer.id === activeId
                ? { ...layer, ...patch }
                : layer
        ));
        emitParticleSystem({ restart: true });
    };

    const normalizeTextureSequenceItem = (layerId, index = 0) => {
        const textureLayer = (props.textureLayers || []).find(layer => layer.id === layerId);

        return {
            id: `particle-sequence-${Date.now()}-${index}`,
            layer_id: layerId || "",
            name: textureLayer?.name || `Texture ${index + 1}`,
            url: textureLayer?.texture?.url || textureLayer?.url || textureLayer?.masked || "",
        };
    };

    const addActiveParticleSequenceTexture = layerId => {
        if (!layerId) {
            return;
        }

        const sequence = activeLayerTextureSequence.value;
        updateActiveParticleLayerPatch({
            texture_sequence: [
                ...sequence,
                normalizeTextureSequenceItem(layerId, sequence.length),
            ],
            sequence_enabled: true,
        });
    };

    const updateActiveParticleSequenceTexture = (index, layerId) => {
        const sequence = activeLayerTextureSequence.value;

        updateActiveParticleLayerPatch({
            texture_sequence: sequence.map((item, itemIndex) => (
                itemIndex === index
                    ? {
                        ...item,
                        ...normalizeTextureSequenceItem(layerId, itemIndex),
                        id: item.id,
                    }
                    : item
            )),
        });
    };

    const removeActiveParticleSequenceTexture = index => {
        updateActiveParticleLayerPatch({
            texture_sequence: activeLayerTextureSequence.value.filter((_item, itemIndex) => itemIndex !== index),
        });
    };

    const removeParticleLayer = layerId => {
        const layers = ensureParticleLayers();

        if (layers.length <= 1) {
            return;
        }

        const nextLayers = layers.filter(layer => layer.id !== layerId);
        const nextActive = nextLayers[0];

        props.particleSystem.layers = nextLayers;
        props.particleSystem.active_layer_id = nextActive?.id || "";
        props.particleSystem.texture_slot = "baseColor";
        emitParticleSystem({ restart: true });
    };

    const resetPathFollow = () => {
        const wasEnabled = props.particleSystem.path_follow?.enabled === true;
        props.particleSystem.path_follow = ParticleSystem.normalizePathFollow({
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

    const getPathViewDefinition = view => PATH_VIEW_DEFINITIONS[view] || PATH_VIEW_DEFINITIONS.top;

    const pathViewPoint = (point, view) => {
        const definition = getPathViewDefinition(view);
        const translate = point?.translate || {};
        const x = 50 + (Number(translate[definition.horizontal]) || 0) * definition.hSign * 24;
        const y = 50 + (Number(translate[definition.vertical]) || 0) * definition.vSign * 24;

        return { x, y };
    };

    const pathViewPolyline = view => pathFollowPoints.value
        .map(point => {
            const projected = pathViewPoint(point, view);
            return `${projected.x},${projected.y}`;
        })
        .join(" ");

    const interpolatePathTranslateAt = (points, time) => {
        const sorted = (Array.isArray(points) ? points : [])
            .map(point => ({
                ...point,
                t: clamp(point?.t, 0, lifetimeWidth.value),
                translate: {
                    x: toNumber(point?.translate?.x),
                    y: toNumber(point?.translate?.y),
                    z: toNumber(point?.translate?.z),
                },
            }))
            .sort((a, b) => a.t - b.t);

        if (!sorted.length) {
            return { x: 0, y: 0, z: 0 };
        }

        if (time <= sorted[0].t || sorted.length === 1) {
            return { ...sorted[0].translate };
        }

        for (let index = 1; index < sorted.length; index += 1) {
            const previous = sorted[index - 1];
            const next = sorted[index];

            if (time > next.t) {
                continue;
            }

            const amount = (time - previous.t) / Math.max(next.t - previous.t, 0.00001);

            return {
                x: previous.translate.x + (next.translate.x - previous.translate.x) * amount,
                y: previous.translate.y + (next.translate.y - previous.translate.y) * amount,
                z: previous.translate.z + (next.translate.z - previous.translate.z) * amount,
            };
        }

        return { ...sorted[sorted.length - 1].translate };
    };

    const createSpatialPathInsertionPlan = points => {
        const sorted = (Array.isArray(points) ? points : [])
            .map(point => ({
                id: point.id,
                t: clamp(point?.t, 0, lifetimeWidth.value),
            }))
            .sort((a, b) => a.t - b.t);

        if (!sorted.length) {
            return { newTime: 0 };
        }

        const activeId = props.particleSystem.path_follow?.active_point_id;
        const foundIndex = sorted.findIndex(point => point.id === activeId);
        const activeIndex = foundIndex >= 0 ? foundIndex : sorted.length - 1;
        const active = sorted[activeIndex];
        const next = sorted[activeIndex + 1];
        const previous = sorted[activeIndex - 1];
        const shiftTarget = next
            ? active.t + (next.t - active.t) / 2
            : previous
                ? previous.t + (active.t - previous.t) / 2
                : lifetimeWidth.value / 2;

        return {
            newTime: active.t,
            shiftedPointId: active.id,
            shiftedTime: clamp(shiftTarget, 0, lifetimeWidth.value),
        };
    };

    const setPathGridMode = value => {
        ui.value.pathGridMode = ["normal", "all"].includes(value) ? value : "normal";
    };

    const setPathViewSlot = (index, value) => {
        const nextView = PATH_VIEW_DEFINITIONS[value] ? value : "top";
        const nextSlots = Array.isArray(ui.value.pathViewSlots) && ui.value.pathViewSlots.length === 2
            ? [...ui.value.pathViewSlots]
            : ["left", "top"];

        nextSlots[index === 1 ? 1 : 0] = nextView;
        ui.value.pathViewSlots = nextSlots;
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

        const definition = getPathViewDefinition(view);
        const translate = {
            x: activePathPoint.value?.translate?.x || 0,
            y: activePathPoint.value?.translate?.y || 0,
            z: activePathPoint.value?.translate?.z || 0,
        };

        translate[definition.horizontal] = horizontal * 2 / definition.hSign;
        translate[definition.vertical] = vertical * 2 / -definition.vSign;

        return { t, translate };
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

                const definition = getPathViewDefinition(view);

                return {
                    ...point,
                    translate: {
                        ...(point.translate || {}),
                        [definition.horizontal]: pointData.translate[definition.horizontal],
                        [definition.vertical]: pointData.translate[definition.vertical],
                    },
                };
            })
            .sort((a, b) => a.t - b.t);
        path.active_point_id = pointId;
    };

    const stopPathPointDrag = () => {
        if (!ui.value.pathPointDrag) {
            return;
        }

        ui.value.pathPointDrag = null;
        window.removeEventListener("pointermove", movePathPoint);
        window.removeEventListener("pointerup", stopPathPointDrag);
        emitParticleSystem({ restart: true });
    };

    const movePathPoint = event => {
        if (!ui.value.pathPointDrag) {
            return;
        }

        const { pointId, target, view } = ui.value.pathPointDrag;
        updatePathPointFromPointer(pointId, event, target, view);
    };

    const startPathPointDrag = (event, pointId, view = "side") => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        ui.value.pathPointDrag = {
            pointId,
            view,
            target: event.currentTarget.closest("svg"),
        };
        updatePathPointFromPointer(pointId, event, ui.value.pathPointDrag?.target, view);
        window.addEventListener("pointermove", movePathPoint);
        window.addEventListener("pointerup", stopPathPointDrag);
    };

    const addPathPoint = (event, view = "side") => {
        if (!event.altKey || event.button !== 0) {
            return;
        }

        event.preventDefault();

        const point = pointerToPathPoint(event, event.currentTarget, view);
        const path = ensurePathFollow();
        const insertionPlan = view === "time"
            ? { newTime: point.t }
            : createSpatialPathInsertionPlan(path.points);
        const nextTime = insertionPlan.newTime;
        const nextPoint = {
            id: `path-point-${Date.now()}`,
            t: nextTime,
            translate: view === "time"
                ? interpolatePathTranslateAt(path.points, nextTime)
                : point.translate,
        };
        const shiftedPoints = insertionPlan.shiftedPointId
            ? path.points.map(pathPoint => (
                pathPoint.id === insertionPlan.shiftedPointId
                    ? { ...pathPoint, t: insertionPlan.shiftedTime }
                    : pathPoint
            ))
            : path.points;

        path.points = [...shiftedPoints, nextPoint].sort((a, b) => a.t - b.t);
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

    const deleteNearestPathPoint = (event, view = "time") => {
        event.preventDefault();
        if (!event.altKey) {
            return;
        }

        const path = ensurePathFollow();

        if (path.points.length <= 1) {
            return;
        }

        let nearest;

        if (view === "time") {
            const time = pointerToPathTime(event, event.currentTarget);
            nearest = path.points.reduce((best, point) => {
                const distance = Math.abs((Number(point.t) || 0) - time);
                return !best || distance < best.distance ? { point, distance } : best;
            }, null)?.point;
        } else {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
            const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100;

            nearest = path.points.reduce((best, point) => {
                const projected = pathViewPoint(point, view);
                const distance = Math.hypot(projected.x - x, projected.y - y);
                return !best || distance < best.distance ? { point, distance } : best;
            }, null)?.point;
        }

        if (nearest) {
            deletePathPoint(nearest.id);
        }
    };

    const handlePathPointContext = (event, pointId) => {
        event.preventDefault();
        if (!event.altKey) {
            return;
        }

        deletePathPoint(pointId);
    };

    return {
        ui,
        PARTICLE_MODE_OPTIONS,
        PARTICLE_ROOT_ANIMATION_OPTIONS,
        PARTICLE_VOLUME_FLOW_OPTIONS,
        PARTICLE_BLEND_OPTIONS,
        PARTICLE_INTERPOLATION_ATTRIBUTES,
        PARTICLE_SEQUENCE_MODE_OPTIONS,
        PATH_GRID_MODES,
        PATH_VIEW_OPTIONS,
        colorRampStops,
        colorRampStyle,
        activeColorRampStop,
        activeColorRampColor,
        colorRampMarkerStyle,
        activeInterpolationPoints,
        interpolationPolyline,
        interpolationInputRange,
        lifetimeWidth,
        pathFollowPoints,
        activePathPoint,
        pathTimePolyline,
        pathViewItems,
        pathViewPoint,
        pathViewPolyline,
        particleLayers,
        activeParticleLayer,
        activeLayerTextureSequence,
        activeLayerSequenceOnline,
        textureLayerOptions,
        setParticleValue,
        setParticleNumber,
        setParticleBoolean,
        setParticleColor,
        addColorRampStopAt,
        selectColorRampStop,
        startColorRampStopDrag,
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
        setPathGridMode,
        setPathViewSlot,
        setActivePathPoint,
        setActiveParticleLayer,
        addParticleLayer,
        removeParticleLayer,
        startParticleLayerDrag,
        dropParticleLayer,
        updateActiveParticleTextureLayer,
        updateActiveParticleLayerPatch,
        addActiveParticleSequenceTexture,
        updateActiveParticleSequenceTexture,
        removeActiveParticleSequenceTexture,
        interpolationPointY,
        resetPathFollow,
        updatePathPoint,
        addPathPoint,
        deleteNearestPathPoint,
        startPathPointDrag,
        handlePathPointContext,
    };
}
