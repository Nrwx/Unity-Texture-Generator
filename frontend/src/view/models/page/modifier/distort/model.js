import {
    computed,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
} from "vue";

import { settings } from "@/dataLayer/parameter";
import { clamp } from "@/utils/tools";
import { createPoint, drawToCanvas } from "@/utils/canvas";
import {number} from "@/utils/math";

const PREVIEW_DEBOUNCE_MS = 220;

const DISTORT_ITEMS = [
    {
        key: "distort",
        title: "Verzerren",
        icon: "mdi-vector-curve",
        description: "Zufällige lokale Dehnung und Verschiebung über apply_distort.py.",
    },
    {
        key: "wave",
        title: "Welle",
        icon: "mdi-waveform",
        description: "Sinusbasierte Wellenverzerrung über apply_wave.py.",
    },
    {
        key: "random_shift",
        title: "Zufälliger Versatz",
        icon: "mdi-shuffle-variant",
        description: "Verschiebt das Bild zufällig horizontal und vertikal.",
    },
];

const FALLBACK_FALLOFF_PRESETS = [
    {
        title: "Smooth",
        value: "smooth",
        icon: "mdi-chart-bell-curve",
        description: "Gentle, gradual fade.",
    },
    {
        title: "Custom",
        value: "custom",
        icon: "mdi-vector-polyline-edit",
        description: "Draw a custom falloff curve with connected points.",
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

const WAVE_AXIS_ITEMS = [
    {
        title: "Vertikal",
        value: "vertical",
        icon: "mdi-arrow-up-down",
    },
    {
        title: "Horizontal",
        value: "horizontal",
        icon: "mdi-arrow-left-right",
    },
];

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

export function modifierDistortModel(props, emit) {
    const previewCanvas = ref(null);
    const falloffSurface = ref(null);
    const previewTimer = ref(null);
    const previewRequestId = ref(0);
    const draggingFalloffCenter = ref(false);
    const activeCustomPointId = ref("");

    const config = computed(() => ({
        title: "Verzerrung",
        subtitle: props.layer?.id || "",
        width: "100%",
        maxWidth: 980,
        height: "auto",
        maxHeight: 700,
        fullscreen: false,
        variant: "rounded",
        emit: "modifier-distort:state",
        hideClose: true,
    }));

    const modifier = reactive({
        values: {
            distort_effect: "distort",

            distortion_factor: 0.2,

            wave_strength: settings.amplitude || 5,
            wave_frequency: settings.frequency || 5,
            wave_axis: "vertical",

            max_shift_ratio: settings.max_shift_ratio || 0.1,

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

    const imageWidth = computed(() => number(props.layer?.width || 0));
    const imageHeight = computed(() => number(props.layer?.height || 0));

    const imageSizeLabel = computed(() => {
        if (!imageWidth.value || !imageHeight.value) {
            return "Keine Ebene";
        }

        return `${imageWidth.value} × ${imageHeight.value}`;
    });

    const falloffPresets = computed(() => {
        return settings.falloffPresets || FALLBACK_FALLOFF_PRESETS;
    });

    const activeEffect = computed(() => {
        return (
            DISTORT_ITEMS.find(
                item => item.key === modifier.values.distort_effect
            ) || DISTORT_ITEMS[0]
        );
    });

    const activeEffectLabel = computed(() => activeEffect.value.title);
    const activeEffectDescription = computed(() => activeEffect.value.description);

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

    const operationSummary = computed(() => {
        return `${activeEffectLabel.value} · ${falloffLabel.value}`;
    });

    const normalizeValues = () => ({
        distort_effect: String(modifier.values.distort_effect || "distort"),

        distortion_factor: clamp(Number(modifier.values.distortion_factor), 0, 1),

        wave_strength: clamp(Number(modifier.values.wave_strength), 0, 100),
        wave_frequency: clamp(Number(modifier.values.wave_frequency), 1, 200),
        wave_axis: String(modifier.values.wave_axis || "vertical"),

        max_shift_ratio: clamp(Number(modifier.values.max_shift_ratio), 0, 1),

        falloff_custom_enabled: modifier.values.falloff_custom_enabled === true,
        falloff_custom_points: modifier.values.falloff_custom_points.map(point => ({
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

        emitEvent("modifier:distort-preview", {
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
        modifier.values.distort_effect = key;
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

    const applyPresetPointsToCustomFalloff = preset => {
        modifier.values.falloff_custom_enabled = true;

        modifier.values.falloff_custom_points.splice(
            0,
            modifier.values.falloff_custom_points.length,
            ...createFalloffPresetPoints(preset)
        );

        activeCustomPointId.value = "";
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

        if (
            modifier.values.falloff_custom_enabled ||
            modifier.values.falloff_custom_points.length > 0
        ) {
            applyPresetPointsToCustomFalloff(value);
        }
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

    const moveFalloffCenter = event => {
        if (moveCustomPoint(event)) {
            return;
        }

        if (!draggingFalloffCenter.value) {
            return;
        }

        setFalloffCenterFromEvent(event);
    };

    const releaseCustomPoint = () => {
        activeCustomPointId.value = "";
    };

    const releaseFalloffCenter = () => {
        draggingFalloffCenter.value = false;
        releaseCustomPoint();
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

    const clearCustomFalloff = () => {
        modifier.values.falloff_custom_points = [];
        modifier.values.falloff_custom_enabled = false;
        activeCustomPointId.value = "";
    };

    const resetValues = () => {
        modifier.values.distortion_factor = 0.2;

        modifier.values.wave_strength = settings.amplitude || 5;
        modifier.values.wave_frequency = settings.frequency || 5;
        modifier.values.wave_axis = "vertical";

        modifier.values.max_shift_ratio = settings.max_shift_ratio || 0.1;

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

    const submit = async () => {
        if (!props.layer?.id || props.loading) {
            return;
        }

        emitEvent("modifier:distort-applied", buildPayload());
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
        activeCustomPointId,

        config,
        modifier,

        imageWidth,
        imageHeight,
        imageSizeLabel,

        distortItems: DISTORT_ITEMS,
        falloffPresets,
        waveAxisItems: WAVE_AXIS_ITEMS,

        activeEffectLabel,
        activeEffectDescription,
        falloffLabel,
        operationSummary,

        hasCustomFalloff,
        customFalloffPolyline,

        emitEvent,
        selectEffect,
        selectFalloffPreset,

        requestPreviewNow,

        grabFalloffCenter,
        moveFalloffCenter,
        releaseFalloffCenter,

        addCustomPointFromEvent,
        grabCustomPoint,
        removeCustomPoint,
        clearCustomFalloff,

        resetValues,
        submit,
    };
}

export const modifierDistortProps = {
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