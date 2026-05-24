import { computed } from "vue";

import { clone } from "@/utils/tools";

const DEFAULT_MATRIX = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    x: 0,
    y: 0,
    rotate: 0,
};

const toNumber = (value, fallback = 0) => {
    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
};

const normalizeMatrix = matrix => ({
    ...DEFAULT_MATRIX,
    ...(matrix || {}),
    a: toNumber(matrix?.a, DEFAULT_MATRIX.a),
    b: toNumber(matrix?.b, DEFAULT_MATRIX.b),
    c: toNumber(matrix?.c, DEFAULT_MATRIX.c),
    d: toNumber(matrix?.d, DEFAULT_MATRIX.d),
    x: toNumber(matrix?.x, DEFAULT_MATRIX.x),
    y: toNumber(matrix?.y, DEFAULT_MATRIX.y),
    rotate: toNumber(matrix?.rotate, DEFAULT_MATRIX.rotate),
});

export function transformationModel(props, emit) {
    const selectedLayers = computed(() => (
        props.selectedLayers || []
    ));

    const activeLayer = computed(() => (
        selectedLayers.value[selectedLayers.value.length - 1] || null
    ));

    const activeLayerTypeLabel = computed(() => {
        if (!activeLayer.value) {
            return "Layer Matrix";
        }

        return Number(activeLayer.value.type) === 5
            ? "3D Layer Matrix"
            : "2D Layer Matrix";
    });

    const activeMatrix = computed(() => normalizeMatrix(activeLayer.value?.matrix));

    const emitLayerUpdate = layer => {
        const payload = clone(layer, "json");

        emit("component-event", "update-layer", payload);
    };

    const setMatrixField = (key, value) => {
        const layer = activeLayer.value;

        if (!layer) {
            return;
        }

        layer.matrix = {
            ...normalizeMatrix(layer.matrix),
            [key]: toNumber(value, DEFAULT_MATRIX[key] ?? 0),
        };

        emitLayerUpdate(layer);
    };

    const resetMatrix = () => {
        const layer = activeLayer.value;

        if (!layer) {
            return;
        }

        layer.matrix = {
            ...DEFAULT_MATRIX,
        };

        emitLayerUpdate(layer);
    };

    return {
        compact: props.compact,

        activeLayer,
        activeLayerTypeLabel,
        activeMatrix,

        matrixFields: [
            { key: "a", label: "A", step: 0.01 },
            { key: "b", label: "B", step: 0.01 },
            { key: "c", label: "C", step: 0.01 },
            { key: "d", label: "D", step: 0.01 },
            { key: "x", label: "X", step: 1 },
            { key: "y", label: "Y", step: 1 },
            { key: "rotate", label: "Rot", step: 0.1 },
        ],

        setMatrixField,
        resetMatrix,
    };
}

export const transformationProps = {
    layers: {
        type: Array,
        required: false,
        default: () => [],
    },

    selectedLayers: {
        type: Array,
        required: false,
        default: () => [],
    },

    compact: {
        type: Boolean,
        required: false,
        default: false,
    },
};
