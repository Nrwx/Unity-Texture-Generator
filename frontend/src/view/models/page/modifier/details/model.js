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
        key: "sharpness",
        title: "Schärfen",
        icon: "mdi-image-filter-center-focus-strong",
        description: "Unsharp Masking über apply_sharpness.py.",
    },
    {
        key: "blur",
        title: "Blur",
        icon: "mdi-blur",
        description: "Weichzeichnung über apply_blur.py mit Mode, Radius, Falloff und Typ.",
    },
    {
        key: "edge_detection",
        title: "Edges",
        icon: "mdi-vector-polyline",
        description: "Kantenerkennung über Canny, Sobel oder Laplacian.",
    },
    {
        key: "edge_smooth",
        title: "Smooth",
        icon: "mdi-vector-radius",
        description: "Kantenrestaurierung mit Edge-Maske, Smooth und Highpass.",
    },
    {
        key: "blend_edges",
        title: "Blend",
        icon: "mdi-blur-linear",
        description: "Verblendet Bildränder mit einstellbarer Intensität.",
    },
];

const EDGE_METHODS = [
    {
        title: "Canny",
        value: "canny",
        icon: "mdi-vector-polyline",
    },
    {
        title: "Sobel",
        value: "sobel",
        icon: "mdi-chart-bell-curve",
    },
    {
        title: "Laplacian",
        value: "laplacian",
        icon: "mdi-waveform",
    },
];

const POINT_FALLOFF_MODES = [
    {
        title: "Radial",
        value: "radial",
        icon: "mdi-circle-slice-8",
    },
    {
        title: "Point",
        value: "point",
        icon: "mdi-record-circle-outline",
    },
    {
        title: "Linear",
        value: "linear",
        icon: "mdi-vector-line",
    },
    {
        title: "Quadratic",
        value: "quadratic",
        icon: "mdi-chart-bell-curve-cumulative",
    },
    {
        title: "Cubic",
        value: "cubic",
        icon: "mdi-chart-bell-curve",
    },
    {
        title: "Expo",
        value: "exponential",
        icon: "mdi-trending-up",
    },
];

