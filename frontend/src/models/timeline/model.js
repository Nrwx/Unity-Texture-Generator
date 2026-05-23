import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { eventRegister } from "@/dataLayer/event";
import { uuid } from "@/utils/uuid";
import { clamp, clampBetween, clone, getElById, lerp, normalize } from "@/utils/tools";
import { lighten } from "@/utils/color";
import { cubicBezier, easeIn, easeInOut, easeOut, linear, normalizeTime} from "@/utils/animation";

export function timelineModel(props, emit) {
    const wrapper = ref(null);
    const timeline = ref(null);
    const scrollbars = ref([uuid()]);
    const dragging = ref(null);
    const selectedId = ref(null);
    const pointerId = ref(null);
    const rafId = ref(null);

    const playStartTimestamp = ref(0);
    const playOffset = ref(0);

    const draggedControlPoint = ref(null);
    const cpPointerId = ref(null);

    const draggingPlayhead = ref(false);
    const playheadPointerId = ref(null);

    const width = computed(() => props.config.width);

    const ease = {
        linear,
        "ease-in": easeIn,
        "ease-out": easeOut,
        "ease-in-out": easeInOut
    };

    const presets = {
        linear: { cp1: { t: 0.33, v: 0.33 }, cp2: { t: 0.66, v: 0.66 } },
        "ease-in": { cp1: { t: 0.42, v: 0 }, cp2: { t: 1.0, v: 1.0 } },
        "ease-out": { cp1: { t: 0, v: 0 }, cp2: { t: 0.58, v: 1.0 } },
        "ease-in-out": { cp1: { t: 0.42, v: 0 }, cp2: { t: 0.58, v: 1.0 } },
    };

    const easeModes = [
        { title: "Linear", value: "linear" },
        { title: "Ease In", value: "ease-in" },
        { title: "Ease Out", value: "ease-out" },
        { title: "Ease In-Out", value: "ease-in-out" },
    ];

    const curveVisibility = ref({
        transform: false,
        rotate: false,
        scale: false,
        value: false,
        speed: false,
        acceleration: false,
        label: false,
    });

    const openLayers = ref({});
    const trackHeight = 36;
    const trackPalette = [
        "#ff6b6b", "#f5a623", "#f8e71c", "#8bffc6",
        "#6bafff", "#d07bff", "#4de0b8", "#ff7ac4",
    ];

    const TRACK_TYPES = ["transform", "rotate", "scale"];
    const TRACK_LABELS = {
        transform: "Transform",
        rotate: "Rotate",
        scale: "Scale",
    };

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const { register } = eventRegister("listener:timeline", emitEvent);

    // -------------------------
    // Core helpers
    // -------------------------

    const _ensureLayerKeyframes = (layerObj) => {
        if (!Array.isArray(layerObj.keyframes)) {
            layerObj.keyframes = [];
        }
    };

    const _timeToPosition = (time) => {
        const range = props.config.endTime - props.config.startTime;
        const t = range >= 0 ? (time - props.config.startTime) : (props.config.startTime - time);
        return t * props.config.zoomLevel.current + props.config.padding;
    };

    const _positionToTime = (position) => {
        const range = props.config.endTime - props.config.startTime;
        const offset = (position - props.config.padding) / props.config.zoomLevel.current;
        return range >= 0 ? props.config.startTime + offset : props.config.startTime - offset;
    };

    const _applyBezierEasing = (factor, cp1, cp2) => {
        return cubicBezier(factor, 0, cp1.value, cp2.value, 1);
    };

    const _applyEasing = (factor, easeType, bezier) => {
        if (easeType === "linear") return factor;
        if (bezier?.cp1 && bezier?.cp2) return _applyBezierEasing(factor, bezier.cp1, bezier.cp2);
        const easeFn = ease[easeType] || ease.linear;
        return easeFn(factor);
    };

    const trackColor = (layerId) => {
        let hash = 0;
        for (let i = 0; i < layerId.length; i++) hash = (hash << 5) - hash + layerId.charCodeAt(i);
        return trackPalette[Math.abs(hash) % trackPalette.length];
    };

    const trackTop = () => props.config?.height * 0.32;

    const getCurveBaseY = (trackIndex) => trackTop(trackIndex) + trackHeight * 0.75;

    const getCurveHeight = () => Math.min(props.config.height * 0.25, trackHeight * 1.5);

    const getGraphHeight = () => trackHeight * 0.7;

    const getTrackValueFromMatrix = (matrix, trackType) => {
        const m = matrix ?? {};
        if (trackType === "transform") return m.x ?? 0;
        if (trackType === "rotate") return m.rotate ?? 0;
        if (trackType === "scale") return m.a ?? 1;
        return 0;
    };

    const keyframeHasOffset = (kf) => {
        if (!kf?.matrix) return false;
        const m = kf.matrix;
        return (
            (m.x ?? 0) !== 0 ||
            (m.y ?? 0) !== 0 ||
            (m.rotate ?? 0) !== 0 ||
            (m.a ?? 1) !== 1 ||
            (m.d ?? 1) !== 1
        );
    };

    const hasOffset = keyframeHasOffset;

    const trackHasOffsetByType = (layer, type) => {
        return (layer?.keyframes ?? []).some(kf => {
            const m = kf.matrix ?? {};
            if (type === "transform") return (m.x ?? 0) !== 0 || (m.y ?? 0) !== 0;
            if (type === "rotate") return (m.rotate ?? 0) !== 0;
            if (type === "scale") return (m.a ?? 1) !== 1 || (m.d ?? 1) !== 1;
            return false;
        });
    };

    const cloneKeyframe = (k, layerId) => ({
        id: k.id,
        time: k.time,
        ease: k.ease,
        bezier: clone(k.bezier),
        left: _timeToPosition(k.time),
        layerId,
        _orig: k,
    });

    const cloneLayerKeyframes = (layerObj, withMatrix = false) => {
        _ensureLayerKeyframes(layerObj);

        const frames = layerObj.keyframes
            .slice()
            .sort((a, b) => a.time - b.time)
            .map(k => ({
                ...cloneKeyframe(k, layerObj.id),
                ...(withMatrix ? { matrix: clone(k.matrix ?? {}) } : {}),
            }));

        for (let i = 0; i < frames.length - 1; i++) {
            frames[i]._next = frames[i + 1];
        }

        return frames;
    };

    const selectedKeys = computed(() => props.config.selectedKeyframes || []);

    const layersWithKeys = computed(() => {
        return props.layers.filter(l => Array.isArray(l.keyframes) && l.keyframes.length > 0);
    });

    const toggleLayerOpen = (id) => {
        openLayers.value[id] = !openLayers.value[id];
    };

    const isLayerOpen = (id) => !!openLayers.value[id];

    const playHead = computed(() => _timeToPosition(props.config.time));

    // -------------------------
    // Keyframes / ticks / segments
    // -------------------------
    const keyframes = computed(() => {
        const frames = [];

        props.selectedLayer.forEach(layerObj => {
            const copies = cloneLayerKeyframes(layerObj, false);
            frames.push(...copies);
        });

        frames.sort((a, b) => a.time - b.time);
        return frames;
    });

    const ticks = computed(() => {
        const candidates = props.config.ticks.candidates;
        const zoom = props.config.zoomLevel.current;

        const targetPx = Math.max(8, 25 / zoom);

        let chosen = 1;
        for (const c of candidates) {
            if (c * props.config.zoomLevel.current >= targetPx) {
                chosen = c;
                break;
            }
        }
        if (chosen === 1 && candidates[candidates.length - 1] * props.config.zoomLevel.current < targetPx) {
            chosen = candidates[candidates.length - 1];
        }

        const ticksArr = [];
        const scrollLeft = wrapper.value ? wrapper.value.scrollLeft : 0;
        const visibleWidth = props.config.width;

        const startTime = _positionToTime(scrollLeft);
        const endTime = _positionToTime(scrollLeft + visibleWidth);

        const minTime = Math.min(props.config.startTime, props.config.endTime);
        const maxTime = Math.max(props.config.startTime, props.config.endTime);

        const tickStart = Math.floor(Math.max(minTime, startTime) / chosen) * chosen;
        const tickEnd = Math.ceil(Math.min(maxTime, endTime) / chosen) * chosen;

        const majorInterval =
            chosen >= 100 ? 1 :
                chosen >= 10 ? 2 :
                    chosen >= 1 ? 5 : 10;

        for (let t = tickStart; t <= tickEnd; t += chosen) {
            ticksArr.push({
                time: t,
                left: _timeToPosition(t),
                major: (Math.round(t / chosen) % majorInterval) === 0,
            });
        }

        return ticksArr;
    });

    const segments = computed(() => {
        const arr = keyframes.value;
        if (!arr?.length) return [];

        const items = [];
        for (let i = 0; i < arr.length - 1; i++) {
            items.push({
                left: arr[i].left,
                width: Math.max(2, arr[i + 1].left - arr[i].left),
                color: i % 2 === 0 ? "#9153a1" : "#2b8cff",
            });
        }

        const lastKf = arr[arr.length - 1];
        const timelineEnd = props.config.width;
        const tailWidth = Math.max(2, timelineEnd - lastKf.left);
        if (tailWidth > 2) {
            items.push({
                left: lastKf.left,
                width: tailWidth,
                color: arr.length % 2 === 0 ? "#9153a1" : "#2b8cff",
            });
        }

        return items;
    });

    const trackRows = computed(() => {
        return props.selectedLayer.map((layer, i) => {
            const keyframesForLayer = cloneLayerKeyframes(layer, true);

            const subTracks = TRACK_TYPES.map(type => ({
                trackId: type,
                label: TRACK_LABELS[type],
                hasOffset: trackHasOffsetByType(layer, type),
                keyframes: keyframesForLayer.map(k => ({ id: k.id, left: k.left, time: k.time })),
            }));

            const color = trackColor(layer.id);

            return {
                layer,
                keyframes: keyframesForLayer,
                color,
                bg: color,
                index: i,
                subTracks,
                visibleSubTracks: subTracks.filter(st => st.hasOffset),
            };
        });
    });

    // -------------------------
    // Curves / Bezier helpers
    // -------------------------
    const initializeBezierForKeyframe = (kf, nextKf) => {
        if (!kf || !nextKf) return;

        const dt = nextKf.time - kf.time;
        if (dt === 0) return;

        const easeType = kf.ease || "linear";
        const preset = clone(presets[easeType] || presets.linear);

        if (Math.sign(dt) < 0) {
            const cp1t = preset.cp1.t;
            const cp2t = preset.cp2.t;
            preset.cp1.t = 1 - cp2t;
            preset.cp2.t = 1 - cp1t;
        }

        let cp1Time = kf.time + dt * preset.cp1.t;
        let cp2Time = kf.time + dt * preset.cp2.t;

        const minT = Math.min(kf.time, nextKf.time);
        const maxT = Math.max(kf.time, nextKf.time);
        cp1Time = clampBetween(cp1Time, minT, maxT);
        cp2Time = clampBetween(cp2Time, minT, maxT);

        kf.bezier = {
            cp1: { time: cp1Time, value: preset.cp1.v },
            cp2: { time: cp2Time, value: preset.cp2.v },
            _relativePos: {
                cp1: { t: preset.cp1.t, v: preset.cp1.v },
                cp2: { t: preset.cp2.t, v: preset.cp2.v },
            },
        };
    };

    const updateBezierAfterKeyframeMove = (kf, nextKf) => {
        if (!kf || !nextKf || !kf.bezier) return;

        const dt = nextKf.time - kf.time;
        if (dt === 0) return;

        const rel = kf.bezier._relativePos;
        if (!rel) return;

        let cp1Time = kf.time + dt * rel.cp1.t;
        let cp2Time = kf.time + dt * rel.cp2.t;

        const minT = Math.min(kf.time, nextKf.time);
        const maxT = Math.max(kf.time, nextKf.time);
        cp1Time = clampBetween(cp1Time, minT, maxT);
        cp2Time = clampBetween(cp2Time, minT, maxT);

        kf.bezier.cp1.time = cp1Time;
        kf.bezier.cp2.time = cp2Time;
        kf.bezier.cp1.value = rel.cp1.v;
        kf.bezier.cp2.value = rel.cp2.v;
    };

    const bezierToSVGCoords = (cp, trackIndex = null) => {
        if (!cp) return { x: 0, y: 0 };
        const curveHeight = getCurveHeight();
        const baseY = trackIndex !== null ? getCurveBaseY(trackIndex) : props.config.height * 0.75;
        return {
            x: _timeToPosition(cp.time),
            y: baseY - (cp.value * curveHeight),
        };
    };

    const getCurvePath = (curve, trackIndex = null) => {
        const startX = curve.start.left;
        const endX = curve.end.left;
        const curveHeight = getCurveHeight();
        const baseY = trackIndex !== null ? getCurveBaseY(trackIndex) : props.config.height * 0.75;

        if (curve.isLinear || !curve.cp1 || !curve.cp2) {
            return `M ${startX} ${baseY} L ${endX} ${baseY - curveHeight}`;
        }

        const cp1 = bezierToSVGCoords(curve.cp1, trackIndex);
        const cp2 = bezierToSVGCoords(curve.cp2, trackIndex);
        return `M ${startX} ${baseY} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${endX} ${baseY - curveHeight}`;
    };

    const buildCurvesForLayer = (layer, includeBezierSync = false) => {
        _ensureLayerKeyframes(layer);

        const frames = layer.keyframes
            .slice()
            .sort((a, b) => a.time - b.time)
            .map(k => ({
                id: k.id,
                time: k.time,
                ease: k.ease,
                bezier: k.bezier ? clone(k.bezier) : null,
                left: _timeToPosition(k.time),
                _orig: k,
            }));

        const curves = [];

        TRACK_TYPES.forEach(subType => {
            if (!trackHasOffsetByType(layer, subType)) return;

            for (let i = 0; i < frames.length - 1; i++) {
                const kf = frames[i];
                const nextKf = frames[i + 1];
                const isLinear = kf.ease === "linear";

                if (!isLinear && includeBezierSync) {
                    if (!kf.bezier || !kf.bezier.cp1 || !kf.bezier.cp2) {
                        initializeBezierForKeyframe(kf, nextKf);
                    } else if (!kf.bezier._relativePos) {
                        const dt = nextKf.time - kf.time || 1;
                        kf.bezier._relativePos = {
                            cp1: { t: (kf.bezier.cp1.time - kf.time) / dt, v: kf.bezier.cp1.value },
                            cp2: { t: (kf.bezier.cp2.time - kf.time) / dt, v: kf.bezier.cp2.value },
                        };
                    } else {
                        updateBezierAfterKeyframeMove(kf, nextKf);
                    }
                }

                curves.push({
                    id: `curve-${layer.id}-${subType}-${kf.id}-${nextKf.id}`,
                    start: kf,
                    end: nextKf,
                    subType,
                    isSelected: selectedKeys.value.includes(kf.id) || selectedKeys.value.includes(nextKf.id),
                    isLinear,
                    showCp1: !isLinear,
                    showCp2: !isLinear,
                    cp1: (!isLinear && kf.bezier?.cp1) ? kf.bezier.cp1 : null,
                    cp2: (!isLinear && kf.bezier?.cp2) ? kf.bezier.cp2 : null,
                });
            }
        });

        return curves;
    };

    const layerCurveSegments = computed(() => {
        const map = {};
        props.selectedLayer.forEach(layer => {
            map[layer.id] = buildCurvesForLayer(layer, true);
        });
        return map;
    });

    const curveSegments = computed(() => {
        const curves = [];
        const arr = keyframes.value;

        for (let i = 0; i < arr.length - 1; i++) {
            const kf = arr[i];
            const nextKf = arr[i + 1];
            const isLinear = kf.ease === "linear";

            const layer = getElById(props.selectedLayer, kf.layerId);
            if (!layer) continue;

            const originalKf = layer.keyframes.find(k => k.id === kf.id);
            if (!originalKf) continue;

            if (!isLinear) {
                if (!originalKf.bezier || !originalKf.bezier.cp1 || !originalKf.bezier.cp2) {
                    initializeBezierForKeyframe(originalKf, nextKf);
                } else if (!originalKf.bezier._relativePos) {
                    const dt = nextKf.time - originalKf.time || 1;
                    originalKf.bezier._relativePos = {
                        cp1: { t: (originalKf.bezier.cp1.time - originalKf.time) / dt, v: originalKf.bezier.cp1.value },
                        cp2: { t: (originalKf.bezier.cp2.time - originalKf.time) / dt, v: originalKf.bezier.cp2.value },
                    };
                } else {
                    updateBezierAfterKeyframeMove(originalKf, nextKf);
                }

                kf.bezier = originalKf.bezier;
            }

            const isSelected = selectedKeys.value.includes(kf.id) || selectedKeys.value.includes(nextKf.id);

            curves.push({
                id: `curve-${kf.layerId}-${kf.id}-${nextKf.id}`,
                start: kf,
                end: nextKf,
                isSelected,
                isLinear,
                showCp1: !isLinear,
                showCp2: !isLinear,
                cp1: (!isLinear && kf.bezier?.cp1) ? kf.bezier.cp1 : null,
                cp2: (!isLinear && kf.bezier?.cp2) ? kf.bezier.cp2 : null,
            });
        }

        return curves;
    });

    // -------------------------
    // Graph sampling helpers
    // -------------------------
    const sampleCurveMetric = (curve, layer, trackType, steps, readFn, outKey) => {
        const samples = [];
        let min = Infinity;
        let max = -Infinity;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const value = readFn(i, t);
            min = Math.min(min, value);
            max = Math.max(max, value);
            samples.push({ t, [outKey]: value });
        }

        return { samples, min, max };
    };

    const sampleCurveValues = (curve, layer, trackType, steps = 60) => {
        return sampleCurveMetric(
            curve,
            layer,
            trackType,
            steps,
            (_, t) => {
                const time = curve.start.time + t * (curve.end.time - curve.start.time);
                const state = interpolateLayerAtTime(layer, time);
                return getTrackValueFromMatrix(state.matrix, trackType);
            },
            "value"
        );
    };

    const sampleCurveSpeed = (curve, layer, trackType, steps = 60) => {
        return sampleCurveMetric(
            curve,
            layer,
            trackType,
            steps,
            (i) => {
                const tPrev = Math.max(0, (i - 1) / steps);
                const tNext = Math.min(1, (i + 1) / steps);

                const timePrev = curve.start.time + tPrev * (curve.end.time - curve.start.time);
                const timeNext = curve.start.time + tNext * (curve.end.time - curve.start.time);

                const vPrev = getTrackValueFromMatrix(interpolateLayerAtTime(layer, timePrev).matrix, trackType);
                const vNext = getTrackValueFromMatrix(interpolateLayerAtTime(layer, timeNext).matrix, trackType);

                const dt = timeNext - timePrev || 1;
                return (vNext - vPrev) / dt;
            },
            "speed"
        );
    };

    const sampleCurveAcceleration = (curve, layer, trackType, steps = 60) => {
        const samples = [];
        let min = Infinity;
        let max = -Infinity;

        // 1. Alle Zeiten vorbereiten
        const times = [];
        for (let i = 0; i <= steps; i++) {
            times.push(curve.start.time + (i / steps) * (curve.end.time - curve.start.time));
        }

        // 2. Alle Werte einmal interpolieren
        const values = times.map(t => getTrackValueFromMatrix(interpolateLayerAtTime(layer, t).matrix, trackType));

        // 3. Finite-Differenzen (Zentraldifferenzen) für Beschleunigung
        for (let i = 0; i <= steps; i++) {
            const tPrev = i > 0 ? times[i - 1] : times[i];
            const tNext = i < steps ? times[i + 1] : times[i];
            const dt = tNext - tPrev || 1;

            const vPrev = i > 0 ? values[i - 1] : values[i];
            const vMid = values[i];
            const vNext = i < steps ? values[i + 1] : values[i];

            const acc = (vNext - 2 * vMid + vPrev) / (dt * dt);

            min = Math.min(min, acc);
            max = Math.max(max, acc);

            samples.push({ t: i / steps, acc });
        }

        return { samples, min, max };
    };

    const buildGraphPath = (curve, layer, trackType, trackIndex, sampler, valueKey) => {
        if (!layer || typeof layer !== "object") return "";

        const { samples, min, max } = sampler(curve, layer, trackType);
        const baseY = getCurveBaseY(trackIndex);
        const height = getGraphHeight();

        const points = samples.map((sample) => {
            const v = sample[valueKey];
            const norm = normalize(v, min, max);
            const x = curve.start.left + sample.t * (curve.end.left - curve.start.left);
            const y = baseY - norm * height;
            return `${x} ${y}`;
        });

        return `M ${points.join(" L ")}`;
    };

    const buildGraphLabels = (curve, layer, trackType, trackIndex, sampler, valueKey) => {
        const { samples, min, max } = sampler(curve, layer, trackType);
        const labels = [];
        const baseY = getCurveBaseY(trackIndex);
        const height = getGraphHeight();

        const curvePixelWidth = curve.end.left - curve.start.left;
        const desiredPixelStep = clamp(50 / props.config.zoomLevel.current, 80, 160);
        const stepCount = Math.max(1, Math.floor(samples.length * desiredPixelStep / curvePixelWidth));

        for (let i = 0; i < samples.length; i += stepCount) {
            const sample = samples[i];
            const v = sample[valueKey];
            const x = curve.start.left + sample.t * (curve.end.left - curve.start.left);
            const y = baseY - normalize(v, min, max) * height;

            labels.push({
                x,
                y,
                val: v.toFixed(2),
            });
        }

        return labels;
    };

    const getCurveValuePath = (curve, layer, trackType, trackIndex) =>
        buildGraphPath(curve, layer, trackType, trackIndex, sampleCurveValues, "value");

    const getCurveSpeedPath = (curve, layer, trackType, trackIndex = null) =>
        buildGraphPath(curve, layer, trackType, trackIndex, sampleCurveSpeed, "speed");

    const getCurveAccelerationPath = (curve, layer, trackType, trackIndex = null) =>
        buildGraphPath(curve, layer, trackType, trackIndex, sampleCurveAcceleration, "acc");

    const getCurveValueLabels = (curve, layer, trackType, trackIndex = null) =>
        buildGraphLabels(curve, layer, trackType, trackIndex, sampleCurveValues, "value");

    const getCurveSpeedLabels = (curve, layer, trackType, trackIndex = null) =>
        buildGraphLabels(curve, layer, trackType, trackIndex, sampleCurveSpeed, "speed");

    const getCurveAccelerationLabels = (curve, layer, trackType, trackIndex = null) =>
        buildGraphLabels(curve, layer, trackType, trackIndex, sampleCurveAcceleration, "acc");

    const getZeroLineY = (curve, layer, trackType, trackIndex) => {
        const { min, max } = sampleCurveAcceleration(curve, layer, trackType);
        const baseY = getCurveBaseY(trackIndex);
        return baseY - normalize(0, min, max) * getGraphHeight();
    };

    // -------------------------
    // Interpolation
    // -------------------------
    const interpolateLayerAtTime = (layerObj, t) => {
        _ensureLayerKeyframes(layerObj);

        const frames = layerObj.keyframes.sort((a, b) => a.time - b.time);
        if (frames.length === 0) return {};

        let left = frames[0];
        let right = frames[frames.length - 1];

        for (let i = 0; i < frames.length - 1; i++) {
            if (t >= frames[i].time && t <= frames[i + 1].time) {
                left = frames[i];
                right = frames[i + 1];
                break;
            }
        }

        if (t === left.time) return { opacity: left.opacity, matrix: left.matrix };

        const dt = right.time - left.time;
        if (dt === 0) return { opacity: left.opacity, matrix: left.matrix };

        let factor = (t - left.time) / dt;
        factor = _applyEasing(factor, left.ease || "linear", left.bezier);

        const current = {};
        const start = { opacity: left.opacity, matrix: left.matrix };
        const end = { opacity: right.opacity, matrix: right.matrix };

        if (typeof start.opacity === "number" && typeof end.opacity === "number") {
            current.opacity = start.opacity + (end.opacity - start.opacity) * factor;
        } else {
            current.opacity = start.opacity ?? end.opacity;
        }

        if (start.matrix || end.matrix) {
            const sa = start.matrix ?? {};
            const ea = end.matrix ?? {};

            current.matrix = {
                a: lerp(sa.a ?? 1, ea.a ?? 1, factor),
                b: lerp(sa.b ?? 0, ea.b ?? 0, factor),
                c: lerp(sa.c ?? 0, ea.c ?? 0, factor),
                d: lerp(sa.d ?? 1, ea.d ?? 1, factor),
                x: lerp(sa.x ?? 0, ea.x ?? 0, factor),
                y: lerp(sa.y ?? 0, ea.y ?? 0, factor),
                rotate: lerp(sa.rotate ?? 0, ea.rotate ?? 0, factor),
            };
        } else {
            current.matrix = start.matrix ?? end.matrix;
        }

        return current;
    };

    const interpolateAtCurrentTime = async () => {
        const t = props.config.time;
        const result = {};

        props.selectedLayer.forEach(layerObj => {
            result[layerObj.id] = interpolateLayerAtTime(layerObj, t);
        });

        props.config._currentByLayer = result;
    };

    // -------------------------
    // Selection / drag
    // -------------------------
    const onMultiSelect = (box) => {
        if (!timeline.value) return;

        const scrollLeft = wrapper.value ? wrapper.value.scrollLeft : 0;
        const selectedIds = [];

        if (!box) {
            emitEvent("timeline:select-keyframes", []);
            return;
        }

        const boxLeftInSvg = box.x + scrollLeft;
        const boxRightInSvg = boxLeftInSvg + box.width;
        const boxTopInSvg = box.y;
        const boxBottomInSvg = boxTopInSvg + box.height;
        const frameY = props.config.height * 0.5;

        keyframes.value.forEach(frame => {
            const inside =
                frame.left >= boxLeftInSvg &&
                frame.left <= boxRightInSvg &&
                frameY >= boxTopInSvg &&
                frameY <= boxBottomInSvg;

            if (inside) selectedIds.push(frame.id);
        });

        emitEvent("timeline:select-keyframes", selectedIds);
    };

    const findControlPointAt = (x, y, radius = 15) => {
        if (!props.bezierState) return null;

        for (const curve of curveSegments.value) {
            if (!curve.isSelected || curve.isLinear) continue;

            if (curve.showCp1 && curve.cp1) {
                const cp1Pos = bezierToSVGCoords(curve.cp1);
                const dx1 = x - cp1Pos.x;
                const dy1 = y - cp1Pos.y;
                if (Math.sqrt(dx1 * dx1 + dy1 * dy1) < radius) return { curve, point: "cp1" };
            }

            if (curve.showCp2 && curve.cp2) {
                const cp2Pos = bezierToSVGCoords(curve.cp2);
                const dx2 = x - cp2Pos.x;
                const dy2 = y - cp2Pos.y;
                if (Math.sqrt(dx2 * dx2 + dy2 * dy2) < radius) return { curve, point: "cp2" };
            }
        }

        return null;
    };

    const onKFPointerDown = async (frame, evt) => {
        if (!timeline.value) return;

        if (props.bezierState) {
            const rect = timeline.value.getBoundingClientRect();
            const scrollLeft = wrapper.value ? wrapper.value.scrollLeft : 0;
            const x = evt.clientX - rect.left + scrollLeft;
            const y = evt.clientY - rect.top;
            const cpHit = findControlPointAt(x, y);

            if (cpHit) {
                evt.stopPropagation();
                evt.preventDefault();
                draggedControlPoint.value = cpHit;
                cpPointerId.value = evt.pointerId;

                try { timeline.value.setPointerCapture(evt.pointerId); } catch (e) { console.warn(e); }
                register("add", window, "pointermove", onCPPointerMove);
                register("add", window, "pointerup", onCPPointerUp);
                return;
            }
        }

        if (frame) {
            let data = [...props.config.selectedKeyframes];
            const index = data.findIndex(id => id === frame.id);

            if (evt.ctrlKey || evt.shiftKey) {
                if (index === -1) data.push(frame.id);
                else data.splice(index, 1);
            } else {
                if (index === -1) data = [frame.id];
            }

            const layer = getElById(props.selectedLayer, frame.layerId);
            if (layer) {
                const index = layer.keyframes.findIndex(k => k.id === frame.id);

                if (index !== -1) {
                    const kf = layer.keyframes[index];
                    const prev = layer.keyframes[index - 1];
                    const next = layer.keyframes[index + 1];

                    if (next) updateBezierAfterKeyframeMove(kf, next);
                    if (prev) updateBezierAfterKeyframeMove(prev, kf);
                }
            }

            emitEvent("timeline:select-keyframes", data);
        }

        if (!props.selectState || (!evt.ctrlKey && !evt.shiftKey)) {
            selectedId.value = frame?.id ?? null;
            pointerId.value = evt.pointerId;
            dragging.value = {
                id: frame?.id,
                layerId: frame?.layerId ?? frame?._orig?.layerId ?? null,
                startX: evt.clientX,
                origTime: frame?.time,
            };

            try { timeline.value.setPointerCapture(pointerId.value); } catch (e) { console.warn(e); }

            register("add", window, "pointermove", onKFPointerMove);
            register("add", window, "pointerup", onKFPointerUp);
        }
    };

    const onKFPointerMove = async (ev) => {
        if (!dragging.value || !timeline.value) return;

        const rect = timeline.value.getBoundingClientRect();
        const scrollLeft = wrapper.value?.scrollLeft || 0;
        const x = ev.clientX - rect.left + scrollLeft;
        const time = normalizeTime(_positionToTime(x), props.config.startTime, props.config.endTime);

        const layer = getElById(props.selectedLayer, dragging.value.layerId);
        if (!layer) return;

        const kfIndex = layer.keyframes.findIndex(k => k.id === dragging.value.id);
        if (kfIndex === -1) return;

        const kf = layer.keyframes[kfIndex];
        const prev = layer.keyframes[kfIndex - 1];
        const next = layer.keyframes[kfIndex + 1];

        kf.time = time;

        if (next) updateBezierAfterKeyframeMove(kf, next);
        if (prev) updateBezierAfterKeyframeMove(prev, kf);

        emitEvent("timeline:move-keyframe", {
            keyframeId: dragging.value.id,
            layerId: dragging.value.layerId,
            time: Math.round(time),
            record: props.recordState,
        });
    };

    const onKFPointerUp = async () => {
        if (!timeline.value || !pointerId.value) return;

        try { timeline.value.releasePointerCapture(pointerId.value); } catch (e) { console.warn(e); }
        register("remove", window, "pointermove", onKFPointerMove);
        register("remove", window, "pointerup", onKFPointerUp);

        dragging.value = null;
        pointerId.value = null;

        emitEvent("timeline:keyframes", props.selectedLayer.map(l => ({ id: l.id, keyframes: l.keyframes })));
    };

    const onCPPointerMove = async (ev) => {
        if (!draggedControlPoint.value || !timeline.value) return;

        ev.preventDefault();
        ev.stopPropagation();

        const rect = timeline.value.getBoundingClientRect();
        const scrollLeft = wrapper.value ? wrapper.value.scrollLeft : 0;
        const x = ev.clientX - rect.left + scrollLeft;
        const y = ev.clientY - rect.top;

        const { curve, point } = draggedControlPoint.value;
        const { start, end } = curve;

        const curveHeight = props.config.height * 0.25;
        const baseY = props.config.height * 0.75;

        const range = props.config.endTime - props.config.startTime;
        const time = range >= 0
            ? props.config.startTime + (x - props.config.padding) / props.config.zoomLevel.current
            : props.config.startTime - (x - props.config.padding) / props.config.zoomLevel.current;

        const value = (baseY - y) / curveHeight;

        const layerObj = getElById(props.selectedLayer, start.layerId);
        if (!layerObj) return;

        const originalKf = layerObj.keyframes.find(k => k.id === start.id);
        if (!originalKf) return;

        if (!originalKf.bezier) {
            originalKf.bezier = {
                cp1: { time: start.time, value: 0 },
                cp2: { time: end.time, value: 1 },
                _relativePos: {
                    cp1: { t: 0.33, v: 0.33 },
                    cp2: { t: 0.66, v: 0.66 },
                },
            };
        }

        if (!originalKf.bezier[point]) originalKf.bezier[point] = { time, value };

        originalKf.bezier[point].time = time;
        originalKf.bezier[point].value = value;

        const dt = end.time - start.time || 1;
        const relT = (time - start.time) / dt;
        originalKf.bezier._relativePos[point] = { t: relT, v: value };

        if (curve[point]) curve[point] = originalKf.bezier[point];

        emitEvent("timeline:update-bezier", {
            keyframeId: start.id,
            layerId: layerObj.id,
            point,
            time,
            value,
        });
    };

    const onCPPointerUp = async (ev) => {
        if (!timeline.value || !cpPointerId.value) return;

        ev.preventDefault();
        ev.stopPropagation();

        try { timeline.value.releasePointerCapture(cpPointerId.value); } catch (e) { console.warn(e); }
        register("remove", window, "pointermove", onCPPointerMove);
        register("remove", window, "pointerup", onCPPointerUp);

        emitEvent("timeline:keyframes", props.selectedLayer.map(l => ({ id: l.id, keyframes: l.keyframes })));

        draggedControlPoint.value = null;
        cpPointerId.value = null;

        await nextTick();
        await interpolateAtCurrentTime();
    };

    const updatePlayheadFromEvent = (evt) => {
        if (!timeline.value || !wrapper.value) return;

        const rect = timeline.value.getBoundingClientRect();
        const scrollLeft = wrapper.value.scrollLeft;
        const x = evt.clientX - rect.left + scrollLeft;

        const rawTime = _positionToTime(x);
        const newTime = normalizeTime(Math.round(rawTime), props.config.startTime, props.config.endTime);

        emitEvent("timeline:time", newTime);
    };

    const onPlayheadPointerDown = (evt) => {
        if (!timeline.value) return;

        evt.preventDefault();
        evt.stopPropagation();

        draggingPlayhead.value = true;
        playheadPointerId.value = evt.pointerId;

        try { timeline.value.setPointerCapture(evt.pointerId); } catch (e) { console.warn(e); }

        register("add", window, "pointermove", onPlayheadPointerMove);
        register("add", window, "pointerup", onPlayheadPointerUp);

        updatePlayheadFromEvent(evt);
    };

    const onPlayheadPointerMove = async (evt) => {
        if (!draggingPlayhead.value || !timeline.value) return;
        evt.preventDefault();
        evt.stopPropagation();
        updatePlayheadFromEvent(evt);
    };

    const onPlayheadPointerUp = async (evt) => {
        if (!timeline.value || !playheadPointerId.value) return;

        evt.preventDefault();
        evt.stopPropagation();

        try { timeline.value.releasePointerCapture(playheadPointerId.value); } catch (e) { console.warn(e); }

        register("remove", window, "pointermove", onPlayheadPointerMove);
        register("remove", window, "pointerup", onPlayheadPointerUp);

        draggingPlayhead.value = false;
        playheadPointerId.value = null;

        await interpolateAtCurrentTime();
    };

    // -------------------------
    // Playback / record
    // -------------------------
    const emitRecord = () => {
        const time = Math.round(props.config.time);

        const payload = {
            time,
            layers: props.selectedLayer.map(l => ({
                id: l.id,
                opacity: l.opacity ?? 1,
                matrix: l.matrix ?? { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0, rotate: 0 },
            })),
        };

        emitEvent("timeline-record", payload);
    };

    const onToggleRecord = async () => {
        emitEvent("timeline:record", !props.recordState);

        if (props.recordState && props.config._currentByLayer) {
            emitRecord();
        }
    };

    const normalizePlaybackTime = (time, direction) => {
        const start = props.config.startTime;
        const end = props.config.endTime;
        const total = end - start;

        if (!props.config.loop) return normalizeTime(time, props.config.startTime, props.config.endTime);

        if (total > 0) {
            if (direction === "forward" && time > end) return start;
            if (direction === "backward" && time < start) return end;
        } else if (total < 0) {
            if (direction === "forward" && time < end) return start;
            if (direction === "backward" && time > start) return end;
        }

        return time;
    };

    const animateToTime = (targetTime, duration = 120) => {
        if (rafId.value) cancelAnimationFrame(rafId.value);

        const startTime = props.config.time;
        const startTs = performance.now();

        async function step(now) {
            const elapsed = now - startTs;
            const t = Math.min(1, elapsed / duration);

            // easing optional (macht es nicer)
            const eased = ease["ease-in-out"](t);

            const currentTime = lerp(startTime, targetTime, eased);

            emitEvent("timeline:time", currentTime);
            await interpolateAtCurrentTime();

            if (t < 1) {
                rafId.value = requestAnimationFrame(step);
            } else {
                emitEvent("timeline:time", targetTime);
                rafId.value = null;
            }
        }

        rafId.value = requestAnimationFrame(step);
    };

    const startRAF = async () => {
        if (rafId.value) cancelAnimationFrame(rafId.value);
        playStartTimestamp.value = performance.now();
        playOffset.value = props.config.time;
        emitEvent("timeline:play", true);

        function step(now) {
            if (!props.playState) return;

            const elapsed = now - playStartTimestamp.value;
            let newTime = Math.round(playOffset.value + elapsed * 0.06);

            const start = props.config.startTime;
            const end = props.config.endTime;
            const total = end - start;

            if (total > 0) {
                if (newTime >= end) {
                    if (props.config.loop) {
                        playStartTimestamp.value = now;
                        playOffset.value = start;
                        newTime = start;
                    } else {
                        emitEvent("timeline:time", end);
                        emitEvent("timeline:play", false);
                        if (rafId.value) cancelAnimationFrame(rafId.value);
                        rafId.value = null;
                        return;
                    }
                }
            } else if (total < 0) {
                if (newTime <= end) {
                    if (props.config.loop) {
                        playStartTimestamp.value = now;
                        playOffset.value = start;
                        newTime = start;
                    } else {
                        emitEvent("timeline:time", end);
                        emitEvent("timeline:play", false);
                        if (rafId.value) cancelAnimationFrame(rafId.value);
                        rafId.value = null;
                        return;
                    }
                }
            }

            interpolateAtCurrentTime();
            emitEvent("timeline:time", newTime);

            if (props.recordState) emitRecord();
            rafId.value = requestAnimationFrame(step);
        }

        rafId.value = requestAnimationFrame(step);
    };

    const onTogglePlay = async () => {
        if (props.playState) await onPause();
        else await onPlay();
    };

    const onPlay = async () => {
        if (!props.playState) await startRAF();
    };

    const onPause = async () => {
        emitEvent("timeline:play", false);
        emitEvent("timeline:time", props.config.time);
        if (rafId.value) {
            cancelAnimationFrame(rafId.value);
            rafId.value = null;
        }
    };

    const onStop = async () => {
        await onPause();
        emitEvent("timeline:time", props.config.startTime);
        await interpolateAtCurrentTime();
    };

    const onFrameForward = async () => {
        const newTime = normalizePlaybackTime(props.config.time + 1, "forward");
        animateToTime(newTime);
    };

    const onFrameBack = async () => {
        const newTime = normalizePlaybackTime(props.config.time - 1, "backward");
        animateToTime(newTime);
    };

    const onSkipToEnd = async () => {
        animateToTime(props.config.endTime, 200);
    };

    const onSkipToStart = async () => {
        animateToTime(props.config.startTime, 200);
    };

    const onTimeInput = async (newTime) => {
        const time = normalizeTime(newTime, props.config.startTime, props.config.endTime);
        emitEvent("timeline:time", time);
        await interpolateAtCurrentTime();
    };

    const onWheel = async (e) => {
        e.preventDefault();
        if (!timeline.value || !wrapper.value) return;

        const oldZoom = props.config.zoomLevel.current;
        const factor = Math.exp(-e.deltaY * 0.0025);
        const newZoom = Math.min(
            props.config.zoomLevel.max,
            Math.max(props.config.zoomLevel.min, oldZoom * factor)
        );

        const rect = timeline.value.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const scrollLeft = wrapper.value.scrollLeft;
        const mouseTimeBeforeZoom = _positionToTime(mouseX + scrollLeft);

        emitEvent("timeline:zoom", newZoom);

        await nextTick(async () => {
            if (!wrapper.value) return;
            const newScrollLeft = _timeToPosition(mouseTimeBeforeZoom) - mouseX;
            wrapper.value.scrollLeft = Math.max(0, newScrollLeft);
        });
    };

    // -------------------------
    // Lifecycle
    // -------------------------
    const init = async () => {
        wrapper.value = document.getElementById(props.wrapperId);
        timeline.value = document.getElementById(props.config.id);
    };

    onMounted(async () => {
        await init();
        await interpolateAtCurrentTime();
    });

    onBeforeUnmount(() => {
        register("removeAll");
    });

    watch(selectedKeys, (newSelection) => {
        if (newSelection.length < 2) {
            emitEvent("timeline:bezier", false);
        }
    });

    // -------------------------
    // Public API
    // -------------------------
    return {
        timeline,
        width,
        scrollbars,
        keyframes,
        ticks,
        segments,
        playHead,
        selectedKeys,
        curveSegments,
        easeModes,
        trackHeight,
        curveVisibility,

        trackRows,
        layersWithKeys,
        keyframeHasOffset,

        layerCurveSegments,
        getCurveBaseY,

        getCurveValuePath,
        getCurveSpeedPath,
        getCurveValueLabels,
        getCurveSpeedLabels,
        getCurveAccelerationPath,
        getCurveAccelerationLabels,
        getZeroLineY,

        trackTop,
        trackColor,
        lighten,
        toggleLayerOpen,
        isLayerOpen,

        bezierToSVGCoords,
        onPlay,
        onPause,
        onStop,
        onTogglePlay,
        hasOffset,
        trackHasOffsetByType,
        getCurvePath,
        onWheel,
        onMultiSelect,
        onKFPointerDown,
        onFrameForward,
        onFrameBack,
        onSkipToStart,
        onSkipToEnd,
        onTimeInput,
        onToggleRecord,
        onPlayheadPointerDown,
        emitEvent,
    };
}

export const timelineProps = {
    selectMenu: { type: Boolean, required: true },
    selectState: { type: Boolean, required: true },
    playState: { type: Boolean, required: true },
    recordState: { type: Boolean, required: true },
    bezierState: { type: Boolean, required: true },
    sidebarState: { type: Boolean, required: true },
    wrapperId: { type: String, required: true },
    config: { type: Object, required: true },
    selectionBox: { type: Object, required: true },
    selectedLayer: { type: Array, required: true },
    layers: { type: Array, required: true },
};