import {computed, nextTick, onMounted, ref} from "vue";
import {uuid} from "@/utils/uuid";

export function timelineModel(props, emit) {

    const wrapper = ref(null);

    const timeline = ref(null);

    const dragging = ref(null);

    const selectedId = ref(null);

    const pointerId = ref(null);

    const playing = ref(false);

    const rafId = ref(null);

    const playStartTimestamp = ref(0);

    const playOffset = ref(0);

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
        // add cached left positions for convenience
        arr.forEach(k => { k.left = (k.time * props.config.zoomLevel.current) + props.config.padding; });
        // also attach _next pointer for seg drawing
        for (let i=0;i<arr.length-1;i++) arr[i]._next = arr[i+1];
        return arr;
    });

    // totalTime based on last keyframe or fixed
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
        // fallback to largest
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

    // segments for visualization between pairs
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

    // --- zoom handler
    const onWheel = async (e) => {
        const oldZoom = props.config.zoomLevel.current;
        const delta = e.deltaY;
        // zoom factor
        const factor = Math.exp(-delta * 0.0025);

        const newZoom = Math.min(props.config.zoomLevel.max, Math.max(props.config.zoomLevel.min, props.config.zoomLevel.current * factor));

        emitEvent('timeline:zoom', newZoom);

        // keep viewport centered on pointer position (so zoom feels natural)
        await nextTick(() => {
            if (!wrapper.value || !timeline.value) return;
            const rect = timeline.value.getBoundingClientRect();
            const pointerX = e.clientX - rect.left; // px inside svg before zoom
            // compute new scroll to keep same logical time under cursor
            const logicalTime = (pointerX - props.config.padding) / oldZoom;
            const newPointerX = (logicalTime * props.config.zoomLevel.current) + props.config.padding;
            const scrollDelta = newPointerX - pointerX;
            wrapper.value.scrollLeft += scrollDelta;
        });
    }

    const onKFPointerDown = async (frame, evt) => {
        selectedId.value = frame.id;
        pointerId.value = evt.pointerId;
        dragging.value = { id: frame.id, startX: evt.clientX, origTime: frame.time };
        // set pointer capture on SVG to continue receiving events
        timeline.value.setPointerCapture(pointerId.value);
        window.addEventListener("pointermove", onKFPointerMove);
        window.addEventListener("pointerup", onKFPointerUp);
    }

    const onKFPointerMove = async (ev) => {
        const rect = timeline.value.getBoundingClientRect();
        const scrollLeft = wrapper.value ? wrapper.value.scrollLeft : 0;
        const xInSvg = ev.clientX - rect.left + scrollLeft;
        const newTime = Math.max(0, (xInSvg - props.config.padding) / props.config.zoomLevel.current);
        // update the shared keyframe entry (find by id)
        const k = props.config.keyframes.find(kf => kf.id === dragging.value.id);
        if (k) {
            k.time = Math.round(newTime); // snap to integer frames
            // keep reactive sorting/interpolation updated
            await interpolateAtCurrentTime();
        }
    }
    const onKFPointerUp = async () => {
        timeline.value.releasePointerCapture(pointerId.value);
        window.removeEventListener("pointermove", onKFPointerMove);
        window.removeEventListener("pointerup", onKFPointerUp);
        dragging.value = null;
        pointerId.value = null;
        emitEvent('timeline:keyframes', props.config.keyframes)
    }

    const normalizeKeyframes = async () => {
        // convert string times to numbers if necessary
        keyframes.value.forEach((k) => {
            k.time = typeof k.time === "string" ? parseFloat(k.time) || 0 : (k.time || 0);
        });
        await nextTick();
        emitEvent('timeline:keyframes', keyframes.value)
    }


    // --- interpolation logic: compute numeric properties at current time
    // result: write to animationData._current (non-persistent, just preview)
    const interpolateAtCurrentTime = async () => {
        const t = props.config.time;
        const frames = keyframes.value.sort((a,b) => a.time - b.time);
        // find bracketing frames
        if (frames.length === 0) {
            props.config._current = {};
            return;
        }
        let left = frames[0], right = frames[frames.length - 1];
        for (let i = 0; i < frames.length - 1; i++) {
            if (t >= frames[i].time && t <= frames[i+1].time) { left = frames[i]; right = frames[i+1]; break; }
        }
        // if exact at a keyframe, use it
        if (t === left.time) {
            props.config._current = JSON.parse(JSON.stringify(left.transform || {}));
            return;
        }
        const dt = right.time - left.time || 1;
        const factor = (t - left.time) / dt;
        // linear interpolate numeric props present in both
        const current = {};
        const start = left.transform || {};
        const end = right.transform || {};
        const keys = new Set([...Object.keys(start), ...Object.keys(end)]);
        keys.forEach(k => {
            const a = start[k], b = end[k];
            if (typeof a === "number" && typeof b === "number") {
                current[k] = a + (b - a) * factor;
            } else {
                // fallback: pick nearest (left)
                current[k] = a !== undefined ? a : b;
            }
        });
        props.config._current = current;
    }

    const onAddKey = async () => {
        const t = Math.round(props.config.time);
        const existing = keyframes.value.find(k => k.time === t);
        if (existing) return; // keine doppelten Zeitpunkte

        const data = [
            ...keyframes.value
        ]
        const newKF = {
            time: t,
            transform: {},
            id: uuid(),
            ease: props.config.ease,
            connection: []
        };

        data.push(newKF);
        emitEvent('timeline:keyframes', data)
        await recompute();
    }

    const onDeleteKey = async () => {
        const t = Math.round(props.config.time);
        const idx = keyframes.value.findIndex(k => k.time === t);
        const data = [
            ...keyframes.value
        ]
        if (idx !== -1) data.splice(idx, 1);
        emitEvent('timeline:keyframes', data)
        await recompute();
    }

    const onMultiSelect = async (box) => {
        const rect = timeline.value.getBoundingClientRect();
        emitEvent('timeline:select', null);

        if(box) {
            keyframes.value.forEach(frame => {
                const data = [];
                const frameX = frame.left;
                const frameY = props.config.height * 0.5; // zentriert
                const inside =
                    frameX >= box.x - rect.left &&
                    frameX <= box.x - rect.left + box.width &&
                    frameY >= box.y - rect.top &&
                    frameY <= box.y - rect.top + box.height;

                if (inside) {
                    data.push(frame.id);
                    emitEvent('timeline:select-keyframes', data);
                }
            });
        }
    }

    const onPlay = async () => {
        if (!playing.value) await startRAF();
    }
    const onPause = async () => {
        playing.value = false;
        emitEvent('timeline:time', props.config.time)
        if (rafId.value) {
            cancelAnimationFrame(rafId.value);
            rafId.value = null;
        }
    }

    const onStop = async () => {
        await onPause();
        emitEvent('timeline:time', 0)
        await interpolateAtCurrentTime();
    }

    // --- playback controls
    const startRAF = async () => {
        if (rafId.value) cancelAnimationFrame(rafId.value);
        playStartTimestamp.value = performance.now();
        playOffset.value = props.config.time;
        playing.value = true;
        function step(now) {
            const elapsed = now - playStartTimestamp.value;
            props.config.time = Math.round(playOffset.value + elapsed * 0.06); // map ms->frames (example: 0.06 => 60fps -> 1 frame per ~16ms). adjust to your unit
            // stop at end
            if (props.config.time >= totalTime.value) {
                props.config.time = totalTime.value;
                playing.value = false;
                cancelAnimationFrame(rafId);
                rafId.value = null;
                return;
            }
            rafId.value = requestAnimationFrame(step);
        }
        rafId.value = requestAnimationFrame(step);
    }

    // small helper to recompute interpolation when keyframes move
    const recompute = async () => {
        await normalizeKeyframes();
        await interpolateAtCurrentTime();
    }

    const init = async () => {
        wrapper.value = document.getElementById(props.wrapperId);
        timeline.value = document.getElementById(props.config.id)
    }


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
        onPlay,
        onPause,
        onStop,
        onWheel,
        onAddKey,
        onDeleteKey,
        onKFPointerDown,
        onMultiSelect,
        emitEvent
    };
}


export const timelineProps = {
    state: {
        type: Boolean,
        required: true,
    },
    selectState: {
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
