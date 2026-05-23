import {
    computed,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
} from "vue";

import { settings } from "@/dataLayer/parameter";
import {clamp} from "@/utils/tools";
import {createPoint, drawToCanvas} from "@/utils/canvas";

const PREVIEW_DEBOUNCE_MS = 220;

const EFFECT_ITEMS = [
    {
        key: "noise",
        title: "Rauschen",
        icon: "mdi-grain",
        description: "Fügt zufälliges Rauschen mit steuerbarer Intensität hinzu.",
    },
    {
        key: "pixelate",
        title: "Pixelate",
        icon: "mdi-grid",
        description: "Erzeugt einen Pixelblock-Effekt mit einstellbarer Blockgröße.",
    },
    {
        key: "glass",
        title: "Glas",
        icon: "mdi-glass-fragile",
        description: "Frosted, Blurred, Cracked oder Reflected Glass.",
    },
    {
        key: "deepness_highness",
        title: "Tiefe / Höhe",
        icon: "mdi-terrain",
        description: "Verstärkt Tiefen und Höhen über Schatten- und Highlight-Faktoren.",
    },
];

const FALLBACK_FALLOFF_PRESETS = [
    {
        title: "Custom",
        value: "custom",
        icon: "mdi-vector-polyline-edit",
        description: "Draw a custom falloff curve with connected points.",
    },
    {
        title: "Smooth",
        value: "smooth",
        icon: "mdi-chart-bell-curve",
        description: "Gentle, gradual fade.",
    },
    {
        title: "Sphere",
        value: "sphere",
        icon: "mdi-sphere",
        description: "Flat top with fast edge drop.",
    },
    {
        title: "Root",
        value: "root",
        icon: "mdi-square-root",
        description: "Inverse-square-like blend.",
    },
    {
        title: "Sharp",
        value: "sharp",
        icon: "mdi-triangle",
        description: "Pointed peak with smooth falloff.",
    },
    {
        title: "Linear",
        value: "linear",
        icon: "mdi-vector-line",
        description: "Straight center-to-edge fade.",
    },
    {
        title: "Constant",
        value: "constant",
        icon: "mdi-minus",
        description: "Uniform influence.",
    },
    {
        title: "Random",
        value: "random",
        icon: "mdi-dice-5",
        description: "Randomized influence.",
    },
];

