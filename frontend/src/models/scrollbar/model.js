import { onBeforeUnmount, onMounted, ref } from "vue";
import { uuid } from "@/utils/uuid";
import { eventRegister } from "@/dataLayer/event";

export function scrollbarModel(props, emit) {
    const componentId = ref(uuid());
    const el = ref(null);
    const tr = ref(null);
    const th = ref(null);

    const trId = ref(uuid());
    const thId = ref(uuid());

    const active = ref(false);
    const wvActive = ref(false);
    const isDrag = ref(false);

    // RAF state
    const rafId = ref(null);
    const lastActivity = ref(0);
    const hideDelay = 450;
    const isLoopRunning = ref(false);
    const lastPointerPosition = ref(0);
    const approachDistance = () => 34;
    const isWheelScrolling = ref(false);
    const wheelTimer = ref(null);

    const isHorizontal = () => props.mode === "horizontal";

    const emitEvent = (event, payload) =>
        emit("component-event", event, payload);

    const { register } = eventRegister(
        `listener:scrollbar-${componentId.value}`,
        emitEvent
    );

    const getClientSize = target => {
        return isHorizontal()
            ? target.clientWidth
            : target.clientHeight;
    };

    const getScrollSize = target => {
        return isHorizontal()
            ? target.scrollWidth
            : target.scrollHeight;
    };

    const getScrollPosition = target => {
        return isHorizontal()
            ? target.scrollLeft
            : target.scrollTop;
    };

    const setScrollPosition = (target, value) => {
        if (isHorizontal()) {
            target.scrollLeft = value;
            return;
        }

        target.scrollTop = value;
    };

    const getPointerPosition = event => {
        return isHorizontal()
            ? event.clientX
            : event.clientY;
    };

    const getPointerDelta = event => {
        const currentPointerPosition = getPointerPosition(event);
        const delta = currentPointerPosition - lastPointerPosition.value;

        lastPointerPosition.value = currentPointerPosition;

        return delta;
    };

    const hasScrollableContent = target => {
        if (!target) return false;

        return getScrollSize(target) > getClientSize(target);
    };

    const isPointerNearScrollbar = event => {
        if (!el.value || !hasScrollableContent(el.value)) return false;

        const rect = el.value.getBoundingClientRect();
        const distance = approachDistance();

        const x = event.clientX;
        const y = event.clientY;

        if (isHorizontal()) {
            const insideX = x >= rect.left && x <= rect.right;
            const nearBottom = y >= rect.bottom - distance && y <= rect.bottom + distance;

            return insideX && nearBottom;
        }

        const insideY = y >= rect.top && y <= rect.bottom;
        const nearRight = x >= rect.right - distance && x <= rect.right + distance;

        return insideY && nearRight;
    };

    /* -------------------------------------------------------
     * RAF LOOP
     * ----------------------------------------------------- */
    const startLoop = () => {
        if (isLoopRunning.value) return;

        isLoopRunning.value = true;

        const loop = () => {
            const now = performance.now();

            if (isDrag.value) {
                active.value = true;
                lastActivity.value = now;

                rafId.value = requestAnimationFrame(loop);
                return;
            }

            if (now - lastActivity.value > hideDelay) {
                stopLoop();

                if (props.pulse && th.value) {
                    th.value.classList.remove("pulse-active");
                }

                if (props.wave) {
                    wvActive.value = true;
                    setTimeout(() => (wvActive.value = false), 580);
                }

                active.value = false;
                return;
            }

            rafId.value = requestAnimationFrame(loop);
        };

        rafId.value = requestAnimationFrame(loop);
    };

    const stopLoop = () => {
        if (rafId.value) cancelAnimationFrame(rafId.value);

        rafId.value = null;
        isLoopRunning.value = false;
    };

    const markActivity = () => {
        lastActivity.value = performance.now();

        if (!isLoopRunning.value) {
            startLoop();
        }
    };

    const hideScrollbar = () => {
        stopLoop();

        if (props.pulse && th.value) {
            th.value.classList.remove("pulse-active");
        }

        active.value = false;
    };

    /* -------------------------------------------------------
     * THUMB UPDATE
     * ----------------------------------------------------- */
    const updateThumb = target => {
        if (!th.value || !target) return;

        const clientSize = getClientSize(target);
        const scrollSize = getScrollSize(target);
        const scrollPosition = getScrollPosition(target);
        const maxScroll = scrollSize - clientSize;

        if (maxScroll <= 0) {
            active.value = false;
            return;
        }

        const ratio = clientSize / scrollSize;
        const size = Math.max(ratio * 100, 8);
        const offset = (scrollPosition / maxScroll) * (100 - size);

        if (isHorizontal()) {
            th.value.style.width = `${size}%`;
            th.value.style.left = `${offset}%`;
            th.value.style.height = "";
            th.value.style.top = "";
            return;
        }

        th.value.style.height = `${size}%`;
        th.value.style.top = `${offset}%`;
        th.value.style.width = "";
        th.value.style.left = "";
    };

    /* -------------------------------------------------------
     * EVENTS
     * ----------------------------------------------------- */
    const onScroll = () => {
        if (!el.value) return;

        updateThumb(el.value);

        if (props.hideOnWheel && isWheelScrolling.value) {
            hideScrollbar();
            return;
        }

        active.value = true;

        if (props.pulse && th.value) {
            th.value.classList.add("pulse-active");
        }

        markActivity();
    };

    const onPointerDown = e => {
        isDrag.value = true;
        lastPointerPosition.value = getPointerPosition(e);

        document.body.classList.add("scrollbar-grabbing");

        if (th.value?.setPointerCapture && e.pointerId !== undefined) {
            th.value.setPointerCapture(e.pointerId);
        }

        e.preventDefault();

        active.value = true;

        if (props.pulse && th.value) {
            th.value.classList.add("pulse-active");
        }

        markActivity();
    };

    const onPointerUp = e => {
        if (!isDrag.value) return;

        if (th.value?.releasePointerCapture && e?.pointerId !== undefined) {
            th.value.releasePointerCapture(e.pointerId);
        }

        document.body.classList.remove("scrollbar-grabbing");

        isDrag.value = false;
        active.value = true;

        markActivity();
    };

    const onPointerMove = e => {
        if (!isDrag.value || !el.value) return;

        const delta = getPointerDelta(e);

        if (delta !== 0) {
            const clientSize = getClientSize(el.value);
            const scrollSize = getScrollSize(el.value);
            const currentPosition = getScrollPosition(el.value);

            setScrollPosition(
                el.value,
                currentPosition + delta * (scrollSize / clientSize) * 0.55
            );

            markActivity();
        }

        e.preventDefault();
    };

    const onPointerApproach = e => {
        if (isDrag.value || !el.value) return;

        if (!isPointerNearScrollbar(e)) return;

        active.value = true;
        updateThumb(el.value);

        markActivity();
    };

    const onWheel = () => {
        isWheelScrolling.value = true;

        if (wheelTimer.value) {
            clearTimeout(wheelTimer.value);
        }

        wheelTimer.value = setTimeout(() => {
            isWheelScrolling.value = false;
            wheelTimer.value = null;
        }, 80);

        if (!props.hideOnWheel) return;

        hideScrollbar();
    };

    const onResize = () => updateThumb(el.value);

    /* -------------------------------------------------------
     * ATTACH & CLEANUP
     * ----------------------------------------------------- */
    const attach = () => {
        el.value = document.getElementById(props.target);

        if (!el.value) {
            console.warn("[scrollbar] target not found:", props.target);
            return;
        }

        tr.value = document.getElementById(trId.value);
        th.value = document.getElementById(thId.value);

        const prev = getComputedStyle(el.value).position;

        if (!prev || prev === "static") {
            el.value.style.position = "relative";
        }

        el.value.style.scrollBehavior = "smooth";

        updateThumb(el.value);

        register("add", el.value, "wheel", onWheel, { passive: true });
        register("add", document, "pointermove", onPointerApproach, { passive: true });
        register("add", el.value, "scroll", onScroll, { passive: true });
        register("add", window, "resize", onResize);
        register("add", th.value, "pointerdown", onPointerDown);
        register("add", document, "pointerup", onPointerUp);
        register("add", document, "pointermove", onPointerMove);
    };

    onMounted(() => attach());

    onBeforeUnmount(() => {
        stopLoop();
        if (wheelTimer.value) {
            clearTimeout(wheelTimer.value);
        }
        document.body.classList.remove("scrollbar-grabbing");
        register("removeAll");
    });

    return {
        tr,
        th,
        trId,
        thId,
        active,
        wvActive,
    };
}

export const scrollbarProps = {
    target: {
        type: String,
        required: true,
    },

    mode: {
        type: String,
        default: "vertical",
    },

    wave: {
        type: Boolean,
        default: true,
    },

    pulse: {
        type: Boolean,
        default: true,
    },

    hideOnWheel: {
        type: Boolean,
        default: true,
    },
};