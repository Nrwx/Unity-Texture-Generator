import { uuid } from "@/utils/uuid";

export const timelineEvent = (route) => ({

    /* ───────────────── TIMELINE CORE ───────────────── */

    "timeline:id": async (id) => {
        route.timelineData.value.id = id;
    },

    "timeline:time": async (time) => {
        route.timelineData.value.time = time;
    },

    "timeline:zoom": async (zoom) => {
        route.timelineData.value.zoomLevel.current = zoom;
    },

    "timeline:padding": async (padding) => {
        route.timelineData.value.padding = padding;
    },

    "timeline:width": async (width) => {
        route.timelineData.value.width = width;
    },

    "timeline:endTime": async (endTime) => {
        route.timelineData.value.endTime = endTime;
    },
    "timeline:keyframes": async (keyframes) => {
        route.timelineData.value.keyframes = keyframes;
    },


    /* ───────────────── KEYFRAMES (CREATE / UPDATE) ───────────────── */

    /**
     * Create keyframe(s) at current time
     * Triggered by:
     * - Add-Key Button
     * - Track manipulation end
     */
    "timeline:set-keyframe": async () => {
        const time = route.timelineData.value.time;

        route.localData.selectedLayer.value.forEach(layer => {
            if (!layer) return;

            if (!Array.isArray(layer.keyframes)) {
                layer.keyframes = [];
            }

            let kf = layer.keyframes.find(k => k.time === time);

            if (kf) {
                kf.opacity = layer.opacity;
                kf.matrix = structuredClone(layer.matrix);
                kf.width = layer.width;
                kf.height = layer.height;

            } else {
                layer.keyframes.push({
                    id: uuid("keyframe"),
                    time,

                    opacity: layer.opacity,
                    matrix: structuredClone(layer.matrix),
                    width: layer.width,
                    height: layer.height,

                    ease: "linear",
                    bezier: null
                });

                layer.keyframes.sort((a, b) => a.time - b.time);
            }
        });
    },

    /**
     * Move keyframe in time (drag)
     * Timeline only calculates new time
     */
    "timeline:move-keyframe": async ({ keyframeId, time, record }) => {
        route.localData.selectedLayer.value.forEach(layer => {
            const kf = layer.keyframes?.find(k => k.id === keyframeId);
            if (!kf) return;

            kf.time = time;

            // auto-record snapshot while dragging
            if (record) {
                kf.opacity = layer.opacity;
                kf.matrix = structuredClone(layer.matrix);
                kf.width = layer.width;
                kf.height = layer.height;
            }

            layer.keyframes.sort((a, b) => a.time - b.time);
        });
    },

    /**
     * Delete keyframe(s)
     */
    "timeline:delete-keyframe": async ({ keyframeIds, time }) => {
        route.localData.selectedLayer.value.forEach(layer => {
            if (!Array.isArray(layer.keyframes)) return;

            if (keyframeIds?.length) {
                layer.keyframes = layer.keyframes.filter(
                    k => !keyframeIds.includes(k.id)
                );
            } else if (time !== undefined) {
                layer.keyframes = layer.keyframes.filter(
                    k => k.time !== time
                );
            }
        });

        route.timelineData.value.selectedKeyframes = [];
    },


    /* ───────────────── INTERPOLATION DATA ───────────────── */

    /**
     * Change ease type on selected keyframes
     */
    "timeline:update-keyframe-ease": async ({ keyframeIds, ease }) => {
        route.localData.selectedLayer.value.forEach(layer => {
            layer.keyframes?.forEach(kf => {
                if (!keyframeIds.includes(kf.id)) return;
                kf.bezier = null;
                kf.ease = ease;
            });
        });
    },

    /**
     * Update bezier control point
     */
    "timeline:update-bezier": async ({ keyframeId, point, time, value }) => {
        route.localData.selectedLayer.value.forEach(layer => {
            const kf = layer.keyframes?.find(k => k.id === keyframeId);
            if (!kf) return;

            if (!kf.bezier) {
                kf.bezier = {
                    cp1: { time: kf.time, value: 0 },
                    cp2: { time: kf.time, value: 1 },
                    _relativePos: {}
                };
            }

            kf.bezier[point] = { time, value };
        });
    },


    /* ───────────────── TRACK MANIPULATION ───────────────── */

    /**
     * Track drag finished
     * → create/update keyframe from layer state
     */
    "timeline:update-track": async ({ time, layers }) => {
        layers.forEach(item => {
            const layer = route.localData.layers.value.find(l => l.id === item.id);
            if (!layer) return;

            if (!Array.isArray(layer.keyframes)) {
                layer.keyframes = [];
            }

            let kf = layer.keyframes.find(k => k.time === time);

            if (!kf) {
                kf = {
                    id: uuid("keyframe"),
                    time,
                    opacity: layer.opacity,
                    matrix: structuredClone(item.matrix),
                    ease: "linear",
                    bezier: null
                };
                layer.keyframes.push(kf);
                layer.keyframes.sort((a, b) => a.time - b.time);
            } else {
                kf.matrix = structuredClone(item.matrix);
            }

            route.emit("update-layer", layer);
        });
    },


    /* ───────────────── SELECTION & STATE ───────────────── */

    "timeline:select-keyframes": async (ids) => {
        route.timelineData.value.selectedKeyframes = ids;
    },

    "timeline:record": async (state) => {
        route.timelineStates.record.value = state;
    },

    "timeline:play": async (state) => {
        route.timelineStates.play.value = state;
    },

    "timeline:sidebar": async (state) => {
        route.timelineStates.sidebar.value = state;
        console.log(state)
    },

    "timeline:bezier": async (state) => {
        route.timelineStates.bezier.value = state;
        console.log(state)
    },

    /**
     * Live record snapshot (per frame)
     */
    "timeline-record": async (payload) => {
        route.timelineData.value._record = payload;
    }
});
