import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { eventRegister } from "@/dataLayer/event";
import {clamp, lerp} from "@/utils/tools";
import {applyEase, easeIn, easeInOut, easeOut, linear} from "@/utils/animation";

const DEFAULT_MATRIX = Object.freeze({
    a: 1, b: 0, c: 0, d: 1,
    x: 0, y: 0,
    rotate: 0
});

const normalizeMatrix = (m = {}) => ({
    a: Number.isFinite(m.a) ? m.a : 1,
    b: Number.isFinite(m.b) ? m.b : 0,
    c: Number.isFinite(m.c) ? m.c : 0,
    d: Number.isFinite(m.d) ? m.d : 1,
    x: Number.isFinite(m.x) ? m.x : 0,
    y: Number.isFinite(m.y) ? m.y : 0,
    rotate: Number.isFinite(m.rotate) ? m.rotate : 0
});

const applyEasing = (factor, easeType, bezier) => {
    const t = clamp(factor);
    if (easeType === "linear") return t;
    if (bezier?.cp1 && bezier?.cp2) return applyEase(t, [0, bezier.cp1, bezier.cp2, 1]);

    const easeFns = {
        linear,
        "ease-in": easeIn,
        "ease-out": easeOut,
        "ease-in-out": easeInOut
    };

    return clamp((easeFns[easeType] || easeFns.linear)(t));
};

