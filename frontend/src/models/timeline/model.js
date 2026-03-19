import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from "vue";
import {eventRegister} from "@/dataLayer/event";
import {uuid} from "@/utils/uuid";

export function timelineModel(props, emit) {

    const wrapper = ref(null);
    const timeline = ref(null);
    const scrollbars = ref([uuid()]);
    const dragging = ref(null);
    const selectedId = ref(null);
    const pointerId = ref(null);
    const rafId = ref(null);

    const width = computed(() => props.config.width);

    const playStartTimestamp = ref(0);
    const playOffset = ref(0);

    const draggedControlPoint = ref(null);
    const cpPointerId = ref(null);

    const draggingPlayhead = ref(false);
    const playheadPointerId = ref(null);

    const ease = {
        linear: (t) => t,
        'ease-in': (t) => t * t,
        'ease-out': (t) => t * (2 - t),
        'ease-in-out': (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    };

    const presets = {
        'linear': { cp1: { t: 0.33, v: 0.33 }, cp2: { t: 0.66, v: 0.66 } },
        'ease-in': { cp1: { t: 0.42, v: 0 }, cp2: { t: 1.0, v: 1.0 } },
        'ease-out': { cp1: { t: 0, v: 0 }, cp2: { t: 0.58, v: 1.0 } },
        'ease-in-out': { cp1: { t: 0.42, v: 0 }, cp2: { t: 0.58, v: 1.0 } }
    };

    const easeModes = [
        { title: 'Linear', value: 'linear' },
        { title: 'Ease In', value: 'ease-in' },
        { title: 'Ease Out', value: 'ease-out' },
        { title: 'Ease In-Out', value: 'ease-in-out' }
    ]

    const openLayers = ref({}); // map layerId => boolean
    const trackHeight = 36;
    const trackPalette = [
        '#ff6b6b', '#f5a623', '#f8e71c', '#8bffc6', '#6bafff', '#d07bff', '#4de0b8', '#ff7ac4'
    ];

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const { register } = eventRegister('listener:timeline', emitEvent);

    const hasOffset = (kf) => {
        console.log(kf)
        if (!kf?.matrix) return false;

        const m = kf.matrix;

        // Transform (x / y) – Offset darf 0 sein
        const hasTranslate = m.x !== undefined && m.y !== undefined;

        // Rotate – 0 ist gültig
        const hasRotate = m.rotate !== undefined;

        // Scale – Default ist 1 → nur anzeigen, wenn gesetzt
        const hasScale = m.a !== undefined && m.d !== undefined;

        return hasTranslate || hasRotate || hasScale;
    };

    const trackHasOffsetByType = (layer, type) => {
        return layer.keyframes.some(kf => {
            const m = kf.matrix ?? {};
            if (type === 'transform') return (m.x ?? 0) !== 0 || (m.y ?? 0) !== 0;
            if (type === 'rotate') return (m.rotate ?? 0) !== 0;
            if (type === 'scale') return (m.a ?? 1) !== 1 || (m.d ?? 1) !== 1;
            return false;
        });
    };

    const keyframeHasOffset = (kf) => {
        if (!kf?.matrix) return false;
        const m = kf.matrix;
        if ((m.x ?? 0) !== 0) return true;
        if ((m.y ?? 0) !== 0) return true;
        if ((m.rotate ?? 0) !== 0) return true;
        if ((m.a ?? 1) !== 1) return true;
        if ((m.d ?? 1) !== 1) return true;
        return false;
    };

    function _getLayerById(layerId){
        return props.selectedLayer.find(l => l.id === layerId);
    }



    function _normalizeTime(time){
        const start = props.config.startTime;
        const end = props.config.endTime;
        const minT = Math.min(start, end);
        const maxT = Math.max(start, end);
        if (minT === maxT) return start;
        return Math.max(minT, Math.min(maxT, time));
    }

    function _timeToPosition(time) {
        const range = props.config.endTime - props.config.startTime;
        const t = range >= 0 ? (time - props.config.startTime) : (props.config.startTime - time);
        return t * props.config.zoomLevel.current + props.config.padding;
    }

    function _ensureLayerKeyframes (layerObj) {
        if (!Array.isArray(layerObj.keyframes)) {
            layerObj.keyframes = [];
        }
    }

    function _positionToTime(position) {
        const range = props.config.endTime - props.config.startTime;
        const offset = (position - props.config.padding) / props.config.zoomLevel.current;
        return range >= 0 ? props.config.startTime + offset : props.config.startTime - offset;
    }

    function _applyBezierEasing(factor, cp1, cp2){
        const cubicBezier = (t, p0, p1, p2, p3) => {
            const u = 1 - t;
            return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
        };
        return cubicBezier(factor, 0, cp1.value, cp2.value, 1);
    }

    function _applyEasing(factor, easeType, bezier) {
        if (easeType === 'linear') return factor;
        if (bezier?.cp1 && bezier?.cp2) return _applyBezierEasing(factor, bezier.cp1, bezier.cp2);
        const easeFn = ease[easeType] || ease.linear;
        return easeFn(factor);
    }

    const trackColor = (layerId) => {
        // deterministic color by id -> pick index by hash
        let hash = 0;
        for (let i = 0; i < layerId.length; i++) hash = (hash << 5) - hash + layerId.charCodeAt(i);
        const idx = Math.abs(hash) % trackPalette.length;
        return trackPalette[idx];
    };
    const lighten = (hex, amt) => {
        // quick hex lighten (returns hex) - not perfect but ok for strokes
        let col = hex.replace('#','');
        if (col.length === 3) col = col.split('').map(c=>c+c).join('');
        const num = parseInt(col, 16);
        let r = (num >> 16) + amt; r = Math.max(0, Math.min(255, r));
        let g = ((num >> 8) & 0x00FF) + amt; g = Math.max(0, Math.min(255, g));
        let b = (num & 0x0000FF) + amt; b = Math.max(0, Math.min(255, b));
        return '#' + (r<<16 | g<<8 | b).toString(16).padStart(6, '0');
    };

    const trackTop = () => {
        return props.config?.height * 0.32
    };

    const layersWithKeys = computed(() => {
        return props.layers.filter(l => Array.isArray(l.keyframes) && l.keyframes.length > 0);
    });

    const toggleLayerOpen = (id) => openLayers.value[id] = !openLayers.value[id];
    const isLayerOpen = (id) => !!openLayers.value[id];

    const playHead = computed(() => _timeToPosition(props.config.time));

    /**
     * Keyframes computed = merged from all selected layers
     * with layerId reference.
     */
    const keyframes = computed(() => {
        const frames = [];

        // build merged *copies* from selected layers (for curve drawing etc.)
        props.selectedLayer.forEach(layerObj => {
            _ensureLayerKeyframes(layerObj);

            // take a shallow copy per keyframe so we don't mutate the originals
            const copies = layerObj.keyframes
                .slice()
                .sort((a, b) => a.time - b.time)
                .map(k => {
                    return {
                        // keep id so we can map back to original when needed
                        id: k.id,
                        time: k.time,
                        ease: k.ease,
                        // don't copy bezier object by reference, copy if exists
                        bezier: k.bezier ? structuredClone(k.bezier) : null,
                        // *computed* props only on the copy:
                        left: _timeToPosition(k.time),
                        layerId: layerObj.id,
                        // store original reference id so we can find the original in layer.keyframes
                        _orig: k
                    };
                });

            // set _next on copies only (so original keyframes won't get _next)
            for (let i = 0; i < copies.length - 1; i++) {
                copies[i]._next = copies[i + 1];
            }

            frames.push(...copies);
        });

        frames.sort((a, b) => a.time - b.time);
        return frames;
    });


    const selectedKeys = computed(() => props.config.selectedKeyframes || []);

    const ticks = computed(() => {
        const candidates = props.config.ticks.candidates;
        const targetPx = props.config.ticks.targetPx;

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

        for (let t = tickStart; t <= tickEnd; t += chosen) {
            const left = _timeToPosition(t);

            let majorInterval = 5;
            if (chosen >= 100) majorInterval = 1;
            else if (chosen >= 10) majorInterval = 2;
            else if (chosen >= 1) majorInterval = 5;
            else majorInterval = 10;

            const major = (Math.round(t / chosen) % majorInterval) === 0;

            ticksArr.push({ time: t, left, major });
        }

        return ticksArr;
    });

    const segments = computed(() => {
        const items = [];
        const arr = keyframes.value;
        if (!arr?.length) return [];

        for (let i = 0; i < arr.length - 1; i++) {
            const left = arr[i].left;
            const width = Math.max(2, arr[i + 1].left - arr[i].left);
            items.push({ left, width, color: i % 2 === 0 ? '#9153a1' : '#2b8cff' });
        }

        if (arr.length > 0) {
            const lastKf = arr[arr.length - 1];
            const timelineEnd = props.config.width;
            const width = Math.max(2, timelineEnd - lastKf.left);

            if (width > 2) {
                items.push({
                    left: lastKf.left,
                    width,
                    color: arr.length % 2 === 0 ? '#9153a1' : '#2b8cff'
                });
            }
        }

        return items;
    });

    const trackRows = computed(() => {
        // order = props.selectedLayer order
        return props.selectedLayer.map((layer, i) => {
            _ensureLayerKeyframes(layer);

            // per-layer keyframe view copies
            const keyframesForLayer = (layer.keyframes || [])
                .slice()
                .map(k => ({
                    id: k.id,
                    time: k.time,
                    left: _timeToPosition(k.time),
                    matrix: structuredClone(k.matrix ?? {}),
                    _orig: k
                }))
                .sort((a, b) => a.time - b.time);

            // build raw subTracks with hasOffset flag and keyframe list
            const subTracks = [
                {
                    trackId: 'transform',
                    label: 'Transform',
                    hasOffset: trackHasOffsetByType(layer, 'transform'),
                    keyframes: keyframesForLayer.map(k => ({ id: k.id, left: k.left, time: k.time }))
                },
                {
                    trackId: 'rotate',
                    label: 'Rotate',
                    hasOffset: trackHasOffsetByType(layer, 'rotate'),
                    keyframes: keyframesForLayer.map(k => ({ id: k.id, left: k.left, time: k.time }))
                },
                {
                    trackId: 'scale',
                    label: 'Scale',
                    hasOffset: trackHasOffsetByType(layer, 'scale'),
                    keyframes: keyframesForLayer.map(k => ({ id: k.id, left: k.left, time: k.time }))
                }
            ];

            // visibleSubTracks = vorgefilterte Liste (vermeidet v-if + v-for Mischung)
            const visibleSubTracks = subTracks.filter(st => st.hasOffset);

            return {
                layer,
                keyframes: keyframesForLayer,
                color: trackColor(layer.id),
                bg: trackColor(layer.id),
                index: i,
                subTracks,
                visibleSubTracks
            };
        });
    });



    const initializeBezierForKeyframe = (kf, nextKf) => {
        if (!kf || !nextKf) return;

        const dt = nextKf.time - kf.time;
        if (dt === 0) return;

        const ease = kf.ease || 'linear';
        const preset = JSON.parse(JSON.stringify(presets[ease] || presets.linear));

        if (Math.sign(dt) < 0) {
            const cp1t = preset.cp1.t, cp2t = preset.cp2.t;
            preset.cp1.t = 1 - cp2t;
            preset.cp2.t = 1 - cp1t;
        }

        let cp1Time = kf.time + dt * preset.cp1.t;
        let cp2Time = kf.time + dt * preset.cp2.t;

        const minT = Math.min(kf.time, nextKf.time);
        const maxT = Math.max(kf.time, nextKf.time);
        cp1Time = Math.max(minT, Math.min(maxT, cp1Time));
        cp2Time = Math.max(minT, Math.min(maxT, cp2Time));

        kf.bezier = {
            cp1: { time: cp1Time, value: preset.cp1.v },
            cp2: { time: cp2Time, value: preset.cp2.v },
            _relativePos: {
                cp1: { t: preset.cp1.t, v: preset.cp1.v },
                cp2: { t: preset.cp2.t, v: preset.cp2.v }
            }
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
        cp1Time = Math.max(minT, Math.min(maxT, cp1Time));
        cp2Time = Math.max(minT, Math.min(maxT, cp2Time));

        kf.bezier.cp1.time = cp1Time;
        kf.bezier.cp2.time = cp2Time;
        kf.bezier.cp1.value = rel.cp1.v;
        kf.bezier.cp2.value = rel.cp2.v;
    };

    const getCurveBaseY = (trackIndex) => {
        // trackTop(trackIndex) gives top of the track row in the SVG
        // place curve baseline a bit down inside the track row
        return trackTop(trackIndex) + trackHeight * 0.75;
    };

    const bezierToSVGCoords = (cp, trackIndex = null) => {
        if (!cp) return { x: 0, y: 0 };
        const curveHeight = Math.min(props.config.height * 0.25, trackHeight * 1.5); // cap size
        const baseY = trackIndex !== null ? getCurveBaseY(trackIndex) : props.config.height * 0.75;
        const x = _timeToPosition(cp.time);
        const y = baseY - (cp.value * curveHeight);
        return { x, y };
    };

    const buildCurvesForLayer = (layer) => {
        _ensureLayerKeyframes(layer);
        const frames = (layer.keyframes || [])
            .slice()
            .sort((a,b) => a.time - b.time)
            .map(k => ({
                id: k.id,
                time: k.time,
                ease: k.ease,
                bezier: k.bezier ? structuredClone(k.bezier) : null,
                left: _timeToPosition(k.time),
                _orig: k
            }));

        const curves = [];
        for (let i = 0; i < frames.length - 1; i++) {
            const kf = frames[i];
            const nextKf = frames[i + 1];
            const isLinear = kf.ease === 'linear';

            const originalKf = layer.keyframes.find(k => k.id === kf.id);
            if (!originalKf) continue;

            if (!isLinear) {
                if (!originalKf.bezier || !originalKf.bezier.cp1 || !originalKf.bezier.cp2) {
                    initializeBezierForKeyframe(originalKf, nextKf);
                } else if (!originalKf.bezier._relativePos) {
                    const dt = nextKf.time - originalKf.time || 1;
                    originalKf.bezier._relativePos = {
                        cp1: { t: (originalKf.bezier.cp1.time - originalKf.time) / dt, v: originalKf.bezier.cp1.value },
                        cp2: { t: (originalKf.bezier.cp2.time - originalKf.time) / dt, v: originalKf.bezier.cp2.value }
                    };
                } else {
                    updateBezierAfterKeyframeMove(originalKf, nextKf);
                }
                kf.bezier = originalKf.bezier;
            }

            const isSelected = selectedKeys.value.includes(kf.id) || selectedKeys.value.includes(nextKf.id);

            curves.push({
                id: `curve-${layer.id}-${kf.id}-${nextKf.id}`,
                start: kf,
                end: nextKf,
                isSelected,
                isLinear,
                showCp1: !isLinear,
                showCp2: !isLinear,
                cp1: (!isLinear && kf.bezier?.cp1) ? kf.bezier.cp1 : null,
                cp2: (!isLinear && kf.bezier?.cp2) ? kf.bezier.cp2 : null
            });
        }

        return curves;
    };

    const layerCurveSegments = computed(() => {
        const map = {};
        // we use selectedLayer order so visible tracks correspond to trackRows
        props.selectedLayer.forEach(layer => {
            map[layer.id] = buildCurvesForLayer(layer);
        });
        return map;
    });

    const curveSegments = computed(() => {
        const curves = [];
        const arr = keyframes.value;

        for (let i = 0; i < arr.length - 1; i++) {
            const kf = arr[i];
            const nextKf = arr[i + 1];
            const isLinear = kf.ease === 'linear';

            const layer = _getLayerById(kf.layerId);
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
                        cp2: { t: (originalKf.bezier.cp2.time - originalKf.time) / dt, v: originalKf.bezier.cp2.value }
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
                cp2: (!isLinear && kf.bezier?.cp2) ? kf.bezier.cp2 : null
            });
        }

        return curves;
    });

    // ---- Interpolation per layer ----
    const interpolateLayerAtTime = (layerObj, t) => {
        _ensureLayerKeyframes(layerObj);

        const frames = layerObj.keyframes.sort((a, b) => a.time - b.time);
        if (frames.length === 0) return {};

        let left = frames[0], right = frames[frames.length - 1];
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
        factor = _applyEasing(factor, left.ease || 'linear', left.bezier);

        const current = {};
        const start = { opacity: left.opacity, matrix: left.matrix };
        const end = { opacity: right.opacity, matrix: right.matrix };

        // opacity
        if (typeof start.opacity === "number" && typeof end.opacity === "number") {
            current.opacity = start.opacity + (end.opacity - start.opacity) * factor;
        } else {
            current.opacity = start.opacity ?? end.opacity;
        }

        // matrix interpolation (linear per element)
        if (start.matrix && end.matrix) {
            current.matrix = {
                a: start.matrix.a + (end.matrix.a - start.matrix.a) * factor,
                b: start.matrix.b + (end.matrix.b - start.matrix.b) * factor,
                c: start.matrix.c + (end.matrix.c - start.matrix.c) * factor,
                d: start.matrix.d + (end.matrix.d - start.matrix.d) * factor,
                x: start.matrix.x + (end.matrix.x - start.matrix.x) * factor,
                y: start.matrix.y + (end.matrix.y - start.matrix.y) * factor,
                rotate: start.matrix.rotate + (end.matrix.rotate - start.matrix.rotate) * factor,
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

    const onMultiSelect = (box) => {
        if (!timeline.value) return;

        const scrollLeft = wrapper.value ? wrapper.value.scrollLeft : 0;
        const selectedIds = [];

        if (box) {
            keyframes.value.forEach(frame => {
                const frameX = frame.left;
                const frameY = props.config.height * 0.5;

                const boxLeftInSvg = box.x + scrollLeft;
                const boxRightInSvg = boxLeftInSvg + box.width;
                const boxTopInSvg = box.y;
                const boxBottomInSvg = boxTopInSvg + box.height;

                const inside =
                    frameX >= boxLeftInSvg &&
                    frameX <= boxRightInSvg &&
                    frameY >= boxTopInSvg &&
                    frameY <= boxBottomInSvg;

                if (inside) selectedIds.push(frame.id);
            });

            emitEvent('timeline:select-keyframes', selectedIds);
        } else {
            emitEvent('timeline:select-keyframes', []);
        }
    };

    // ---- KEYFRAME DRAGGING ----
    const onKFPointerDown = async (frame, evt) => {
        if (!timeline.value) return;

        // bezier editing branch unchanged
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
                try { timeline.value.setPointerCapture(evt.pointerId); } catch (e) {console.warn(e)}
                register('add', window, 'pointermove', onCPPointerMove);
                register('add', window, 'pointerup', onCPPointerUp);
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

            emitEvent('timeline:select-keyframes', data);
        }

        if (!props.selectState || (!evt.ctrlKey && !evt.shiftKey)) {
            selectedId.value = frame?.id ?? null;
            pointerId.value = evt.pointerId;
            // store layerId together with dragging info
            dragging.value = {
                id: frame?.id,
                layerId: frame?.layerId ?? frame?._orig?.layerId ?? null,
                startX: evt.clientX,
                origTime: frame?.time
            };

            try { timeline.value.setPointerCapture(pointerId.value); } catch (e) {console.warn(e)}

            register('add', window, 'pointermove', onKFPointerMove);
            register('add', window, 'pointerup', onKFPointerUp);
        }
    };

    const onKFPointerMove = async (ev) => {
        if (!dragging.value || !timeline.value) return;

        const rect = timeline.value.getBoundingClientRect();
        const scrollLeft = wrapper.value?.scrollLeft || 0;
        const x = ev.clientX - rect.left + scrollLeft;
        const time = _normalizeTime(_positionToTime(x));

        // emit layerId as well so the listener knows which layer to modify
        emitEvent("timeline:move-keyframe", {
            keyframeId: dragging.value.id,
            layerId: dragging.value.layerId,
            time: Math.round(time),
            record: props.recordState
        });
    };


    const onKFPointerUp = async () => {
        if (!timeline.value || !pointerId.value) return;

        try { timeline.value.releasePointerCapture(pointerId.value); } catch (e) {console.warn(e)}
        register('remove', window, 'pointermove', onKFPointerMove);
        register('remove', window, 'pointerup', onKFPointerUp);

        dragging.value = null;
        pointerId.value = null;

        emitEvent('timeline:keyframes', props.selectedLayer.map(l => ({ id: l.id, keyframes: l.keyframes })));
    };

    // ---- CONTROL POINT DRAG ----
    const findControlPointAt = (x, y, radius = 15) => {
        if (!props.bezierState) return null;

        for (const curve of curveSegments.value) {
            if (!curve.isSelected || curve.isLinear) continue;

            if (curve.showCp1 && curve.cp1) {
                const cp1Pos = bezierToSVGCoords(curve.cp1);
                const dx1 = x - cp1Pos.x;
                const dy1 = y - cp1Pos.y;
                if (Math.sqrt(dx1 * dx1 + dy1 * dy1) < radius) return { curve, point: 'cp1' };
            }

            if (curve.showCp2 && curve.cp2) {
                const cp2Pos = bezierToSVGCoords(curve.cp2);
                const dx2 = x - cp2Pos.x;
                const dy2 = y - cp2Pos.y;
                if (Math.sqrt(dx2 * dx2 + dy2 * dy2) < radius) return { curve, point: 'cp2' };
            }
        }
        return null;
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
        let time;
        if (range >= 0) {
            time = props.config.startTime + (x - props.config.padding) / props.config.zoomLevel.current;
        } else {
            time = props.config.startTime - (x - props.config.padding) / props.config.zoomLevel.current;
        }

        const value = (baseY - y) / curveHeight;

        const layerObj = _getLayerById(start.layerId);
        if (!layerObj) return;

        const originalKf = layerObj.keyframes.find(k => k.id === start.id);
        if (!originalKf) return;

        if (!originalKf.bezier) {
            originalKf.bezier = {
                cp1: { time: start.time, value: 0 },
                cp2: { time: end.time, value: 1 },
                _relativePos: { cp1: { t: 0.33, v: 0.33 }, cp2: { t: 0.66, v: 0.66 } }
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
            value
        });
    };

    const onCPPointerUp = async (ev) => {
        if (!timeline.value || !cpPointerId.value) return;

        ev.preventDefault();
        ev.stopPropagation();

        try { timeline.value.releasePointerCapture(cpPointerId.value); } catch (e) {console.warn(e)}

        register('remove', window, 'pointermove', onCPPointerMove);
        register('remove', window, 'pointerup', onCPPointerUp);

        emitEvent('timeline:keyframes', props.selectedLayer.map(l => ({ id: l.id, keyframes: l.keyframes })));

        draggedControlPoint.value = null;
        cpPointerId.value = null;

        await nextTick();
        await interpolateAtCurrentTime();
    };

    // ---- PLAYHEAD ----
    const onPlayheadPointerDown = (evt) => {
        if (!timeline.value) return;

        evt.preventDefault();
        evt.stopPropagation();

        draggingPlayhead.value = true;
        playheadPointerId.value = evt.pointerId;

        try { timeline.value.setPointerCapture(evt.pointerId); } catch (e) {console.warn(e)}

        register('add', window, 'pointermove', onPlayheadPointerMove);
        register('add', window, 'pointerup', onPlayheadPointerUp);

        updatePlayheadFromEvent(evt);
    };

    const onPlayheadPointerMove = async (evt) => {
        if (!draggingPlayhead.value || !timeline.value) return;
        evt.preventDefault();
        evt.stopPropagation();
        updatePlayheadFromEvent(evt);
    };

    const updatePlayheadFromEvent = (evt) => {
        if (!timeline.value || !wrapper.value) return;

        const rect = timeline.value.getBoundingClientRect();
        const scrollLeft = wrapper.value.scrollLeft;
        const x = evt.clientX - rect.left + scrollLeft;

        const rawTime = _positionToTime(x);
        const newTime = _normalizeTime(Math.round(rawTime));

        emitEvent('timeline:time', newTime);
    };

    const onPlayheadPointerUp = async (evt) => {
        if (!timeline.value || !playheadPointerId.value) return;

        evt.preventDefault();
        evt.stopPropagation();

        try { timeline.value.releasePointerCapture(playheadPointerId.value); } catch (e) {console.warn(e)}

        register('remove', window, 'pointermove', onPlayheadPointerMove);
        register('remove', window, 'pointerup', onPlayheadPointerUp);

        draggingPlayhead.value = false;
        playheadPointerId.value = null;

        await interpolateAtCurrentTime();
    };


    // ---- RECORD ----
    const emitRecord = () => {
        const time = Math.round(props.config.time);

        const payload = {
            time,
            layers: props.selectedLayer.map(l => ({
                id: l.id,
                opacity: l.opacity ?? 1,
                matrix: l.matrix ?? { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0, rotate: 0 }
            }))
        };

        emitEvent("timeline-record", payload);
    };

    const onToggleRecord = async () => {
        emitEvent('timeline:record', !props.recordState);

        if (props.recordState && props.config._currentByLayer) {
            emitRecord();
        }
    };

    // ---- PLAYBACK ----
    const startRAF = async () => {
        if (rafId.value) cancelAnimationFrame(rafId.value);
        playStartTimestamp.value = performance.now();
        playOffset.value = props.config.time;
        emitEvent('timeline:play', true);

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
                        emitEvent('timeline:time', end);
                        emitEvent('timeline:play', false);
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
                        emitEvent('timeline:time', end);
                        emitEvent('timeline:play', false);
                        if (rafId.value) cancelAnimationFrame(rafId.value);
                        rafId.value = null;
                        return;
                    }
                }
            }

            emitEvent('timeline:time', newTime);

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
        emitEvent('timeline:play', false);
        emitEvent('timeline:time', props.config.time);
        if (rafId.value) {
            cancelAnimationFrame(rafId.value);
            rafId.value = null;
        }
    };

    const onStop = async () => {
        await onPause();
        emitEvent('timeline:time', props.config.startTime);
        await interpolateAtCurrentTime();
    };

    const onFrameForward = async () => {
        let newTime = props.config.time + 1;
        if (props.config.loop) {
            const start = props.config.startTime;
            const end = props.config.endTime;
            const total = end - start;

            if (total > 0 && newTime > end) newTime = start;
            else if (total < 0 && newTime < end) newTime = start;
        } else {
            newTime = _normalizeTime(newTime);
        }

        emitEvent('timeline:time', newTime);
        await interpolateAtCurrentTime();
    };

    const onFrameBack = async () => {
        let newTime = props.config.time - 1;
        if (props.config.loop) {
            const start = props.config.startTime;
            const end = props.config.endTime;
            const total = end - start;

            if (total > 0 && newTime < start) newTime = end;
            else if (total < 0 && newTime > start) newTime = end;
        } else {
            newTime = _normalizeTime(newTime);
        }

        emitEvent('timeline:time', newTime);
        await interpolateAtCurrentTime();
    };

    const onSkipToEnd = async () => {
        emitEvent('timeline:time', props.config.endTime);
        await interpolateAtCurrentTime();
    };

    const onTimeInput = async (newTime) => {
        const time = _normalizeTime(Math.round(newTime));
        emitEvent('timeline:time', time);
        await interpolateAtCurrentTime();
    };

    const getCurvePath = (curve, trackIndex = null) => {
        const startX = curve.start.left;
        const endX = curve.end.left;
        const curveHeight = Math.min(props.config.height * 0.25, trackHeight * 1.5);
        const baseY = trackIndex !== null ? getCurveBaseY(trackIndex) : props.config.height * 0.75;

        if (curve.isLinear || !curve.cp1 || !curve.cp2) {
            const startY = baseY;
            const endY = baseY - curveHeight;
            return `M ${startX} ${startY} L ${endX} ${endY}`;
        }

        const startY = baseY;
        const endY = baseY - curveHeight;
        const cp1 = bezierToSVGCoords(curve.cp1, trackIndex);
        const cp2 = bezierToSVGCoords(curve.cp2, trackIndex);

        return `M ${startX} ${startY} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${endX} ${endY}`;
    };

    watch(selectedKeys, (newSelection) => {
        if (newSelection.length < 2) {
            emitEvent('timeline:bezier', false);
        }
    });

    async function init (){
        wrapper.value = document.getElementById(props.wrapperId);
        timeline.value = document.getElementById(props.config.id);
    }

    onMounted(async () => {
        await init();
        await interpolateAtCurrentTime();
    });

    onBeforeUnmount(() => {
        register('removeAll');
    });

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

        trackRows,
        layersWithKeys,
        keyframeHasOffset,

        layerCurveSegments,
        getCurveBaseY,

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
        onWheel: async (e) => {
            e.preventDefault();
            if (!timeline.value || !wrapper.value) return;

            const oldZoom = props.config.zoomLevel.current;
            const delta = e.deltaY;
            const factor = Math.exp(-delta * 0.0025);
            const newZoom = Math.min(props.config.zoomLevel.max, Math.max(props.config.zoomLevel.min, oldZoom * factor));

            const rect = timeline.value.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const scrollLeft = wrapper.value.scrollLeft;
            const mouseTimeBeforeZoom = _positionToTime(mouseX + scrollLeft);

            emitEvent('timeline:zoom', newZoom);

            await nextTick(async () => {
                if (!wrapper.value) return;
                const newScrollLeft = _timeToPosition(mouseTimeBeforeZoom) - mouseX;
                wrapper.value.scrollLeft = Math.max(0, newScrollLeft);
            });
        },
        onMultiSelect,
        onKFPointerDown,
        onFrameForward,
        onFrameBack,
        onSkipToEnd,
        onTimeInput,
        onToggleRecord,
        onPlayheadPointerDown,
        emitEvent
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
    layers: { type: Array, required: true }
};
