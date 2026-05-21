import {computed, onBeforeUnmount, onMounted, reactive} from "vue";

const RESIZE_STEPS = [
    {
        key: "dimensions",
        title: "Dimensions",
        hint: "Width & Height",
        icon: "mdi-aspect-ratio",
    },
    {
        key: "fit",
        title: "Fit",
        hint: "Crop or Padding",
        icon: "mdi-fit-to-page-outline",
    },
    {
        key: "quality",
        title: "Quality",
        hint: "Sampling",
        icon: "mdi-tune-variant",
    },
];

const RESIZE_OPTIONS = [
    { title: "Original", value: 0, hint: "Keine Skalierung" },
    { title: "32 × 32", value: 1, hint: "Icon / Tiny" },
    { title: "64 × 64", value: 2, hint: "Icon" },
    { title: "128 × 128", value: 3, hint: "Preview" },
    { title: "256 × 256", value: 4, hint: "Small Asset" },
    { title: "512 × 512", value: 5, hint: "Texture" },
    { title: "1024 × 1024", value: 6, hint: "HD Asset" },
    { title: "2048 × 2048", value: 7, hint: "2K" },
    { title: "4096 × 4096", value: 8, hint: "4K" },
    { title: "8192 × 8192", value: 9, hint: "8K" },
];

const RESIZE_MODES = [
    {
        title: "Auto-Crop",
        value: 0,
        icon: "mdi-crop-free",
        description: "Füllt die Zielgröße und schneidet überstehende Bereiche ab.",
    },
    {
        title: "Padding",
        value: 1,
        icon: "mdi-image-filter-center-focus",
        description: "Behält das Bild komplett und füllt transparente Ränder auf.",
    },
];

const UPSCALE_METHODS = [
    {
        title: "Nearest",
        value: 0,
        icon: "mdi-grid",
        description: "Hart, pixelig, ideal für Pixel-Art.",
    },
    {
        title: "Bicubic",
        value: 1,
        icon: "mdi-blur",
        description: "Weich und sauber, guter Standard.",
    },
    {
        title: "AI / WIP",
        value: 2,
        icon: "mdi-auto-fix",
        description: "Aktuell Placeholder über OpenCV Cubic.",
    },
];

const clamp = (value, min, max) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return min;
    }

    return Math.min(Math.max(number, min), max);
};