export function modifierDetailsModel(props, emit) {
    const previewCanvas = ref(null);
    const pointSurface = ref(null);
    const previewTimer = ref(null);
    const previewRequestId = ref(0);
    const activePointId = ref("");

    const config = computed(() => ({
        title: "Schärfe & Details",
        subtitle: props.layer?.id || "",
        width: "100%",
        maxWidth: 980,
        height: "auto",
        maxHeight: 700,
        fullscreen: false,
        variant: "rounded",
        emit: "modifier-details:state",
        hideClose: true,
    }));

    const modifier = reactive({
        values: {
            details_effect: "sharpness",

            sharpness: 1.5,

            blur: 5,
            blur_mode: 1,
            blur_radius: 15,
            blur_falloff_mode: 1,
            blur_type: 1,

            edge_detection: true,
            edge_method: "canny",
            edge_threshold1: 50,
            edge_threshold2: 150,
            edge_kernel_size: 3,
            edge_alpha: 0.5,

            edge_threshold_min: 1,
            edge_threshold_max: 250,
            mask_expand: 1.5,
            sharpness_boost: 1.2,

            blending_intensity: 50,

            point_radius: 35,
            point_falloff: "radial",
            point_strength: 1.0,
            point_chain: true,
        },

        points: [],
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

    const blurModes = computed(() => settings.blurModes || []);
    const blurFalloffModes = computed(() => settings.blurFalloffModes || []);
    const blurTypes = computed(() => settings.blurTypes || []);

    const hasPoints = computed(() => modifier.points.length > 0);

    const activeEffect = computed(() => {
        return (
            EFFECT_ITEMS.find(
                item => item.key === modifier.values.details_effect
            ) || EFFECT_ITEMS[0]
        );
    });

    const activeEffectLabel = computed(() => activeEffect.value.title);
    const activeEffectDescription = computed(() => activeEffect.value.description);

    const influenceLabel = computed(() => {
        if (!hasPoints.value) {
            return "Ganzes Bild";
        }

        return `${modifier.points.length} Point${modifier.points.length === 1 ? "" : "s"} · ${modifier.values.point_falloff}`;
    });

    const operationSummary = computed(() => {
        return `${activeEffectLabel.value} · ${influenceLabel.value}`;
    });

    const polylinePoints = computed(() => {
        return modifier.points
            .map(point => `${point.x * 100},${point.y * 100}`)
            .join(" ");
    });

    const pointInfluenceRadius = computed(() => {
        return clamp(Number(modifier.values.point_radius || 35) / 2, 1, 50);
    });

    const normalizeValues = () => ({
        details_effect: String(modifier.values.details_effect || "sharpness"),

        sharpness: clamp(Number(modifier.values.sharpness), 0, 2),

        blur: clamp(Number(modifier.values.blur), 0, 10),
        blur_mode: clamp(Math.round(modifier.values.blur_mode), 1, 7),
        blur_radius: clamp(Math.round(modifier.values.blur_radius), 1, 200),
        blur_falloff_mode: clamp(Math.round(modifier.values.blur_falloff_mode), 1, 5),
        blur_type: clamp(Math.round(modifier.values.blur_type), 1, 2),

        edge_detection: modifier.values.edge_detection === true,
        edge_method: String(modifier.values.edge_method || "canny"),
        edge_threshold1: clamp(Math.round(modifier.values.edge_threshold1), 0, 255),
        edge_threshold2: clamp(Math.round(modifier.values.edge_threshold2), 0, 255),
        edge_kernel_size: clamp(
            Math.round(modifier.values.edge_kernel_size) || 3,
            1,
            31
        ),
        edge_alpha: clamp(Number(modifier.values.edge_alpha), 0, 1),

        edge_threshold_min: clamp(Math.round(modifier.values.edge_threshold_min), 0, 255),
        edge_threshold_max: clamp(Math.round(modifier.values.edge_threshold_max), 0, 255),
        mask_expand: clamp(Number(modifier.values.mask_expand), 0, 10),
        sharpness_boost: clamp(Number(modifier.values.sharpness_boost), 0, 3),

        blending_intensity: clamp(Number(modifier.values.blending_intensity), 0, 100),

        point_radius: clamp(Math.round(modifier.values.point_radius), 1, 100),
        point_falloff: String(modifier.values.point_falloff || "radial"),
        point_strength: clamp(Number(modifier.values.point_strength), 0, 1),
        point_chain: modifier.values.point_chain === true,

        points: modifier.points.map(point => ({
            x: clamp(Number(point.x), 0, 1),
            y: clamp(Number(point.y), 0, 1),
        })),
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

        emitEvent("modifier:details-preview", {
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

    const eventToPoint = event => {
        if (!pointSurface.value) {
            return null;
        }

        const rect = pointSurface.value.getBoundingClientRect();

        if (!rect.width || !rect.height) {
            return null;
        }

        return {
            x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
            y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
        };
    };

    const addPointFromEvent = event => {
        const point = eventToPoint(event);

        if (!point) {
            return;
        }

        modifier.points.push(createPoint(point.x, point.y));
    };

    const addCenterPoint = () => {
        modifier.points.push(createPoint(0.5, 0.5));
    };

    const addCornerChain = () => {
        modifier.points.splice(
            0,
            modifier.points.length,
            createPoint(0.2, 0.8),
            createPoint(0.5, 0.5),
            createPoint(0.8, 0.2)
        );
    };

    const clearPoints = () => {
        modifier.points.splice(0, modifier.points.length);
        activePointId.value = "";
    };

    const grabPoint = id => {
        activePointId.value = id;
    };

    const moveActivePoint = event => {
        if (!activePointId.value) {
            return;
        }

        const next = eventToPoint(event);

        if (!next) {
            return;
        }

        const point = modifier.points.find(item => item.id === activePointId.value);

        if (!point) {
            return;
        }

        point.x = next.x;
        point.y = next.y;
    };

    const releasePoint = () => {
        activePointId.value = "";
    };

    const removePoint = id => {
        const index = modifier.points.findIndex(point => point.id === id);

        if (index >= 0) {
            modifier.points.splice(index, 1);
        }
    };

    const selectEffect = key => {
        modifier.values.details_effect = key;
    };

    const resetValues = () => {
        modifier.values.sharpness = 1.5;

        modifier.values.blur = 5;
        modifier.values.blur_mode = 1;
        modifier.values.blur_radius = 15;
        modifier.values.blur_falloff_mode = 1;
        modifier.values.blur_type = 1;

        modifier.values.edge_detection = true;
        modifier.values.edge_method = "canny";
        modifier.values.edge_threshold1 = 50;
        modifier.values.edge_threshold2 = 150;
        modifier.values.edge_kernel_size = 3;
        modifier.values.edge_alpha = 0.5;

        modifier.values.edge_threshold_min = 1;
        modifier.values.edge_threshold_max = 250;
        modifier.values.mask_expand = 1.5;
        modifier.values.sharpness_boost = 1.2;

        modifier.values.blending_intensity = 50;

        modifier.values.point_radius = 35;
        modifier.values.point_falloff = "radial";
        modifier.values.point_strength = 1.0;
        modifier.values.point_chain = true;
    };

    const submit = async () => {
        if (!props.layer?.id || props.loading) {
            return;
        }

        emitEvent("modifier:details-applied", buildPayload());
    };

    watch(
        () => [
            modifier.values.details_effect,

            modifier.values.sharpness,

            modifier.values.blur,
            modifier.values.blur_mode,
            modifier.values.blur_radius,
            modifier.values.blur_falloff_mode,
            modifier.values.blur_type,

            modifier.values.edge_detection,
            modifier.values.edge_method,
            modifier.values.edge_threshold1,
            modifier.values.edge_threshold2,
            modifier.values.edge_kernel_size,
            modifier.values.edge_alpha,

            modifier.values.edge_threshold_min,
            modifier.values.edge_threshold_max,
            modifier.values.mask_expand,
            modifier.values.sharpness_boost,

            modifier.values.blending_intensity,

            modifier.values.point_radius,
            modifier.values.point_falloff,
            modifier.values.point_strength,
            modifier.values.point_chain,

            modifier.points.map(point => `${point.x}:${point.y}`).join("|"),
        ],
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
        if (props.layer?.url) {
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
        pointSurface,
        activePointId,

        config,
        modifier,

        imageWidth,
        imageHeight,
        imageSizeLabel,

        effectItems: EFFECT_ITEMS,
        edgeMethods: EDGE_METHODS,
        pointFalloffModes: POINT_FALLOFF_MODES,

        blurModes,
        blurFalloffModes,
        blurTypes,

        hasPoints,
        activeEffectLabel,
        activeEffectDescription,
        influenceLabel,
        operationSummary,
        polylinePoints,
        pointInfluenceRadius,

        emitEvent,
        selectEffect,

        requestPreviewNow,

        addPointFromEvent,
        addCenterPoint,
        addCornerChain,
        clearPoints,
        grabPoint,
        moveActivePoint,
        releasePoint,
        removePoint,

        resetValues,
        submit,
    };
}

export const modifierDetailsProps = {
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