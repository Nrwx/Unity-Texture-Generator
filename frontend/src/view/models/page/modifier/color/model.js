import {computed, onBeforeUnmount, onMounted, reactive, ref, watch} from "vue";

import { settings } from "@/dataLayer/parameter";
import {clamp, intersect} from "@/utils/tools";
import {drawToCanvas} from "@/utils/canvas";

const PREVIEW_DEBOUNCE_MS = 220;

export function modifierColorModel(props, emit) {
    const previewCanvas = ref(null);
    const previewTimer = ref(null);
    const previewRequestId = ref(0);

    const config = computed(() => ({
        title: "Farbe & Licht",
        subtitle: props.layer?.id || "",
        width: "100%",
        maxWidth: 920,
        height: "auto",
        maxHeight: 660,
        fullscreen: false,
        variant: "rounded",
        emit: "modifier-color:state",
        hideClose: true,
    }));

    const modifier = reactive({
        values: {
            brightness: 100,
            contrast: 50,
            color_shift: 0,
            hue_variation: 0,
            invert_colors: false,
            color_lookup: 0,
        },

        ui: {
            activePanel: "brightnessContrast",
        },
    });

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const imageWidth = computed(() => Number(props.layer?.width || 0));
    const imageHeight = computed(() => Number(props.layer?.height || 0));

    const getLayerViewportPosition = () => {
        return {
            x: Number(
                props.layer?.x ??
                props.layer?.left ??
                props.layer?.position?.x ??
                0
            ),
            y: Number(
                props.layer?.y ??
                props.layer?.top ??
                props.layer?.position?.y ??
                0
            ),
        };
    };

    const getViewportBox = () => {
        return {
            x: 0,
            y: 0,
            width: Number(props.viewport?.width || imageWidth.value || 0),
            height: Number(props.viewport?.height || imageHeight.value || 0),
        };
    };

    const getSelectMaskLayerBox = () => {
        if (!props.selectMask || !imageWidth.value || !imageHeight.value) {
            return null;
        }

        const viewportBox = getViewportBox();

        const selectBox = {
            x: Number(props.selectMask.x || 0),
            y: Number(props.selectMask.y || 0),
            width: Number(props.selectMask.width || 0),
            height: Number(props.selectMask.height || 0),
        };

        if (selectBox.width <= 0 || selectBox.height <= 0) {
            return null;
        }

        const visibleSelectBox = intersect(selectBox, viewportBox);

        if (!visibleSelectBox) {
            return null;
        }

        const layerPosition = getLayerViewportPosition();

        const layerBox = {
            x: layerPosition.x,
            y: layerPosition.y,
            width: imageWidth.value,
            height: imageHeight.value,
        };

        const overlap = intersect(visibleSelectBox, layerBox);

        if (!overlap) {
            return null;
        }

        return {
            x: overlap.x - layerBox.x,
            y: overlap.y - layerBox.y,
            width: overlap.width,
            height: overlap.height,
        };
    };

    const selectionStyle = computed(() => {
        const box = getSelectMaskLayerBox();

        if (!box) {
            return {
                display: "none",
            };
        }

        return {
            left: `${(box.x / imageWidth.value) * 100}%`,
            top: `${(box.y / imageHeight.value) * 100}%`,
            width: `${(box.width / imageWidth.value) * 100}%`,
            height: `${(box.height / imageHeight.value) * 100}%`,
        };
    });

    const maskDescription = computed(() => {
        if (maskType.value === "select") {
            return "Der Color Modifier wird auf die aktive Selection angewendet.";
        }

        if (maskType.value === "layer") {
            return "Die vorhandene layer.mask wird als Bearbeitungsmaske verwendet.";
        }

        return "Der Color Modifier wirkt auf die gesamte Ebene.";
    });

    const imageSizeLabel = computed(() => {
        if (!imageWidth.value || !imageHeight.value) {
            return "Keine Ebene";
        }

        return `${imageWidth.value} × ${imageHeight.value}`;
    });

    const colorLookupModes = computed(() => settings.colorLookupModes || []);

    const panelItems = computed(() => [
        {
            key: "brightnessContrast",
            title: "Helligkeit",
            icon: "mdi-brightness-6",
        },
        {
            key: "colorShift",
            title: "Farbshift",
            icon: "mdi-palette-swatch",
        },
        {
            key: "hueRotation",
            title: "Hue",
            icon: "mdi-rotate-3d-variant",
        },
        {
            key: "invertColors",
            title: "Invert",
            icon: "mdi-invert-colors",
        },
        {
            key: "colorLookup",
            title: "Lookup",
            icon: "mdi-table-filter",
        },
    ]);

    const operationSummary = computed(() => {
        const stack = [];

        if (
            Number(modifier.values.brightness) !== 100 ||
            Number(modifier.values.contrast) !== 50
        ) {
            stack.push("Brightness / Contrast");
        }

        if (Number(modifier.values.color_shift) !== 0) {
            stack.push("Color Shift");
        }

        if (Number(modifier.values.hue_variation) !== 0) {
            stack.push("Hue");
        }

        if (modifier.values.invert_colors) {
            stack.push("Invert");
        }

        if (Number(modifier.values.color_lookup) !== 0) {
            stack.push("Lookup");
        }

        return stack.length ? stack.join(" → ") : "Keine Änderung";
    });

    const normalizeValues = () => ({
        brightness: clamp(Math.round(modifier.values.brightness), 0, 200),
        contrast: clamp(Math.round(modifier.values.contrast), 0, 100),
        color_shift: clamp(Math.round(modifier.values.color_shift), -100, 100),
        hue_variation: clamp(Math.round(modifier.values.hue_variation), -180, 180),
        invert_colors: modifier.values.invert_colors,
        color_lookup: clamp(Math.round(modifier.values.color_lookup), 0, 25),
    });

    const buildPayload = () => ({
        layer: props.layer,
        values: normalizeValues(),
        mask: {
            type: maskType.value,
            select: props.selectMask,
            shape: props.selectMaskShape || "rectangle",
        },
    });

    const hasSelectMask = computed(() => {
        return (
            !!props.selectMask &&
            Number(props.selectMask.width || 0) > 0 &&
            Number(props.selectMask.height || 0) > 0
        );
    });

    const hasLayerMask = computed(() => {
        return !!props.layer?.mask && String(props.layer.mask).trim() !== "";
    });

    const maskType = computed(() => {
        if (hasSelectMask.value) {
            return "select";
        }

        if (hasLayerMask.value) {
            return "layer";
        }

        return "none";
    });

    const maskLabel = computed(() => {
        if (maskType.value === "select") {
            return "Selection Mask";
        }

        if (maskType.value === "layer") {
            return "Layer Mask";
        }

        return "Ganze Ebene";
    });

    const requestPreviewNow = async () => {
        if (!props.layer?.id) {
            return;
        }

        const currentRequestId = previewRequestId.value + 1;

        previewRequestId.value = currentRequestId;

        emitEvent("modifier:color-preview", {
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

    const selectPanel = (key) => {
        modifier.ui.activePanel = key;
    };

    const resetBrightnessContrast = () => {
        modifier.values.brightness = 100;
        modifier.values.contrast = 50;
    };

    const resetColorShift = () => {
        modifier.values.color_shift = 0;
    };

    const resetHueRotation = () => {
        modifier.values.hue_variation = 0;
    };

    const resetInvertColors = () => {
        modifier.values.invert_colors = false;
    };

    const resetColorLookup = () => {
        modifier.values.color_lookup = 0;
    };

    const resetAll = () => {
        resetBrightnessContrast();
        resetColorShift();
        resetHueRotation();
        resetInvertColors();
        resetColorLookup();

        modifier.ui.activePanel = "brightnessContrast";
    };

    const submit = async () => {
        if (!props.layer?.id || props.loading) {
            return;
        }

        emitEvent("modifier:color-applied", buildPayload());
    };

    watch(
        () => modifier.values,
        () => {
            requestPreviewDebounced();
        },
        { deep: true }
    );

    watch(
        () => props.previewSrc,
        async (src) => {
            if (!src) {
                return;
            }

            if (previewCanvas.value) await drawToCanvas(src, previewCanvas.value);
        }
    );

    watch(
        () => props.layer?.url,
        async (url) => {
            if (url && previewCanvas.value) {
                await drawToCanvas(url, previewCanvas.value);
                requestPreviewDebounced();
            }
        },
        { immediate: true }
    );

    watch(
        () => [
            props.selectMask?.x,
            props.selectMask?.y,
            props.selectMask?.width,
            props.selectMask?.height,
            props.selectMaskShape,
            props.layer?.mask,
        ],
        () => {
            requestPreviewDebounced();
        }
    );

    onMounted(async () => {
        resetAll();

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

        config,
        modifier,

        imageWidth,
        imageHeight,
        imageSizeLabel,

        selectionStyle,

        colorLookupModes,
        panelItems,
        operationSummary,

        hasSelectMask,
        hasLayerMask,
        maskType,
        maskLabel,
        maskDescription,

        emitEvent,
        selectPanel,

        requestPreviewNow,

        resetBrightnessContrast,
        resetColorShift,
        resetHueRotation,
        resetInvertColors,
        resetColorLookup,
        resetAll,

        submit,
    };
}

export const modifierColorProps = {
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
    selectMask: {
        type: Object,
        required: false,
        default: null,
    },
    selectMaskShape: {
        type: String,
        required: false,
        default: "rectangle",
    },
    viewport: {
        type: Object,
        required: false,
        default: null,
    },
    theme: {
        type: String,
        required: false,
        default: "dark",
    },
};