export function imageModel(props, emit) {
    const containerRef = ref(null);
    const localTime = ref(Number.isFinite(props.timelineTime) ? props.timelineTime : 0);

    const emitSelectLayer = (payload, event) => {
        emit("update:select-layer", payload, event);
    };

    const emitEditTextLayer = (layer, event) => {
        event.preventDefault();
        event.stopPropagation();

        if (layer.type !== 1) return;

        emitEvent("edit-text-layer", layer);
        emitEvent("text-edit-state", true);
    };

    const emitEvent = (event, payload) => {
        emit("update:image-event", event, payload);
    };

    const { register } = eventRegister("listener:image", emitEvent);

    const getSortedKeyframes = (layer) => {
        const frames = Array.isArray(layer?.keyframes) ? layer.keyframes : [];
        return frames.slice().sort((a, b) => a.time - b.time);
    };

    const interpolateLayerAtTime = (layer, time) => {
        const frames = getSortedKeyframes(layer);
        if (!frames.length) {
            return {
                opacity: layer.opacity ?? 1,
                matrix: normalizeMatrix(layer.matrix ?? DEFAULT_MATRIX),
            };
        }

        if (frames.length === 1) {
            const only = frames[0];
            return {
                opacity: only.opacity ?? layer.opacity ?? 1,
                matrix: normalizeMatrix(only.matrix ?? layer.matrix ?? DEFAULT_MATRIX),
            };
        }

        if (time <= frames[0].time) {
            return {
                opacity: frames[0].opacity ?? layer.opacity ?? 1,
                matrix: normalizeMatrix(frames[0].matrix ?? layer.matrix ?? DEFAULT_MATRIX),
            };
        }

        const last = frames[frames.length - 1];
        if (time >= last.time) {
            return {
                opacity: last.opacity ?? layer.opacity ?? 1,
                matrix: normalizeMatrix(last.matrix ?? layer.matrix ?? DEFAULT_MATRIX),
            };
        }

        let left = frames[0];
        let right = frames[1];

        for (let i = 0; i < frames.length - 1; i++) {
            const a = frames[i];
            const b = frames[i + 1];
            if (time >= a.time && time <= b.time) {
                left = a;
                right = b;
                break;
            }
        }

        const dt = right.time - left.time;
        if (dt === 0) {
            return {
                opacity: left.opacity ?? layer.opacity ?? 1,
                matrix: normalizeMatrix(left.matrix ?? layer.matrix ?? DEFAULT_MATRIX),
            };
        }

        let factor = (time - left.time) / dt;
        factor = applyEasing(factor, left.ease || "linear", left.bezier);

        const startOpacity = left.opacity ?? layer.opacity ?? 1;
        const endOpacity = right.opacity ?? startOpacity;

        const startMatrix = normalizeMatrix(left.matrix ?? layer.matrix ?? DEFAULT_MATRIX);
        const endMatrix = normalizeMatrix(right.matrix ?? startMatrix);

        return {
            opacity: lerp(startOpacity, endOpacity, factor),
            matrix: {
                a: lerp(startMatrix.a, endMatrix.a, factor),
                b: lerp(startMatrix.b, endMatrix.b, factor),
                c: lerp(startMatrix.c, endMatrix.c, factor),
                d: lerp(startMatrix.d, endMatrix.d, factor),
                x: lerp(startMatrix.x, endMatrix.x, factor),
                y: lerp(startMatrix.y, endMatrix.y, factor),
                rotate: lerp(startMatrix.rotate, endMatrix.rotate, factor),
            },
        };
    };

    const liveLayerById = computed(() => {
        const map = {};
        const t = (props.timeline || props.miniTimeline || props.timelinePlay) ? localTime.value : null;

        for (const layer of props.layers || []) {
            if (t === null || !Array.isArray(layer.keyframes) || layer.keyframes.length === 0) {
                map[layer.id] = layer;
                continue;
            }

            const state = interpolateLayerAtTime(layer, t);
            map[layer.id] = {
                ...layer,
                opacity: state.opacity ?? layer.opacity ?? 1,
                matrix: state.matrix ?? normalizeMatrix(layer.matrix ?? DEFAULT_MATRIX),
            };
        }

        return map;
    });

    const getLiveLayer = (layer) => liveLayerById.value[layer.id] || layer;

    const getVectorStyle = (layer) => {
        const live = getLiveLayer(layer);
        const matrix = normalizeMatrix(live.matrix ?? DEFAULT_MATRIX);

        return {
            width: `${layer.width}px`,
            height: `${layer.height}px`,
            pointerEvents: 'auto',

            opacity: live.opacity ?? 1,
            zIndex: layer.zIndex ?? 0,
            position: "absolute",
            transform: `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.x}, ${matrix.y}) rotate(${matrix.rotate}deg)`,
        };
    };

    const getLayerStyle = (layer) => {
        const live = getLiveLayer(layer);
        const matrix = normalizeMatrix(live.matrix ?? DEFAULT_MATRIX);

        return {
            opacity: live.opacity ?? 1,
            zIndex: layer.zIndex ?? 0,
            position: "absolute",
            transform: `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.x}, ${matrix.y}) rotate(${matrix.rotate}deg)`,
        };
    };

    const getTextLayerStyle = (layer) => {
        const live = getLiveLayer(layer);
        const matrix = normalizeMatrix(live.matrix ?? DEFAULT_MATRIX);

        return {
            width: `${layer.width}px`,
            height: `${layer.height}px`,
            color: layer.color,
            fontFamily: layer.fontFamily,
            fontSize: `${layer.fontSize}px`,
            fontWeight: layer.fontWeight,
            letterSpacing: `${layer.letterSpacing}px`,
            lineHeight: layer.lineHeight,
            textAlign: layer.textAlign,
            textTransform: layer.textTransform,
            textDecoration: layer.textDecoration,
            opacity: live.opacity ?? 1,
            whiteSpace: "pre-wrap",
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: layer.zIndex ?? 0,
            transform: `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.x}, ${matrix.y}) rotate(${matrix.rotate}deg)`,
        };
    };

    const handleClick = async (event) => {
        if (!props.fillState) {
            return console.log("Fill-event not aktiv");
        }

        const target = event.target.closest("[data-context-id]");
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const x = Math.round(event.clientX - rect.left);
        const y = Math.round(event.clientY - rect.top);

        const id = target.getAttribute("data-context-id");
        if (!id) throw new Error("Layer-ID nicht gefunden (data-context-id fehlt)");

        emitEvent("fill-color-modifier", { id, x, y, color: props.color });
    };

    watch(
        () => props.timelineTime,
        (value) => {
            if (Number.isFinite(value)) localTime.value = value;
        },
        { immediate: true }
    );

    onMounted(async () => {
        await nextTick();

        containerRef.value = document.getElementById("containerRef");
        if (containerRef.value) {
            register("add", containerRef.value, "click", handleClick);
        }

        // Falls dein Event-System die Timeline-Zeit als Event durchreicht,
        // kannst du hier zusätzlich localTime synchronisieren.
        // register("add", window, "timeline:time", (e) => { ... })
    });

    onBeforeUnmount(() => {
        register("removeAll");
    });

    return {
        containerRef,
        emitSelectLayer,
        emitEditTextLayer,
        getLiveLayer,
        getLayerStyle,
        getTextLayerStyle,
        getVectorStyle
    };
}

export const imageProps = {
    layers: {
        type: Array,
        required: true,
    },
    selectedLayer: {
        type: Array,
        required: true,
    },
    fillState: {
        type: Boolean,
        required: true,
    },
    timeline: {
        type: Boolean,
        required: true,
    },
    miniTimeline: {
        type: Boolean,
        required: true,
    },
    timelinePlay: {
        type: Boolean,
        required: true,
    },
    timelineTime: {
        type: Number,
        required: false,
        default: 0,
    },
    color: {
        type: String,
        required: true,
    }
};