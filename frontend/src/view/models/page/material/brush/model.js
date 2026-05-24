import { computed } from "vue";
import { number } from "@/utils/math";
import {createDefaultSculptBrush, SCULPT_BRUSH_MODES} from "@/view/models/page/material/brush/mesh";

/**
 * Creates a fresh sculpt brush state using the project defaults.
 *
 * @returns {object} Default sculpt brush state.
 */
export const createSculptBrushState = () => createDefaultSculptBrush();

/**
 * Normalizes a sculpt brush state while preserving existing values.
 *
 * Missing nested objects are filled from the default brush state.
 * The tool value is normalized from `tool` or `mode` and falls back to `draw`.
 *
 * @param {object|null|undefined} source - Partial brush state.
 * @returns {object} Normalized brush state.
 */
export const normalizeSculptBrushState = (source) => {
    const defaults = createSculptBrushState();

    return {
        ...defaults,
        ...(source || {}),
        tool: source?.tool || source?.mode || defaults.tool || "draw",
        detail: {
            ...defaults.detail,
            ...(source?.detail || {}),
        },
        stamp: {
            ...(defaults.stamp || {}),
            ...(source?.stamp || {}),
        },
    };
};

/**
 * Composable model for editing sculpt brush settings.
 *
 * @param {object} props - Vue props object.
 * @param {Function} emit - Vue emit function.
 * @returns {{
 *   brush: import("vue").ComputedRef<object>,
 *   modes: import("vue").ComputedRef<Array<{key: string, label: string}>>,
 *   setField: (key: string, value: any) => void,
 *   toggleEnabled: () => void
 * }}
 */
export function brushEditorModel(props, emit) {
    const brush = computed(() => props.config || {});

    const modes = computed(() =>
        SCULPT_BRUSH_MODES.map((key) => ({
            key,
            label: key
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (char) => char.toUpperCase()),
        })),
    );

    const emitChange = () => {
        emit("update:component-event", "sculpt:brush", normalizeSculptBrushState(props.config));
    };

    const setField = (key, value) => {
        if (!props.config) {
            return;
        }

        if (["enabled", "dynamicTopology", "invert"].includes(key)) {
            props.config[key] = value === true;
            emitChange();
            return;
        }

        if (key === "mode" || key === "tool") {
            props.config.tool = value || "draw";
            emitChange();
            return;
        }

        if (key.startsWith("detail.")) {
            const detailKey = key.slice("detail.".length);
            const detailDefaults = props.config.detail || {};

            const nextValue = detailKey === "enabled"
                ? value === true
                : number(value, detailDefaults?.[detailKey] ?? 0);

            props.config.detail = {
                ...detailDefaults,
                [detailKey]: nextValue,
                ...(detailKey === "detailPercent" ? { percent: nextValue } : {}),
                ...(detailKey === "percent" ? { detailPercent: nextValue } : {}),
                ...(detailKey === "maxTriangles" ? { maxSubdivisionsPerStroke: nextValue } : {}),
                ...(detailKey === "maxSubdivisionsPerStroke" ? { maxTriangles: nextValue } : {}),
            };

            emitChange();
            return;
        }

        if (key.startsWith("stamp.")) {
            const stampKey = key.slice("stamp.".length);
            const stampDefaults = props.config.stamp || {};

            props.config.stamp = {
                ...stampDefaults,
                [stampKey]: typeof value === "number"
                    ? number(value, stampDefaults?.[stampKey] ?? 0)
                    : value,
            };

            emitChange();
            return;
        }

        props.config[key] = typeof value === "number"
            ? number(value, props.config[key] ?? 0)
            : value;

        emitChange();
    };

    const toggleEnabled = () => setField("enabled", !props.config?.enabled);

    return {
        brush,
        modes,
        setField,
        toggleEnabled,
    };
}

/**
 * Vue prop definition for brush editor components.
 */
export const brushEditorProps = {
    config: {
        type: Object,
        required: true,
    },
};