export function modifierEffectsModel(props, emit) {
    const previewCanvas = ref(null);
    const falloffSurface = ref(null);
    const previewTimer = ref(null);
    const previewRequestId = ref(0);
    const draggingFalloffCenter = ref(false);
    const activeCustomPointId = ref("");

    const config = computed(() => ({
        title: "Effekte",
        subtitle: props.layer?.id || "",
        width: "100%",
        maxWidth: 980,
        height: "auto",
        maxHeight: 700,
        fullscreen: false,
        variant: "rounded",
        emit: "modifier-effects:state",
        hideClose: true,
    }));

    const modifier = reactive({
        values: {
            effects_effect: "noise",

            noise_level: 10,

            pixel_size: 10,

            glass_effect_type: 1,
            glass_frost_strength: 5,
            glass_frost_mode: 1,
            glass_blur_radius: 5,
            glass_crack_intensity: 10,
            glass_reflection_strength: 0.5,

            deepness_factor: 1.0,
            highness_factor: 1.0,

            falloff_custom_enabled: false,
            falloff_custom_points: [],
            falloff_preset: "smooth",
            falloff_radius: 100,
            falloff_strength: 1.0,
            falloff_center_x: 0.5,
            falloff_center_y: 0.5,
            falloff_inverted: false,
            falloff_random_seed: 1,
        },
    });

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const imageWidth = computed(() => Number(props.layer?.width || 0));
    const imageHeight = computed(() => Number(props.layer?.height || 0));

    const imageSizeLabel = computed(() => {
        if (!imageWidth.value || !imageHeight.value) {
            return "Keine Ebene";
        }

        return `${imageWidth.value} × ${imageHeight.value}`;
    });

    const effectItems = EFFECT_ITEMS;

    const falloffPresets = computed(() => {
        return settings.falloffPresets || FALLBACK_FALLOFF_PRESETS;
    });

    const glassEffectTypes = computed(() => {
        return settings.glassEffectTypes || [
            { title: "Frosted Glass", value: 1 },
            { title: "Blurred Glass", value: 2 },
            { title: "Cracked Glass", value: 3 },
            { title: "Reflected Glass", value: 4 },
        ];
    });

    const glassFrostModes = computed(() => {
        return settings.glassFrostModes || [
            { title: "Basic Frost", value: 1 },
            { title: "Directional Frost", value: 2 },
            { title: "Radial Frost", value: 3 },
        ];
    });

    const activeEffect = computed(() => {
        return (
            effectItems.find(
                item => item.key === modifier.values.effects_effect
            ) || effectItems[0]
        );
    });

    const activeEffectLabel = computed(() => activeEffect.value.title);
    const activeEffectDescription = computed(() => activeEffect.value.description);

    const operationSummary = computed(() => {
        return `${activeEffectLabel.value} · ${falloffLabel.value}`;
    });

    const hasCustomFalloff = computed(() => {
        return (
            modifier.values.falloff_custom_enabled &&
            modifier.values.falloff_custom_points.length > 0
        );
    });

    const customFalloffPolyline = computed(() => {
        return modifier.values.falloff_custom_points
            .map(point => `${point.x * 100},${point.y * 100}`)
            .join(" ");
    });

    const falloffLabel = computed(() => {
        const preset = falloffPresets.value.find(
            item => item.value === modifier.values.falloff_preset
        );

        const presetTitle = preset?.title || "Smooth";
        const custom = hasCustomFalloff.value ? " · Custom Line" : "";
        const inverted = modifier.values.falloff_inverted ? " · Inverted" : "";

        return `${presetTitle}${custom}${inverted}`;
    });

    const createFalloffPresetPoints = (preset) => {
        switch (preset) {
            case "sphere":
                return [
                    createPoint(0.18, 0.5),
                    createPoint(0.32, 0.38),
                    createPoint(0.5, 0.34),
                    createPoint(0.68, 0.38),
                    createPoint(0.82, 0.5),
                ];

            case "root":
                return [
                    createPoint(0.12, 0.82),
                    createPoint(0.26, 0.58),
                    createPoint(0.44, 0.43),
                    createPoint(0.66, 0.34),
                    createPoint(0.88, 0.28),
                ];

            case "sharp":
                return [
                    createPoint(0.18, 0.82),
                    createPoint(0.42, 0.58),
                    createPoint(0.5, 0.18),
                    createPoint(0.58, 0.58),
                    createPoint(0.82, 0.82),
                ];

            case "linear":
                return [
                    createPoint(0.18, 0.82),
                    createPoint(0.5, 0.5),
                    createPoint(0.82, 0.18),
                ];

            case "constant":
                return [
                    createPoint(0.18, 0.5),
                    createPoint(0.38, 0.5),
                    createPoint(0.62, 0.5),
                    createPoint(0.82, 0.5),
                ];

            case "random":
                return [
                    createPoint(0.18, 0.72),
                    createPoint(0.32, 0.28),
                    createPoint(0.48, 0.62),
                    createPoint(0.64, 0.36),
                    createPoint(0.82, 0.68),
                ];

            case "smooth":
            default:
                return [
                    createPoint(0.16, 0.76),
                    createPoint(0.32, 0.56),
                    createPoint(0.5, 0.42),
                    createPoint(0.68, 0.56),
                    createPoint(0.84, 0.76),
                ];
        }
    };

    const applyPresetPointsToCustomFalloff = preset => {
        modifier.values.falloff_custom_enabled = true;

        modifier.values.falloff_custom_points.splice(
            0,
            modifier.values.falloff_custom_points.length,
            ...createFalloffPresetPoints(preset)
        );

        activeCustomPointId.value = "";
    };

    const normalizeValues = () => ({
        effects_effect: String(modifier.values.effects_effect || "noise"),

        noise_level: clamp(Math.round(modifier.values.noise_level), 0, 100),

        pixel_size: clamp(Math.round(modifier.values.pixel_size), 1, 100),

        glass_effect_type: clamp(Math.round(modifier.values.glass_effect_type), 1, 4),
        glass_frost_strength: clamp(Math.round(modifier.values.glass_frost_strength), 0, 50),
        glass_frost_mode: clamp(Math.round(modifier.values.glass_frost_mode), 1, 3),
        glass_blur_radius: clamp(Math.round(modifier.values.glass_blur_radius), 0, 50),
        glass_crack_intensity: clamp(Math.round(modifier.values.glass_crack_intensity), 0, 100),
        glass_reflection_strength: clamp(Number(modifier.values.glass_reflection_strength), 0, 1),

        deepness_factor: clamp(Number(modifier.values.deepness_factor), 0, 3),
        highness_factor: clamp(Number(modifier.values.highness_factor), 0, 3),

        falloff_custom_enabled:
            modifier.values.falloff_custom_enabled === true,

        falloff_custom_points:
            modifier.values.falloff_custom_points.map(point => ({
                x: clamp(Number(point.x), 0, 1),
                y: clamp(Number(point.y), 0, 1),
            })),
        falloff_preset: String(modifier.values.falloff_preset || "smooth"),
        falloff_radius: clamp(Math.round(modifier.values.falloff_radius), 1, 200),
        falloff_strength: clamp(Number(modifier.values.falloff_strength), 0, 3),
        falloff_center_x: clamp(Number(modifier.values.falloff_center_x), 0, 1),
        falloff_center_y: clamp(Number(modifier.values.falloff_center_y), 0, 1),
        falloff_inverted: modifier.values.falloff_inverted === true,
        falloff_random_seed: clamp(Math.round(modifier.values.falloff_random_seed), 1, 999999),
    });

    const buildPayload = () => ({
        layer: props.layer,
        values: normalizeValues(),
    });

    const requestPreviewNow = async () => {
        if (!props.layer?.id) {
            return;
        }

        const currentRequestId = previewRequestId.value + 1;
        previewRequestId.value = currentRequestId;

        emitEvent("modifier:effects-preview", {
            ...buildPayload(),
            requestId: currentRequestId,
        });
    };

    const requestPreviewDebounced = () => {
        if (previewTimer.value) {
            clearTimeout(previewTimer.value);
        }

        previewTimer.value = setTimeout(() => {
            requestPreviewNow();
        }, PREVIEW_DEBOUNCE_MS);
    };

    const selectEffect = key => {
        modifier.values.effects_effect = key;
    };

    const surfaceEventToPoint = event => {
        if (!falloffSurface.value) {
            return null;
        }

        const rect = falloffSurface.value.getBoundingClientRect();

        if (!rect.width || !rect.height) {
            return null;
        }

        return {
            x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
            y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
        };
    };

    const setFalloffCenterFromEvent = event => {
        const point = surfaceEventToPoint(event);

        if (!point) {
            return;
        }

        modifier.values.falloff_center_x = point.x;
        modifier.values.falloff_center_y = point.y;
    };

    const grabFalloffCenter = event => {
        if (hasCustomFalloff.value) {
            return;
        }

        draggingFalloffCenter.value = true;
        setFalloffCenterFromEvent(event);
    };

    const moveFalloffCenter = event => {
        if (moveCustomPoint(event)) {
            return;
        }

        if (!draggingFalloffCenter.value) {
            return;
        }

        setFalloffCenterFromEvent(event);
    };

    const releaseFalloffCenter = () => {
        draggingFalloffCenter.value = false;
        releaseCustomPoint();
    };

    const resetValues = () => {
        modifier.values.noise_level = 10;

        modifier.values.pixel_size = 10;

        modifier.values.glass_effect_type = 1;
        modifier.values.glass_frost_strength = 5;
        modifier.values.glass_frost_mode = 1;
        modifier.values.glass_blur_radius = 5;
        modifier.values.glass_crack_intensity = 10;
        modifier.values.glass_reflection_strength = 0.5;

        modifier.values.deepness_factor = 1.0;
        modifier.values.highness_factor = 1.0;

        modifier.values.falloff_custom_enabled = false;
        modifier.values.falloff_custom_points = [];
        activeCustomPointId.value = "";
        modifier.values.falloff_preset = "smooth";
        modifier.values.falloff_radius = 100;
        modifier.values.falloff_strength = 1.0;
        modifier.values.falloff_center_x = 0.5;
        modifier.values.falloff_center_y = 0.5;
        modifier.values.falloff_inverted = false;
        modifier.values.falloff_random_seed = 1;
    };

    const selectFalloffPreset = value => {
        if (value === "custom") {
            modifier.values.falloff_custom_enabled = true;

            if (!modifier.values.falloff_custom_points.length) {
                applyPresetPointsToCustomFalloff(
                    modifier.values.falloff_preset || "smooth"
                );
            }

            return;
        }

        modifier.values.falloff_preset = value;

        /**
         * Wenn Custom aktiv ist oder bereits Custom Points existieren,
         * ordnet jeder Preset-Klick die Punkte passend zum Preset neu an.
         *
         * Ergebnis:
         * - Custom bleibt aktiv.
         * - Punkte werden auf der Canvas neu positioniert.
         * - Das Preset beeinflusst weiterhin die Backend-Ease-Kurve.
         */
        if (
            modifier.values.falloff_custom_enabled ||
            modifier.values.falloff_custom_points.length > 0
        ) {
            applyPresetPointsToCustomFalloff(value);
        }
    };

    const addCustomPointFromEvent = event => {
        const point = surfaceEventToPoint(event);

        if (!point) {
            return;
        }

        modifier.values.falloff_custom_enabled = true;
        modifier.values.falloff_custom_points.push(
            createPoint(point.x, point.y)
        );
    };

    const grabCustomPoint = id => {
        activeCustomPointId.value = id;
        modifier.values.falloff_custom_enabled = true;
    };

    const moveCustomPoint = event => {
        if (!activeCustomPointId.value) {
            return false;
        }

        const next = surfaceEventToPoint(event);

        if (!next) {
            return false;
        }

        const point = modifier.values.falloff_custom_points.find(
            item => item.id === activeCustomPointId.value
        );

        if (!point) {
            return false;
        }

        point.x = next.x;
        point.y = next.y;

        return true;
    };

    const releaseCustomPoint = () => {
        activeCustomPointId.value = "";
    };

    const removeCustomPoint = id => {
        const index = modifier.values.falloff_custom_points.findIndex(
            point => point.id === id
        );

        if (index >= 0) {
            modifier.values.falloff_custom_points.splice(index, 1);
        }

        if (!modifier.values.falloff_custom_points.length) {
            modifier.values.falloff_custom_enabled = false;
        }
    };

    const submit = async () => {
        if (!props.layer?.id || props.loading) {
            return;
        }

        emitEvent("modifier:effects-applied", buildPayload());
    };

    watch(
        () => [
            ...Object.entries(modifier.values)
                .filter(([key]) => key !== "falloff_custom_points")
                .map(([, value]) => value),
            modifier.values.falloff_custom_points
                .map(point => `${point.x}:${point.y}`)
                .join("|"),
        ].join("|"),
        () => {
            requestPreviewDebounced();
        }
    );

    watch(
        () => props.previewSrc,
        async src => {
            if (src && previewCanvas.value) {
                await drawToCanvas(src, previewCanvas.value);
            }
        }
    );

    watch(
        () => props.layer?.url,
        async url => {
            if (url && previewCanvas.value) {
                await drawToCanvas(url, previewCanvas.value);
                requestPreviewDebounced();
            }
        },
        { immediate: true }
    );

    onMounted(async () => {
        if (props.layer?.url && previewCanvas.value) {
            await drawToCanvas(props.layer.url, previewCanvas.value);
        }

        requestPreviewDebounced();
    });

    onBeforeUnmount(() => {
        if (previewTimer.value) {
            clearTimeout(previewTimer.value);
        }
    });

    return {
        previewCanvas,
        falloffSurface,
        draggingFalloffCenter,

        config,
        modifier,

        imageWidth,
        imageHeight,
        imageSizeLabel,

        effectItems,
        falloffPresets,
        glassEffectTypes,
        glassFrostModes,

        activeEffectLabel,
        activeEffectDescription,
        falloffLabel,
        operationSummary,

        activeCustomPointId,

        hasCustomFalloff,
        customFalloffPolyline,

        emitEvent,
        selectEffect,

        requestPreviewNow,

        grabFalloffCenter,
        moveFalloffCenter,
        releaseFalloffCenter,
        selectFalloffPreset,

        addCustomPointFromEvent,
        grabCustomPoint,
        removeCustomPoint,

        resetValues,
        submit,
    };
}

export const modifierEffectsProps = {
    state: {
        type: Boolean,
        required: true,
    },
    loading: {
        type: Boolean,
        required: true,
    },
    loadingPreview: {
        type: Boolean,
        required: true,
    },
    layer: {
        type: Object,
        required: false,
        default: null,
    },
    previewSrc: {
        type: String,
        required: false,
        default: "",
    },
    theme: {
        type: String,
        required: false,
        default: "dark",
    },
};