import { computed, ref, onBeforeUnmount } from "vue";

export function miniTimelineModel(props, emit) {
    const speed = ref(1);

    const rafId = ref(null);
    const startTs = ref(0);
    const offset = ref(0);

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    // -------------------------
    // Time Formatting
    // -------------------------
    const formatted = computed(() => {
        const f = Math.round(props.config.time);
        const s = (f / 60).toFixed(2);

        return {
            frames: `${f}f`,
            seconds: `${s}s`
        };
    });

    // -------------------------
    // Helpers
    // -------------------------
    const normalizePlaybackTime = (time, direction) => {
        const start = props.config.startTime;
        const end = props.config.endTime;
        const total = end - start;

        if (!props.config.loop) {
            return Math.max(Math.min(time, Math.max(start, end)), Math.min(start, end));
        }

        if (total > 0) {
            if (direction === "forward" && time > end) return start;
            if (direction === "backward" && time < start) return end;
        } else if (total < 0) {
            if (direction === "forward" && time < end) return start;
            if (direction === "backward" && time > start) return end;
        }

        return time;
    };

    // -------------------------
    // RAF LOOP
    // -------------------------

    const stopRAF = () => {
        if (rafId.value) {
            cancelAnimationFrame(rafId.value);
            rafId.value = null;
        }
    };

    const startRAF = () => {
        stopRAF();

        startTs.value = performance.now();
        offset.value = props.config.time;

        emitEvent("timeline:play", true);

        function step(now) {
            if (!props.playState) return;

            const elapsed = now - startTs.value;

            // 🔥 HIER: speed integriert
            let newTime = Math.round(
                offset.value + elapsed * 0.06 * speed.value
            );

            const start = props.config.startTime;
            const end = props.config.endTime;
            const total = end - start;

            if (total > 0) {
                if (newTime >= end) {
                    if (props.config.loop) {
                        startTs.value = now;
                        offset.value = start;
                        newTime = start;
                    } else {
                        emitEvent("timeline:time", end);
                        emitEvent("timeline:play", false);
                        stopRAF();
                        return;
                    }
                }
            } else if (total < 0) {
                if (newTime <= end) {
                    if (props.config.loop) {
                        startTs.value = now;
                        offset.value = start;
                        newTime = start;
                    } else {
                        emitEvent("timeline:time", end);
                        emitEvent("timeline:play", false);
                        stopRAF();
                        return;
                    }
                }
            }

            // 👉 KEIN interpolate hier → macht deine Haupt-Timeline!
            emitEvent("timeline:time", newTime);

            rafId.value = requestAnimationFrame(step);
        }

        rafId.value = requestAnimationFrame(step);
    };

    // -------------------------
    // Playback Controls
    // -------------------------
    const onPlay = () => {
        startRAF();
    };

    const onPause = () => {
        emitEvent("timeline:play", false);
        stopRAF();
    };

    const onStop = () => {
        stopRAF();
        emitEvent("timeline:play", false);
        emitEvent("timeline:time", props.config.startTime);
    };

    // -------------------------
    // Frame Controls
    // -------------------------
    const onFrameForward = () => {
        const t = normalizePlaybackTime(props.config.time + 1, "forward");
        emitEvent("timeline:time", t);
    };

    const onFrameBack = () => {
        const t = normalizePlaybackTime(props.config.time - 1, "backward");
        emitEvent("timeline:time", t);
    };

    const onSkipToStart = () => {
        emitEvent("timeline:time", props.config.startTime);
    };

    const onSkipToEnd = () => {
        emitEvent("timeline:time", props.config.endTime);
    };

    // -------------------------
    // Speed
    // -------------------------
    const speeds = [0.5, 1, 2, 4];

    const toggleSpeed = () => {
        const i = speeds.indexOf(speed.value);
        speed.value = speeds[(i + 1) % speeds.length];

        emitEvent("timeline:speed", speed.value);
    };

    const onClose = () => {
        emitEvent("mini-timeline:state", false);
        stopRAF();
    };

    onBeforeUnmount(() => {
        stopRAF();
    });

    return {
        speed,
        formatted,

        onClose,
        onPlay,
        onPause,
        onStop,
        onFrameForward,
        onFrameBack,
        onSkipToStart,
        onSkipToEnd,
        toggleSpeed
    };
}

export const miniTimelineProps = {
    state: { type: Boolean, required: true },
    config: { type: Object, required: true },
    playState: { type: Boolean, required: true },
    timeline: { type: Boolean, required: true }
};