export function modifierResizeModel(props, emit) {

    const config = computed(() => ({
        title: "Image Transform",
        subtitle: props.layer?.id || "",
        width: '100%',
        maxWidth: 960,
        height: "auto",
        maxHeight: 680,
        fullscreen: false,
        variant: "rounded",
        emit: "modifier-resize:state",
        hideClose: true,
    }));

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

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

    const intersectBoxes = (a, b) => {
        const left = Math.max(a.x, b.x);
        const top = Math.max(a.y, b.y);
        const right = Math.min(a.x + a.width, b.x + b.width);
        const bottom = Math.min(a.y + a.height, b.y + b.height);

        if (right <= left || bottom <= top) {
            return null;
        }

        return {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
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

        const visibleSelectBox = intersectBoxes(selectBox, viewportBox);

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

        const overlap = intersectBoxes(visibleSelectBox, layerBox);

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

    const modifier = reactive({
        loading: false,
        crop: {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        },
        resize: {
            index: 0,
            width: null,
            height: null,
            keepAspectRatio: true,
            isCustom: false,
            mode: 0,
            upscaleMethod: 1,
        },
        cutout: {
            enabled: false,
        },
        ui: {
            activePanel: "resize",
            resizeStep: "dimensions",
            previewMode: "result",
        },
    });

    const imageWidth = computed(() => Number(props.layer?.width || 0));
    const imageHeight = computed(() => Number(props.layer?.height || 0));

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

        return "Keine Maske";
    });

    const maskDescription = computed(() => {
        if (maskType.value === "select") {
            return "Der Dialog wurde mit einer aktiven Auswahl geöffnet.";
        }

        if (maskType.value === "layer") {
            return "Die vorhandene layer.mask wird als Referenz verwendet.";
        }

        return "Cutout benötigt eine Selection Mask oder eine layer.mask.";
    });

    const canUseCutout = computed(() => {
        return maskType.value !== "none";
    });

    const outputSizeLabel = computed(() => {
        if (Number(modifier.resize.index) === 0 && !modifier.resize.isCustom) {
            return `${cropSize.value.width} × ${cropSize.value.height}`;
        }

        return resizeSizeLabel.value;
    });

    const cropSize = computed(() => {
        const width = Math.max(
            1,
            imageWidth.value - Number(modifier.crop.left || 0) - Number(modifier.crop.right || 0)
        );

        const height = Math.max(
            1,
            imageHeight.value - Number(modifier.crop.top || 0) - Number(modifier.crop.bottom || 0)
        );

        return {
            width,
            height,
            label: `${width} × ${height}`,
        };
    });

    const operationSummary = computed(() => {
        const items = [];

        const cropActive =
            Number(modifier.crop.left) > 0 ||
            Number(modifier.crop.top) > 0 ||
            Number(modifier.crop.right) > 0 ||
            Number(modifier.crop.bottom) > 0;

        if (cropActive) {
            items.push("Crop");
        }

        if (hasResizeChange.value) {
            items.push("Resize");
        }

        if (modifier.cutout.enabled && canUseCutout.value) {
            items.push("Cutout");
        }

        if (!items.length) {
            return "Keine Änderung";
        }

        return items.join(" → ");
    });

    const panelItems = computed(() => {
        return [
            {
                key: "resize",
                title: "Resize",
                icon: "mdi-resize",
                enabled: true,
            },
            {
                key: "crop",
                title: "Crop",
                icon: "mdi-crop",
                enabled: true,
            },
            {
                key: "cutout",
                title: "Cutout",
                icon: "mdi-content-cut",
                enabled: canUseCutout.value,
            },
        ];
    });

    const resizeStepIndex = computed(() => {
        return Math.max(
            0,
            RESIZE_STEPS.findIndex(step => step.key === modifier.ui.resizeStep)
        );
    });

    const resizeAspectRatio = computed(() => {
        const width = cropSize.value.width || imageWidth.value;
        const height = cropSize.value.height || imageHeight.value;

        if (!width || !height) {
            return 1;
        }

        return width / height;
    });

    const selectedResizePreset = computed(() => {
        return RESIZE_OPTIONS.find(
            item => item.value === Number(modifier.resize.index)
        );
    });

    const resizeWidth = computed(() => {
        if (modifier.resize.isCustom) {
            return Number(modifier.resize.width || 0);
        }

        const selected = selectedResizePreset.value;

        if (!selected || selected.value === 0) {
            return cropSize.value.width;
        }

        return Number(String(selected.title).split("×")[0]?.trim() || cropSize.value.width);
    });

    const resizeHeight = computed(() => {
        if (modifier.resize.isCustom) {
            return Number(modifier.resize.height || 0);
        }

        const selected = selectedResizePreset.value;

        if (!selected || selected.value === 0) {
            return cropSize.value.height;
        }

        return Number(String(selected.title).split("×")[1]?.trim() || cropSize.value.height);
    });

    const resizeSizeLabel = computed(() => {
        return `${resizeWidth.value || cropSize.value.width} × ${resizeHeight.value || cropSize.value.height}`;
    });

    const selectResizePreset = item => {
        modifier.resize.index = item.value;
        modifier.resize.isCustom = false;

        if (item.value === 0) {
            modifier.resize.width = cropSize.value.width;
            modifier.resize.height = cropSize.value.height;
            return;
        }

        const [width, height] = String(item.title)
            .split("×")
            .map(value => Number(value.trim()));

        modifier.resize.width = width || cropSize.value.width;
        modifier.resize.height = height || cropSize.value.height;
    };

    const setCustomResize = () => {
        modifier.resize.isCustom = true;
        modifier.resize.index = -1;

        if (!modifier.resize.width) {
            modifier.resize.width = cropSize.value.width;
        }

        if (!modifier.resize.height) {
            modifier.resize.height = cropSize.value.height;
        }
    };

    const updateResizeWidth = value => {
        const width = clamp(Math.round(value), 1, 99999);

        modifier.resize.isCustom = true;
        modifier.resize.index = -1;
        modifier.resize.width = width;

        if (modifier.resize.keepAspectRatio) {
            modifier.resize.height = clamp(
                Math.round(width / resizeAspectRatio.value),
                1,
                99999
            );
        }
    };

    const updateResizeHeight = value => {
        const height = clamp(Math.round(value), 1, 99999);

        modifier.resize.isCustom = true;
        modifier.resize.index = -1;
        modifier.resize.height = height;

        if (modifier.resize.keepAspectRatio) {
            modifier.resize.width = clamp(
                Math.round(height * resizeAspectRatio.value),
                1,
                99999
            );
        }
    };

    const toggleResizeAspectRatio = () => {
        modifier.resize.keepAspectRatio = !modifier.resize.keepAspectRatio;

        if (
            modifier.resize.keepAspectRatio &&
            modifier.resize.width &&
            modifier.resize.height
        ) {
            updateResizeWidth(modifier.resize.width);
        }
    };

    const goResizeStep = key => {
        modifier.ui.resizeStep = key;
    };

    const nextResizeStep = () => {
        const next = RESIZE_STEPS[resizeStepIndex.value + 1];

        if (next) {
            modifier.ui.resizeStep = next.key;
        }
    };

    const previousResizeStep = () => {
        const previous = RESIZE_STEPS[resizeStepIndex.value - 1];

        if (previous) {
            modifier.ui.resizeStep = previous.key;
        }
    };

    const selectPanel = key => {
        modifier.ui.activePanel = key;
    };

    const applySelectionCrop = () => {
        if (!hasSelectMask.value) {
            return;
        }

        const box = getSelectMaskLayerBox();

        if (!box) {
            return;
        }

        const left = clamp(Math.round(box.x), 0, imageWidth.value - 1);
        const top = clamp(Math.round(box.y), 0, imageHeight.value - 1);

        const rightEdge = clamp(
            Math.round(box.x + box.width),
            1,
            imageWidth.value
        );

        const bottomEdge = clamp(
            Math.round(box.y + box.height),
            1,
            imageHeight.value
        );

        if (rightEdge <= left || bottomEdge <= top) {
            return;
        }

        modifier.crop.left = left;
        modifier.crop.top = top;
        modifier.crop.right = Math.max(0, imageWidth.value - rightEdge);
        modifier.crop.bottom = Math.max(0, imageHeight.value - bottomEdge);
    };

    const hasResizeChange = computed(() => {
        return (
            modifier.resize.isCustom ||
            Number(modifier.resize.index) > 0 ||
            Number(resizeWidth.value) !== Number(cropSize.value.width) ||
            Number(resizeHeight.value) !== Number(cropSize.value.height)
        );
    });

    const resetCrop = () => {
        modifier.crop.left = 0;
        modifier.crop.top = 0;
        modifier.crop.right = 0;
        modifier.crop.bottom = 0;
    };

    const resetResize = () => {
        modifier.resize.index = 0;
        modifier.resize.width = cropSize.value.width;
        modifier.resize.height = cropSize.value.height;
        modifier.resize.keepAspectRatio = true;
        modifier.resize.isCustom = false;
        modifier.resize.mode = 0;
        modifier.resize.upscaleMethod = 1;
        modifier.ui.resizeStep = "dimensions";
    };

    const resetAll = () => {
        resetCrop();
        resetResize();
        modifier.cutout.enabled = canUseCutout.value;
    };

    const normalizeCrop = () => {
        const maxX = Math.max(0, imageWidth.value - 1);
        const maxY = Math.max(0, imageHeight.value - 1);

        modifier.crop.left = clamp(modifier.crop.left, 0, maxX);
        modifier.crop.right = clamp(modifier.crop.right, 0, maxX);
        modifier.crop.top = clamp(modifier.crop.top, 0, maxY);
        modifier.crop.bottom = clamp(modifier.crop.bottom, 0, maxY);

        if (modifier.crop.left + modifier.crop.right >= imageWidth.value) {
            modifier.crop.right = Math.max(0, imageWidth.value - modifier.crop.left - 1);
        }

        if (modifier.crop.top + modifier.crop.bottom >= imageHeight.value) {
           modifier.crop.bottom = Math.max(0, imageHeight.value - modifier.crop.top - 1);
        }
    };

    const initialize = async () => {
        resetCrop();

        modifier.resize.width = cropSize.value.width;
        modifier.resize.height = cropSize.value.height;
        modifier.cutout.enabled = canUseCutout.value;

        if (hasSelectMask.value) {
            applySelectionCrop();
            modifier.ui.activePanel = "crop";
            return;
        }

        if (hasLayerMask.value) {
            modifier.ui.activePanel = "cutout";
            return;
        }

        modifier.ui.activePanel = "resize";
    };

    const submit = async () => {
        if (!props.layer?.id || modifier.loading) {
            return;
        }

        normalizeCrop();

        const normalizedResize = {
            index: Number(modifier.resize.index || 0),
            width: Number(resizeWidth.value || cropSize.value.width || imageWidth.value || 1),
            height: Number(resizeHeight.value || cropSize.value.height || imageHeight.value || 1),
            keepAspectRatio: Boolean(modifier.resize.keepAspectRatio),
            isCustom: Boolean(modifier.resize.isCustom),
            mode: Number(modifier.resize.mode || 0),
            upscaleMethod: Number(modifier.resize.upscaleMethod || 1),
        };

        const hasResizeChange =
            normalizedResize.isCustom ||
            normalizedResize.index > 0 ||
            normalizedResize.width !== cropSize.value.width ||
            normalizedResize.height !== cropSize.value.height;

        if (!hasResizeChange) {
            normalizedResize.index = 0;
            normalizedResize.isCustom = false;
            normalizedResize.width = cropSize.value.width;
            normalizedResize.height = cropSize.value.height;
        }

        const normalizedCrop = {
            left: Number(modifier.crop.left || 0),
            top: Number(modifier.crop.top || 0),
            right: Number(modifier.crop.right || 0),
            bottom: Number(modifier.crop.bottom || 0),
        };

        const normalizedCutout =
            Boolean(modifier.cutout.enabled) &&
            canUseCutout.value;

        modifier.loading = true;

        try {
            emitEvent("modifier:image-applied", {
                layer: props.layer,
                crop: normalizedCrop,
                resize: normalizedResize,
                cutout: normalizedCutout,
                selectMask: props.selectMask,
                selectMaskShape: props.selectMaskShape,
            });
        } finally {
            modifier.loading = false;
        }
    };

    onMounted(async () => {
        await initialize();
    });

    onBeforeUnmount(async () => {
        await initialize();
    });

    return {
        config,
        modifier,
        selectionStyle,
        resizeSteps: RESIZE_STEPS,
        resizeStepIndex,
        resizeAspectRatio,
        resizeWidth,
        resizeHeight,
        resizeSizeLabel,

        selectResizePreset,
        setCustomResize,
        updateResizeWidth,
        updateResizeHeight,
        toggleResizeAspectRatio,
        goResizeStep,
        nextResizeStep,
        previousResizeStep,
        resizeOptions: RESIZE_OPTIONS,
        resizeModes: RESIZE_MODES,
        upscaleMethods: UPSCALE_METHODS,

        imageWidth,
        imageHeight,
        cropSize,
        outputSizeLabel,

        hasSelectMask,
        hasLayerMask,
        maskType,
        maskLabel,
        maskDescription,
        canUseCutout,

        operationSummary,
        panelItems,

        emitEvent,
        selectPanel,
        applySelectionCrop,
        resetCrop,
        resetResize,
        resetAll,
        submit
    };
}

export const modifierResizeProps = {
    state: {
        type: Boolean,
        required: true,
    },
    layer: {
        type: Object,
        required: true,
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
    }
};