import {computed, nextTick, onMounted, ref, watch} from "vue";
import {uuid} from "@/utils/uuid";

export function timelineModel(props, emit) {

    const wrapper = ref(null);
    const timeline = ref(null);
    const dragging = ref(null);
    const selectedId = ref(null);
    const pointerId = ref(null);
    const rafId = ref(null);
    const playStartTimestamp = ref(0);
    const playOffset = ref(0);

    const bezierModeEnabled = ref(false);
    const draggedControlPoint = ref(null);
    const cpPointerId = ref(null);

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const width = computed(() => {
        return Math.max(props.config.width, totalTime.value * props.config.zoomLevel.current + props.config.padding * 2)
    });

    const playHead = computed(() => {
        return (props.config.time) + props.config.padding
    });

    const keyframes = computed(() => {
        const arr = props.config.keyframes.map(k => Object.assign({}, k));
        arr.sort((a,b) => a.time - b.time);
        arr.forEach(k => { k.left = (k.time * props.config.zoomLevel.current) + props.config.padding; });
        for (let i=0;i<arr.length-1;i++) arr[i]._next = arr[i+1];
        return arr;
    });

    const totalTime = computed(() => {
        const last = keyframes.value[keyframes.value.length - 1];
        return Math.max(props.config.totalTime, last ? last.time + 50 : props.config.totalTime);
    });

    const ticks = computed(() => {
        const candidates = props.config.ticks.candidates;
        const targetPx = props.config.ticks.targetPx;

        let chosen = 1;
        for (const c of candidates) {
            if (c * props.config.zoomLevel.current >= targetPx) { chosen = c; break; }
        }
        if (chosen === 1 && candidates[candidates.length-1] * props.config.zoomLevel.current < targetPx) chosen = candidates[candidates.length-1];

        const ticksArr = [];
        const tMax = Math.ceil(totalTime.value / chosen) * chosen;
        for (let t = 0; t <= tMax; t += chosen) {
            const left = (t * props.config.zoomLevel.current) + props.config.padding;
            const major = (Math.round(t / chosen) % (chosen >= 10 ? 1 : (chosen >= 1 ? 5 : 10)) ) === 0;
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
            const width = Math.max(2, arr[i+1].left - arr[i].left);
            items.push({ left, width, color: i % 2 === 0 ? '#9153a1' : '#2b8cff' });
        }
        return items;
    });

    const selectedKeys = computed( () => {
        return props.config.selectedKeyframes || [];
    });

    // Watch for selection changes to auto-disable bezier mode
    watch(selectedKeys, (newSelection) => {
        if (newSelection.length === 0 || newSelection.length < 2) {
            bezierModeEnabled.value = false;
        }
    });

    const curveSegments = computed(() => {
        const curves = [];
        const arr = keyframes.value;

        for (let i = 0; i < arr.length - 1; i++) {
            const kf = arr[i];
            const nextKf = arr[i + 1];
            const isLinear = kf.ease === 'linear';

            // Get the original keyframe from props.config.keyframes
            const originalKf = props.config.keyframes.find(k => k.id === kf.id);
            if (!originalKf) continue;

            // Only initialize bezier for non-linear keyframes
            if (!isLinear) {
                // Check if bezier needs initialization
                if (!originalKf.bezier || !originalKf.bezier.cp1 || !originalKf.bezier.cp2) {
                    initializeBezierForKeyframe(originalKf, nextKf);
                } else if (!originalKf.bezier._relativePos) {
                    // Bezier exists but _relativePos is missing - recalculate it
                    const dt = nextKf.time - originalKf.time || 1;
                    originalKf.bezier._relativePos = {
                        cp1: {
                            t: (originalKf.bezier.cp1.time - originalKf.time) / dt,
                            v: originalKf.bezier.cp1.value
                        },
                        cp2: {
                            t: (originalKf.bezier.cp2.time - originalKf.time) / dt,
                            v: originalKf.bezier.cp2.value
                        }
                    };
                } else {
                    // Update positions based on relative positions (handles keyframe moves)
                    updateBezierAfterKeyframeMove(originalKf, nextKf);
                }

                // Copy updated bezier to computed keyframe
                kf.bezier = originalKf.bezier;
            }

            const isSelected = selectedKeys.value.includes(kf.id) || selectedKeys.value.includes(nextKf.id);

            // All non-linear segments show both control points
            // No special handling for first/last keyframes
            const showCp1 = !isLinear;
            const showCp2 = !isLinear;

            curves.push({
                id: `curve-${kf.id}-${nextKf.id}`,
                start: kf,
                end: nextKf,
                isSelected,
                isLinear,
                showCp1,
                showCp2,
                // Reference the actual bezier objects, not copies
                cp1: (isLinear || !showCp1) ? null : kf.bezier?.cp1,
                cp2: (isLinear || !showCp2) ? null : kf.bezier?.cp2
            });
        }

        return curves;
    });

    const updateBezierAfterKeyframeMove = (kf, nextKf) => {
        if (!kf || !nextKf) return;
        if (!kf.bezier) return;

        // If _relativePos is missing, calculate it from current positions
        if (!kf.bezier._relativePos) {
            const dt = nextKf.time - kf.time || 1;
            kf.bezier._relativePos = {
                cp1: {
                    t: kf.bezier.cp1 ? (kf.bezier.cp1.time - kf.time) / dt : 0.33,
                    v: kf.bezier.cp1 ? kf.bezier.cp1.value : 0.33
                },
                cp2: {
                    t: kf.bezier.cp2 ? (kf.bezier.cp2.time - kf.time) / dt : 0.66,
                    v: kf.bezier.cp2 ? kf.bezier.cp2.value : 0.66
                }
            };
        }

        const dt = nextKf.time - kf.time || 1;

        // Apply saved relative positions
        if (kf.bezier.cp1) {
            kf.bezier.cp1.time = kf.time + dt * kf.bezier._relativePos.cp1.t;
            kf.bezier.cp1.value = kf.bezier._relativePos.cp1.v;
        }

        if (kf.bezier.cp2) {
            kf.bezier.cp2.time = kf.time + dt * kf.bezier._relativePos.cp2.t;
            kf.bezier.cp2.value = kf.bezier._relativePos.cp2.v;
        }
    };



    const initializeBezierForKeyframe = (kf, nextKf) => {
        if (!kf || !nextKf) return;

        const dt = nextKf.time - kf.time || 1;
        const ease = kf.ease || 'linear';

        const easePresets = {
            'linear': { cp1: { t: 0.33, v: 0.33 }, cp2: { t: 0.66, v: 0.66 } },
            'ease-in': { cp1: { t: 0.42, v: 0 }, cp2: { t: 1.0, v: 1.0 } },
            'ease-out': { cp1: { t: 0, v: 0 }, cp2: { t: 0.58, v: 1.0 } },
            'ease-in-out': { cp1: { t: 0.42, v: 0 }, cp2: { t: 0.58, v: 1.0 } }
        };

        const preset = easePresets[ease] || easePresets['linear'];

        // Always create bezier structure with both control points
        kf.bezier = {
            cp1: {
                time: kf.time + dt * preset.cp1.t,
                value: preset.cp1.v
            },
            cp2: {
                time: kf.time + dt * preset.cp2.t,
                value: preset.cp2.v
            },
            _relativePos: {
                cp1: { t: preset.cp1.t, v: preset.cp1.v },
                cp2: { t: preset.cp2.t, v: preset.cp2.v }
            }
        };
    };

    const bezierToSVGCoords = (cp) => {
        if (!cp) return { x: 0, y: 0 };

        const curveHeight = props.config.height * 0.25;
        const baseY = props.config.height * 0.75;

        const x = (cp.time * props.config.zoomLevel.current) + props.config.padding;
        const y = baseY - (cp.value * curveHeight);

        return { x, y };
    };

    const easingFunctions = {
        linear: (t) => t,
        'ease-in': (t) => t * t,
        'ease-out': (t) => t * (2 - t),
        'ease-in-out': (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    };

    const applyBezierEasing = (factor, cp1, cp2) => {
        const cubicBezier = (t, p0, p1, p2, p3) => {
            const u = 1 - t;
            return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
        };

        return cubicBezier(factor, 0, cp1.value, cp2.value, 1);
    };

    const applyEasing = (factor, easeType, bezier) => {
        if (easeType === 'linear') {
            return factor;
        }

        if (bezier?.cp1 && bezier?.cp2) {
            return applyBezierEasing(factor, bezier.cp1, bezier.cp2);
        }

        const easeFn = easingFunctions[easeType] || easingFunctions.linear;
        return easeFn(factor);
    };

    const onWheel = async (e) => {
        const oldZoom = props.config.zoomLevel.current;
        const delta = e.deltaY;
        const factor = Math.exp(-delta * 0.0025);

        const newZoom = Math.min(props.config.zoomLevel.max, Math.max(props.config.zoomLevel.min, props.config.zoomLevel.current * factor));

        emitEvent('timeline:zoom', newZoom);

        await nextTick(() => {
            if (!wrapper.value || !timeline.value) return;
            const rect = timeline.value.getBoundingClientRect();
            const pointerX = e.clientX - rect.left;
            const logicalTime = (pointerX - props.config.padding) / oldZoom;
            const newPointerX = (logicalTime * props.config.zoomLevel.current) + props.config.padding;
            const scrollDelta = newPointerX - pointerX;
            wrapper.value.scrollLeft += scrollDelta;
        });
    }


    const findControlPointAt = (x, y, radius = 15) => {
        if (!bezierModeEnabled.value) return null;

        for (const curve of curveSegments.value) {
            if (!curve.isSelected || curve.isLinear) continue;

            // Check cp1 only if it should be shown
            if (curve.showCp1 && curve.cp1) {
                const cp1Pos = bezierToSVGCoords(curve.cp1);
                const dx1 = x - cp1Pos.x;
                const dy1 = y - cp1Pos.y;
                if (Math.sqrt(dx1 * dx1 + dy1 * dy1) < radius) {
                    return { curve, point: 'cp1' };
                }
            }

            // Check cp2 only if it should be shown
            if (curve.showCp2 && curve.cp2) {
                const cp2Pos = bezierToSVGCoords(curve.cp2);
                const dx2 = x - cp2Pos.x;
                const dy2 = y - cp2Pos.y;
                if (Math.sqrt(dx2 * dx2 + dy2 * dy2) < radius) {
                    return { curve, point: 'cp2' };
                }
            }
        }
        return null;
    };

    const onKFPointerDown = async (frame, evt) => {
        if (!timeline.value) return;

        // Priority 1: Check if clicking on a control point (in bezier mode)
        if (bezierModeEnabled.value) {
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

                try {
                    timeline.value.setPointerCapture(evt.pointerId);
                } catch (e) {
                    console.warn('Failed to capture pointer:', e);
                }

                window.addEventListener("pointermove", onCPPointerMove);
                window.addEventListener("pointerup", onCPPointerUp);
                return;
            }
        }

        // Priority 2: Handle keyframe selection
        if (frame) {
            let data = [...props.config.selectedKeyframes];
            const index = data.findIndex(id => id === frame.id);

            if (evt.ctrlKey || evt.shiftKey) {
                if (index === -1) {
                    data.push(frame.id);
                } else {
                    data.splice(index, 1);
                }
            } else {
                if (index === -1) {
                    data = [frame.id];
                }
            }

            emitEvent('timeline:select-keyframes', data);
        }

        // Priority 3: Start keyframe dragging
        if (!props.selectState || (!evt.ctrlKey && !evt.shiftKey)) {
            selectedId.value = frame.id;
            pointerId.value = evt.pointerId;
            dragging.value = { id: frame.id, startX: evt.clientX, origTime: frame.time };

            try {
                timeline.value.setPointerCapture(pointerId.value);
            } catch (e) {
                console.warn('Failed to capture pointer:', e);
            }

            window.addEventListener("pointermove", onKFPointerMove);
            window.addEventListener("pointerup", onKFPointerUp);
        }
    }

    const onCPPointerMove = async (ev) => {
        if (!draggedControlPoint.value || !timeline.value) return;

        ev.preventDefault();
        ev.stopPropagation();

        const rect = timeline.value.getBoundingClientRect();
        const scrollLeft = wrapper.value ? wrapper.value.scrollLeft : 0;

        // Direct calculation without offset - simpler and more reliable
        const x = ev.clientX - rect.left + scrollLeft;
        const y = ev.clientY - rect.top;

        const { curve, point } = draggedControlPoint.value;
        const { start, end } = curve;

        const curveHeight = props.config.height * 0.25;
        const baseY = props.config.height * 0.75;

        // Convert to time/value - constrain to segment boundaries
        const time = Math.max(start.time, Math.min(end.time, (x - props.config.padding) / props.config.zoomLevel.current));
        const value = Math.max(0, Math.min(1, (baseY - y) / curveHeight));

        // CRITICAL: Find and update the ORIGINAL keyframe in props.config.keyframes
        const originalKf = props.config.keyframes.find(k => k.id === start.id);

        if (originalKf) {
            // Ensure bezier structure exists
            if (!originalKf.bezier) {
                originalKf.bezier = {
                    cp1: { time: start.time, value: 0 },
                    cp2: { time: end.time, value: 1 },
                    _relativePos: {
                        cp1: { t: 0.33, v: 0.33 },
                        cp2: { t: 0.66, v: 0.66 }
                    }
                };
            }

            // Ensure the control point exists
            if (!originalKf.bezier[point]) {
                originalKf.bezier[point] = { time: start.time, value: 0 };
            }

            // Update the actual keyframe bezier data
            originalKf.bezier[point].time = time;
            originalKf.bezier[point].value = value;

            // Update relative position for when keyframes move
            const dt = end.time - start.time || 1;
            const relT = (time - start.time) / dt;

            if (!originalKf.bezier._relativePos) {
                originalKf.bezier._relativePos = {
                    cp1: { t: 0.33, v: 0.33 },
                    cp2: { t: 0.66, v: 0.66 }
                };
            }

            originalKf.bezier._relativePos[point] = { t: relT, v: value };

            // Force update the curve reference for immediate visual feedback
            if (curve[point]) {
                curve[point].time = time;
                curve[point].value = value;
            }
        }
    };

    const onCPPointerUp = async (ev) => {
        if (!timeline.value || !cpPointerId.value) return;

        ev.preventDefault();
        ev.stopPropagation();

        try {
            timeline.value.releasePointerCapture(cpPointerId.value);
        } catch (e) {
            // Ignore if not captured
        }

        window.removeEventListener("pointermove", onCPPointerMove);
        window.removeEventListener("pointerup", onCPPointerUp);

        // Emit the updated keyframes to persist changes
        emitEvent('timeline:keyframes', props.config.keyframes);

        draggedControlPoint.value = null;
        cpPointerId.value = null;

        // Recalculate interpolation
        await nextTick();
        await interpolateAtCurrentTime();
    };

    const onKFPointerMove = async (ev) => {
        if (!dragging.value || !timeline.value) return;

        const rect = timeline.value.getBoundingClientRect();
        const scrollLeft = wrapper.value ? wrapper.value.scrollLeft : 0;
        const xInSvg = ev.clientX - rect.left + scrollLeft;
        const newTime = Math.max(0, (xInSvg - props.config.padding) / props.config.zoomLevel.current);

        const k = props.config.keyframes.find(kf => kf.id === dragging.value.id);
        if (k) {
            k.time = Math.round(newTime);

            if (props.recordState && props.config._current) {
                k.transform = JSON.parse(JSON.stringify(props.config._current));
            }

            await interpolateAtCurrentTime();
        }
    }

    const onKFPointerUp = async () => {
        if (!timeline.value || !pointerId.value) return;

        try {
            timeline.value.releasePointerCapture(pointerId.value);
        } catch (e) {
            // Ignore if not captured
        }

        window.removeEventListener("pointermove", onKFPointerMove);
        window.removeEventListener("pointerup", onKFPointerUp);
        dragging.value = null;
        pointerId.value = null;
        emitEvent('timeline:keyframes', props.config.keyframes)
    }

    const normalizeKeyframes = async () => {
        keyframes.value.forEach((k) => {
            k.time = typeof k.time === "string" ? parseFloat(k.time) || 0 : (k.time || 0);
        });
        await nextTick();
        emitEvent('timeline:keyframes', keyframes.value)
    }

    const interpolateAtCurrentTime = async () => {
        const t = props.config.time;
        const frames = keyframes.value.sort((a,b) => a.time - b.time);

        if (frames.length === 0) {
            props.config._current = {};
            return;
        }

        let left = frames[0], right = frames[frames.length - 1];
        for (let i = 0; i < frames.length - 1; i++) {
            if (t >= frames[i].time && t <= frames[i+1].time) {
                left = frames[i];
                right = frames[i+1];
                break;
            }
        }

        if (t === left.time) {
            props.config._current = JSON.parse(JSON.stringify(left.transform || {}));
            return;
        }

        const dt = right.time - left.time || 1;
        let factor = (t - left.time) / dt;

        const easeType = left.ease || 'linear';
        factor = applyEasing(factor, easeType, left.bezier);

        const current = {};
        const start = left.transform || {};
        const end = right.transform || {};
        const keys = new Set([...Object.keys(start), ...Object.keys(end)]);

        keys.forEach(k => {
            const a = start[k], b = end[k];
            if (typeof a === "number" && typeof b === "number") {
                current[k] = a + (b - a) * factor;
            } else {
                current[k] = a !== undefined ? a : b;
            }
        });

        props.config._current = current;
    }

    const onAddKey = async () => {
        const t = Math.round(props.config.time);
        const existing = keyframes.value.find(k => k.time === t);
        if (existing) return;

        const data = [...keyframes.value];
        const newKF = {
            time: t,
            transform: {},
            id: uuid(),
            ease: 'linear',
            bezier: null,
            connection: []
        };

        data.push(newKF);
        emitEvent('timeline:keyframes', data)
        await recompute();
    }

    const onDeleteKey = async () => {
        if (selectedKeys.value.length > 0) {
            const data = keyframes.value.filter(k => !selectedKeys.value.includes(k.id));
            emitEvent('timeline:keyframes', data);
            emitEvent('timeline:select-keyframes', []);
        } else {
            const t = Math.round(props.config.time);
            const idx = keyframes.value.findIndex(k => k.time === t);
            const data = [...keyframes.value];
            if (idx !== -1) data.splice(idx, 1);
            emitEvent('timeline:keyframes', data);
        }
        await recompute();
    }

    const onMultiSelect = (box) => {
        if (!timeline.value) return;

        const scrollLeft = wrapper.value ? wrapper.value.scrollLeft : 0;
        const selectedIds = [];

        if(box) {
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

                if (inside) {
                    selectedIds.push(frame.id);
                }
            });

            emitEvent('timeline:select-keyframes', selectedIds);
        } else {
            emitEvent('timeline:select-keyframes', []);
        }
    }

    const onFrameForward = async () => {
        const newTime = Math.min(totalTime.value, props.config.time + 1);
        emitEvent('timeline:time', newTime);
        await interpolateAtCurrentTime();
    }

    const onFrameBack = async () => {
        const newTime = Math.max(0, props.config.time - 1);
        emitEvent('timeline:time', newTime);
        await interpolateAtCurrentTime();
    }

    const onSkipToEnd = async () => {
        emitEvent('timeline:time', totalTime.value);
        await interpolateAtCurrentTime();
    }

    const onTimeInput = async (newTime) => {
        const time = Math.max(0, Math.min(totalTime.value, Math.round(newTime)));
        emitEvent('timeline:time', time);
        await interpolateAtCurrentTime();
    }

    const onToggleRecord = async () => {
        emitEvent('timeline:record', !props.recordState);

        if (props.recordState && props.config._current) {
            const t = Math.round(props.config.time);
            const existingKF = keyframes.value.find(k => k.time === t);

            if (existingKF) {
                existingKF.transform = JSON.parse(JSON.stringify(props.config._current));
                emitEvent('timeline:keyframes', props.config.keyframes);
            }
        }
    }

    const onToggleSelectMode = async () => {
        emitEvent('select-state', !props.selectState);
        emitEvent('select-state:items', !props.selectState);
        emitEvent('timeline:select-keyframes', []);
    }

    const onTogglePlay = async () => {
        if (props.playState) {
            await onPause();
        } else {
            await onPlay();
        }
    }

    const onPlay = async () => {
        if (!props.playState) await startRAF();
    }

    const onPause = async () => {
        emitEvent('timeline:play', false);
        emitEvent('timeline:time', props.config.time);
        if (rafId.value) {
            cancelAnimationFrame(rafId.value);
            rafId.value = null;
        }
    }

    const onStop = async () => {
        await onPause();
        emitEvent('timeline:time', 0);
        await interpolateAtCurrentTime();
    }

    const startRAF = async () => {
        if (rafId.value) cancelAnimationFrame(rafId.value);
        playStartTimestamp.value = performance.now();
        playOffset.value = props.config.time;
        emitEvent('timeline:play', true);

        function step(now) {
            if (!props.playState) return;

            const elapsed = now - playStartTimestamp.value;
            const newTime = Math.round(playOffset.value + elapsed * 0.06);

            if (newTime >= totalTime.value) {
                emitEvent('timeline:time', totalTime.value);
                emitEvent('timeline:play', false);
                if (rafId.value) {
                    cancelAnimationFrame(rafId.value);
                    rafId.value = null;
                }
                return;
            }

            emitEvent('timeline:time', newTime);
            rafId.value = requestAnimationFrame(step);
        }

        rafId.value = requestAnimationFrame(step);
    }


    const onEaseChange = async (easeType) => {
        if (selectedKeys.value.length === 0) return;

        // Work directly with original keyframes
        const originalKeyframes = props.config.keyframes;

        selectedKeys.value.forEach(selectedId => {
            const idx = originalKeyframes.findIndex(k => k.id === selectedId);
            if (idx === -1) return;

            const k = originalKeyframes[idx];
            k.ease = easeType;

            // If changing to linear, clear bezier
            if (easeType === 'linear') {
                k.bezier = null;
            } else {
                // Initialize bezier for this keyframe if it has a next keyframe
                if (idx < originalKeyframes.length - 1) {
                    const nextKf = originalKeyframes[idx + 1];
                    initializeBezierForKeyframe(k, nextKf);
                }
            }
        });

        emitEvent('timeline:keyframes', originalKeyframes);
        await nextTick();
        await interpolateAtCurrentTime();
    }

    const onToggleBezierMode = () => {
        bezierModeEnabled.value = !bezierModeEnabled.value;
    };

    const recompute = async () => {
        await normalizeKeyframes();
        await interpolateAtCurrentTime();
    }

    const init = async () => {
        wrapper.value = document.getElementById(props.wrapperId);
        timeline.value = document.getElementById(props.config.id);
    }

    const getSelectedEase = () => {
        if (selectedKeys.value.length === 0) return 'linear';
        const firstSelected = keyframes.value.find(k => k.id === selectedKeys.value[0]);
        return firstSelected?.ease || 'linear';
    };

    const getCurvePath = (curve) => {
        const startX = curve.start.left;
        const endX = curve.end.left;
        const curveHeight = props.config.height * 0.25;
        const baseY = props.config.height * 0.75;

        if (curve.isLinear || !curve.cp1 || !curve.cp2) {
            const startY = baseY;
            const endY = baseY - curveHeight;
            return `M ${startX} ${startY} L ${endX} ${endY}`;
        }

        const startY = baseY;
        const endY = baseY - curveHeight;
        const cp1 = bezierToSVGCoords(curve.cp1);
        const cp2 = bezierToSVGCoords(curve.cp2);

        return `M ${startX} ${startY} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${endX} ${endY}`;
    };

    onMounted(async () => {
        await init();
        await normalizeKeyframes();
    });

    return {
        timeline,
        width,
        keyframes,
        ticks,
        segments,
        playHead,
        selectedKeys,
        curveSegments,
        bezierModeEnabled,
        bezierToSVGCoords,
        onPlay,
        onPause,
        onStop,
        onTogglePlay,
        getSelectedEase,
        getCurvePath,
        onWheel,
        onAddKey,
        onDeleteKey,
        onMultiSelect,
        onKFPointerDown,
        onFrameForward,
        onFrameBack,
        onSkipToEnd,
        onTimeInput,
        onToggleRecord,
        onToggleSelectMode,
        onEaseChange,
        onToggleBezierMode,
        emitEvent
    };
}

export const timelineProps = {
    selectMenu: {
        type: Boolean,
        required: true,
    },
    selectState: {
        type: Boolean,
        required: true,
    },
    playState: {
        type: Boolean,
        required: true,
    },
    recordState: {
        type: Boolean,
        required: true,
    },
    wrapperId: {
        type: String,
        required: true,
    },
    config: {
        type: Object,
        required: true,
    },
    selectionBox: {
        type: Object,
        required: true,
    }
};