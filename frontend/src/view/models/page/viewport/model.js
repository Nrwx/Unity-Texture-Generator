import { computed, ref } from "vue";
import {isFiniteNumber, number} from "@/utils/math";

export function viewportModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const config = ref({
        fullscreen: true,
        hideClose: true,
        emit: "viewport-state",
    });

    const presets = ref([
        {
            key: "mobile",
            label: "Mobile",
            icon: "mdi-cellphone",
            width: 375,
            height: 667,
            dpi: 72,
            unit: "px",
            mode: 0,
            projectType: "ui",
            orientation: "portrait",
            background: "#111827",
            grid: true,
            safeArea: true,
            lockRatio: true,
        },
        {
            key: "tablet",
            label: "Tablet",
            icon: "mdi-tablet",
            width: 768,
            height: 1024,
            dpi: 72,
            unit: "px",
            mode: 1,
            projectType: "ui",
            orientation: "portrait",
            background: "#111827",
            grid: true,
            safeArea: true,
            lockRatio: true,
        },
        {
            key: "desktop",
            label: "Desktop",
            icon: "mdi-monitor",
            width: 1920,
            height: 1080,
            dpi: 96,
            unit: "px",
            mode: 2,
            projectType: "document",
            orientation: "landscape",
            background: "#111827",
            grid: true,
            safeArea: false,
            lockRatio: false,
        },
        {
            key: "texture",
            label: "Texture 1K",
            icon: "mdi-image-multiple",
            width: 1024,
            height: 1024,
            dpi: 72,
            unit: "px",
            mode: 4,
            projectType: "texture",
            orientation: "square",
            background: "#0f172a",
            grid: true,
            safeArea: false,
            lockRatio: true,
        },
        {
            key: "texture4k",
            label: "Texture 4K",
            icon: "mdi-image-size-select-large",
            width: 4096,
            height: 4096,
            dpi: 72,
            unit: "px",
            mode: 4,
            projectType: "texture",
            orientation: "square",
            background: "#0f172a",
            grid: true,
            safeArea: false,
            lockRatio: true,
        },
        {
            key: "print",
            label: "Print A4",
            icon: "mdi-printer",
            width: 2480,
            height: 3508,
            dpi: 300,
            unit: "px",
            mode: 3,
            projectType: "document",
            orientation: "portrait",
            background: "#ffffff",
            grid: false,
            safeArea: false,
            lockRatio: true,
        },
    ]);

    const modes = ref([
        { value: "texture", label: "Texture" },
        { value: "document", label: "Document" },
        { value: "animation", label: "Animation" },
        { value: "ui", label: "UI / Design" },
    ]);

    const unitItems = ref(["px", "mm", "cm", "in"]);
    const orientationItems = ref(["portrait", "landscape"]);
    const modeItems = ref([
        { title: "Texture", value: "texture" },
        { title: "Document", value: "document" },
        { title: "Animation", value: "animation" },
        { title: "UI / Design", value: "ui" },
    ]);

    const toInt = (value) => {
        const n = Number.parseInt(value, 10);
        return isFiniteNumber(n) ? n : 0;
    };

    const applySetting = (key, value, eventName = `viewport:${key}`) => {
        if (!props.settings) return;
        props.settings[key] = value;
        emitEvent(eventName, value);
    };

    const applyOrientation = (orientation) => {
        const w = toInt(props.settings?.width);
        const h = toInt(props.settings?.height);

        let newWidth = w;
        let newHeight = h;

        if (orientation === "landscape" && h > w) {
            newWidth = h;
            newHeight = w;
        }

        if (orientation === "portrait" && w > h) {
            newWidth = h;
            newHeight = w;
        }

        applySetting("width", newWidth, "viewport:width");
        applySetting("height", newHeight, "viewport:height");
        applySetting("orientation", orientation, "viewport:orientation");
    };

    const selectPreset = (preset) => {
        if (!preset) return;

        applySetting("preset", preset.key, "viewport:preset");
        applySetting("mode", preset.mode, "viewport:mode");
        applySetting("title", preset.label, "viewport:title");
        applySetting("width", preset.width, "viewport:width");
        applySetting("height", preset.height, "viewport:height");
        applySetting("dpi", preset.dpi, "viewport:dpi");
        applySetting("unit", preset.unit, "viewport:unit");
        applySetting("projectType", preset.projectType, "viewport:project-type");
        applySetting("orientation", preset.orientation, "viewport:orientation");
        applySetting("background", preset.background, "viewport:background");
        applySetting("grid", preset.grid, "viewport:grid");
        applySetting("safeArea", preset.safeArea, "viewport:safe-area");
        applySetting("lockRatio", preset.lockRatio, "viewport:ratio-lock");

        emitEvent("viewport:preset", preset);
    };

    const resetViewport = () => {
        const fallback = presets.value.find((p) => p.key === "texture") || presets.value[0];
        selectPreset(fallback);
        emitEvent("viewport:reset", props.settings);
    };

    const submitViewport = () => {
        emitEvent("viewport:setup", { ...props.settings });
    };

    const selectedPresetLabel = computed(() => {
        const active = presets.value.find((p) => p.key === props.settings?.preset);
        return active ? active.label : "Custom";
    });

    const viewportSummary = computed(() => {
        const w = props.settings?.width ?? 0;
        const h = props.settings?.height ?? 0;
        return `${w} × ${h} · ${props.settings?.projectType ?? "texture"}`;
    });

    const aspectRatioLabel = computed(() => {
        const w = Math.max(1, number(props.settings?.width || 1));
        const h = Math.max(1, number(props.settings?.height || 1));
        const g = (a, b) => (b === 0 ? a : g(b, a % b));
        const d = g(w, h);
        return `${Math.round(w / d)}:${Math.round(h / d)}`;
    });

    const pixelCountLabel = computed(() => {
        const w = Math.max(0, number(props.settings?.width || 0));
        const h = Math.max(0, number(props.settings?.height || 0));
        const px = w * h;
        if (px >= 1_000_000) return `${(px / 1_000_000).toFixed(2)} MP`;
        if (px >= 1_000) return `${(px / 1_000).toFixed(1)} Kpx`;
        return `${px} px`;
    });

    const previewScaleLabel = computed(() => {
        const w = Math.max(1, number(props.settings?.width || 1));
        const h = Math.max(1, number(props.settings?.height || 1));
        const s = Math.min(1, 560 / Math.max(w, h));
        return `${Math.round(s * 100)}%`;
    });

    const previewStageStyle = computed(() => {
        const w = Math.max(1, number(props.settings?.width || 1));
        const h = Math.max(1, number(props.settings?.height || 1));
        const maxW = 560;
        const maxH = 420;
        const scale = Math.min(maxW / w, maxH / h, 1);

        return {
            width: `${Math.round(w * scale)}px`,
            height: `${Math.round(h * scale)}px`,
            maxWidth: "100%",
            maxHeight: "100%",
        };
    });

    return {
        config,
        presets,
        modes,
        unitItems,
        orientationItems,
        modeItems,
        toInt,
        emitEvent,
        applySetting,
        applyOrientation,
        selectPreset,
        resetViewport,
        submitViewport,
        selectedPresetLabel,
        viewportSummary,
        aspectRatioLabel,
        pixelCountLabel,
        previewScaleLabel,
        previewStageStyle,
    };
}

export const viewportProps = {
    state: {
        type: Boolean,
        default: false,
    },
    loading: {
        type: Boolean,
        default: false,
    },
    settings: {
        type: Object,
        required: true,
        default: () => ({}),
    },
    theme: {
        type: String,
        default: false,
    },
};