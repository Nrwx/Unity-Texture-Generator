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

    const emitEvent = (event, payload) =>
        emit("component-event", event, payload);

    const { register } = eventRegister(
        `listener:scrollbar-${componentId.value}`,
        emitEvent
    );

    /* -------------------------------------------------------
     * RAF LOOP
     * ----------------------------------------------------- */
    const startLoop = () => {
        if (isLoopRunning.value) return;
        isLoopRunning.value = true;

        const loop = () => {
            const now = performance.now();

            if (now - lastActivity.value > hideDelay) {
                stopLoop(); // stop RAF first

                // Pulse end
                if (props.pulse && th.value) {
                    th.value.classList.remove("pulse-active");
                }

                // Wave animation
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
        if (!isLoopRunning.value) startLoop();
    };

    /* -------------------------------------------------------
     * THUMB UPDATE
     * ----------------------------------------------------- */
    const updateThumb = (el) => {
        if (!th.value || !el) return;

        const ratio = el.clientHeight / el.scrollHeight;
        const h = Math.max(ratio * 100, 8);
        const maxScroll = el.scrollHeight - el.clientHeight;

        const top = maxScroll > 0
            ? (el.scrollTop / maxScroll) * (100 - h)
            : 0;

        th.value.style.height = h + "%";
        th.value.style.top = top + "%";
    };

    /* -------------------------------------------------------
     * EVENTS
     * ----------------------------------------------------- */
    const onScroll = () => {
        if (!el.value) return;

        active.value = true;
        updateThumb(el.value);

        if (props.pulse && th.value) {
            th.value.classList.add("pulse-active");
        }

        markActivity();
    };

    const onPointerDown = (e) => {
        isDrag.value = true;
        e.preventDefault();

        active.value = true;
        markActivity();
    };

    const onPointerUp = () => {
        if (!isDrag.value) return;
        isDrag.value = false;

        markActivity();
    };

    const onPointerMove = (e) => {
        if (!isDrag.value || !el.value) return;

        const delta = e.movementY;
        if (delta !== 0) {
            el.value.scrollTop +=
                delta *
                (el.value.scrollHeight / el.value.clientHeight) *
                0.55;
            markActivity();
        }
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

        register("add", el.value, "scroll", onScroll, { passive: true });
        register("add", window, "resize", onResize);
        register("add", th.value, "pointerdown", onPointerDown);
        register("add", document, "pointerup", onPointerUp);
        register("add", document, "pointermove", onPointerMove);
    };

    onMounted(() => attach());

    onBeforeUnmount(() => {
        stopLoop();
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
    target: { type: String, required: true },
    wave: { type: Boolean, default: true },
    pulse: { type: Boolean, default: true },
};