// view/models/page/animation/model.js
import { ref, computed, watch, nextTick } from "vue";
import { animationData as sharedAnimationData } from "@/dataLayer/local"; // deine zentrale Datenquelle

export function animationModel(props, emit) {
    // --- state & refs
    const animationData = sharedAnimationData; // erwartet: { time: ref(0), keyframe: ref([...]), ease: ref('linear') }
    const wrapperRef = ref(null);
    const timelineBar = ref(null); // SVG element
    const timelineHeight = 200;
    const zoomLevel = ref(1); // px per time unit (frame)
    const minZoom = 0.2;
    const maxZoom = 6;
    const wrapperPadding = 40;
    const selectedId = ref(null);

    // playback
    let rafId = null;
    let playStartTimestamp = 0;
    let playOffset = 0;
    const playing = ref(false);

    const emitEvent = (event, payload) => emit("component-event", event, payload);

    // --- utility: ensure numeric time
    function normalizeKeyframes() {
        // convert string times to numbers if necessary
        animationData.keyframe.value.forEach((k) => {
            k.time = typeof k.time === "string" ? parseFloat(k.time) || 0 : (k.time || 0);
        });
    }
    normalizeKeyframes();

    // --- derived values
    const keyframes = computed(() => animationData.keyframe.value || []);
    const sortedKeyframes = computed(() => {
        const arr = keyframes.value.map(k => Object.assign({}, k));
        arr.sort((a,b) => a.time - b.time);
        // add cached left positions for convenience
        arr.forEach(k => { k.left = (k.time * zoomLevel.value) + wrapperPadding; });
        // also attach _next pointer for seg drawing
        for (let i=0;i<arr.length-1;i++) arr[i]._next = arr[i+1];
        return arr;
    });

    // totalTime based on last keyframe or fixed
    const totalTime = computed(() => {
        const last = sortedKeyframes.value[sortedKeyframes.value.length - 1];
        return Math.max(200, last ? last.time + 50 : 200);
    });

    const svgWidth = computed(() => Math.max(1200, totalTime.value * zoomLevel.value + wrapperPadding * 2));
    const playheadX = computed(() => (animationData.time.value * zoomLevel.value) + wrapperPadding);

    // ticks calculation with "nice" intervals depending on zoom
    const ticks = computed(() => {
        // choose intervals from array based on zoom
        const candidates = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200];
        // want approx px per tick between 60..180
        const targetPx = 100;
        let chosen = 1;
        for (const c of candidates) {
            if (c * zoomLevel.value >= targetPx) { chosen = c; break; }
        }
        // fallback to largest
        if (chosen === 1 && candidates[candidates.length-1] * zoomLevel.value < targetPx) chosen = candidates[candidates.length-1];

        const ticksArr = [];
        const tMax = Math.ceil(totalTime.value / chosen) * chosen;
        for (let t = 0; t <= tMax; t += chosen) {
            const left = (t * zoomLevel.value) + wrapperPadding;
            const major = (Math.round(t / chosen) % (chosen >= 10 ? 1 : (chosen >= 1 ? 5 : 10)) ) === 0;
            ticksArr.push({ time: t, left, major });
        }
        return ticksArr;
    });

    // segments for visualization between pairs
    const segments = computed(() => {
        const segs = [];
        const arr = sortedKeyframes.value;
        for (let i = 0; i < arr.length - 1; i++) {
            const left = arr[i].left;
            const width = Math.max(2, arr[i+1].left - arr[i].left);
            segs.push({ left, width, color: i % 2 === 0 ? '#9153a1' : '#2b8cff' });
        }
        return segs;
    });

    // diamond shape points (centered on 0,0)
    const diamondPoints = "-6,0 0,-8 6,0 0,8";

    // --- zoom handler
    async function zoomTimeline(e) {
        const oldZoom = zoomLevel.value;
        const delta = e.deltaY;
        // zoom factor
        const factor = Math.exp(-delta * 0.0025);
        zoomLevel.value = Math.min(maxZoom, Math.max(minZoom, zoomLevel.value * factor));

        // keep viewport centered on pointer position (so zoom feels natural)
        await nextTick(() => {
            const wrapper = wrapperRef.value;
            const svg = timelineBar.value;
            if (!wrapper || !svg) return;
            const rect = svg.getBoundingClientRect();
            const pointerX = e.clientX - rect.left; // px inside svg before zoom
            // compute new scroll to keep same logical time under cursor
            const logicalTime = (pointerX - wrapperPadding) / oldZoom;
            const newPointerX = (logicalTime * zoomLevel.value) + wrapperPadding;
            const scrollDelta = newPointerX - pointerX;
            wrapper.scrollLeft += scrollDelta;
        });
    }

    // --- dragging keyframes (pointer events)
    let dragging = null;
    function onKFPointerDown(frame, evt) {
        selectedId.value = frame.id;
        const pointerId = evt.pointerId;
        dragging = { id: frame.id, startX: evt.clientX, origTime: frame.time };
        // set pointer capture on SVG to continue receiving events
        const svg = timelineBar.value;
        svg.setPointerCapture(pointerId);
        function moveHandler(ev) {
            const wrapper = wrapperRef.value;
            const rect = svg.getBoundingClientRect();
            const scrollLeft = wrapper ? wrapper.scrollLeft : 0;
            const xInSvg = ev.clientX - rect.left + scrollLeft;
            const newTime = Math.max(0, (xInSvg - wrapperPadding) / zoomLevel.value);
            // update the shared keyframe entry (find by id)
            const k = animationData.keyframe.value.find(kf => kf.id === dragging.id);
            if (k) {
                k.time = Math.round(newTime); // snap to integer frames
                // keep reactive sorting/interpolation updated
                interpolateAtCurrentTime();
            }
        }
        function upHandler() {
            svg.releasePointerCapture(pointerId);
            window.removeEventListener("pointermove", moveHandler);
            window.removeEventListener("pointerup", upHandler);
            dragging = null;
        }
        window.addEventListener("pointermove", moveHandler);
        window.addEventListener("pointerup", upHandler);
    }

    // --- interpolation logic: compute numeric properties at current time
    // result: write to animationData._current (non-persistent, just preview)
    function interpolateAtCurrentTime() {
        const t = animationData.time.value;
        const frames = [...animationData.keyframe.value].sort((a,b) => a.time - b.time);
        // find bracketing frames
        if (frames.length === 0) {
            animationData._current = {};
            return;
        }
        let left = frames[0], right = frames[frames.length - 1];
        for (let i = 0; i < frames.length - 1; i++) {
            if (t >= frames[i].time && t <= frames[i+1].time) { left = frames[i]; right = frames[i+1]; break; }
        }
        // if exact at a keyframe, use it
        if (t === left.time) {
            animationData._current = JSON.parse(JSON.stringify(left.transform || {}));
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
        animationData._current = current;
    }

    // watch time changes to update interpolation
    watch(() => animationData.time.value, () => {
        interpolateAtCurrentTime();
    }, { immediate: true });

    // --- playback controls
    function startRAF() {
        if (rafId) cancelAnimationFrame(rafId);
        playStartTimestamp = performance.now();
        playOffset = animationData.time.value;
        playing.value = true;
        function step(now) {
            const elapsed = now - playStartTimestamp;
            animationData.time.value = Math.round(playOffset + elapsed * 0.06); // map ms->frames (example: 0.06 => 60fps -> 1 frame per ~16ms). adjust to your unit
            // stop at end
            if (animationData.time.value >= totalTime.value) {
                animationData.time.value = totalTime.value;
                playing.value = false;
                cancelAnimationFrame(rafId);
                rafId = null;
                return;
            }
            rafId = requestAnimationFrame(step);
        }
        rafId = requestAnimationFrame(step);
    }
    function play() { if (!playing.value) startRAF(); }
    function pause() { playing.value = false; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
    function stop() { pause(); animationData.time.value = 0; interpolateAtCurrentTime(); }

    // small helper to recompute interpolation when keyframes move
    function recompute() {
        normalizeKeyframes();
        interpolateAtCurrentTime();
    }

    // expose
    return {
        animationData,
        wrapperRef,
        timelineBar,
        timelineHeight,
        zoomLevel,
        svgWidth,
        ticks,
        sortedKeyframes,
        diamondPoints,
        playheadX,
        play,
        pause,
        stop,
        zoomTimeline,
        emitEvent,
        onKFPointerDown,
        selectedId,
        segments,
        recompute,
    };
}

export const animationProps = {};
