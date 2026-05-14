import { ref, onMounted, onBeforeUnmount } from "vue";
import { eventRegister } from "@/dataLayer/event";
import { uuid } from "@/utils/uuid";

export function pathDragModel(props, emit) {
    const wrapper = ref(null);
    const wrapperId = ref(uuid());
    const canvas = ref(null);
    const canvasId = ref(uuid());
    const ctx = ref(null);

    const dragStart = ref(null);
    const dragOrigin = ref(null);
    const dragPath = ref(null);

    let frameRequested = false;

    const emitEvent = (event, payload) => emit("update:component-event", event, payload);
    const { register } = eventRegister("listener:path", emitEvent);

    const deepClone = (value) => JSON.parse(JSON.stringify(value));

    const clamp = (value, min, max) => {
        return Math.max(min, Math.min(max, value));
    };

    const getPointerPosition = (e) => {
        if (!wrapper.value) {
            return {
                x: props.mouse?.x || 0,
                y: props.mouse?.y || 0,
            };
        }

        const rect = wrapper.value.getBoundingClientRect();

        const viewportWidth = props.viewport.width;
        const viewportHeight = props.viewport.height;

        const scaleX = viewportWidth / rect.width;
        const scaleY = viewportHeight / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const getBounds = (points) => {
        if (!Array.isArray(points) || points.length === 0) {
            return {
                x: 0,
                y: 0,
                minX: 0,
                minY: 0,
                maxX: 1,
                maxY: 1,
                width: 1,
                height: 1,
                centerX: 0.5,
                centerY: 0.5,
            };
        }

        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);

        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);

        return {
            x: minX,
            y: minY,
            minX,
            minY,
            maxX,
            maxY,
            width,
            height,
            centerX: minX + width / 2,
            centerY: minY + height / 2,
        };
    };

    const translateCoord = (coord, dx, dy) => {
        if (!coord) return;

        coord.x += dx;
        coord.y += dy;
    };

    const translatePoint = (pt, dx, dy) => {
        translateCoord(pt, dx, dy);

        if (pt.anchor) {
            translateCoord(pt.anchor.start, dx, dy);
            translateCoord(pt.anchor.end, dx, dy);
        }

        if (pt.bezier) {
            translateCoord(pt.bezier.cp1, dx, dy);
            translateCoord(pt.bezier.cp2, dx, dy);
        }
    };

    const translatePath = (path, dx, dy) => {
        const nextPath = deepClone(path);

        if (Array.isArray(nextPath.points)) {
            nextPath.points.forEach((pt) => {
                translatePoint(pt, dx, dy);
            });
        }

        return nextPath;
    };

    const transformCoord = (coord, pivotX, pivotY, scaleX, scaleY) => {
        if (!coord) return;

        coord.x = pivotX + (coord.x - pivotX) * scaleX;
        coord.y = pivotY + (coord.y - pivotY) * scaleY;
    };

    const transformPoint = (pt, pivotX, pivotY, scaleX, scaleY) => {
        transformCoord(pt, pivotX, pivotY, scaleX, scaleY);

        if (pt.anchor) {
            transformCoord(pt.anchor.start, pivotX, pivotY, scaleX, scaleY);
            transformCoord(pt.anchor.end, pivotX, pivotY, scaleX, scaleY);
        }

        if (pt.bezier) {
            transformCoord(pt.bezier.cp1, pivotX, pivotY, scaleX, scaleY);
            transformCoord(pt.bezier.cp2, pivotX, pivotY, scaleX, scaleY);
        }
    };

    const transformPathFromOrigin = (originPath, pivotX, pivotY, scaleX, scaleY) => {
        const nextPath = deepClone(originPath);

        if (Array.isArray(nextPath.points)) {
            nextPath.points.forEach((pt) => {
                transformPoint(pt, pivotX, pivotY, scaleX, scaleY);
            });
        }

        return nextPath;
    };

    const getScaleFromDrag = ({ dx, dy, bounds, altKey, shiftKey }) => {
        const minSize = 8;
        const maxWidth = props.viewport.width * 4;
        const maxHeight = props.viewport.height * 4;

        let nextWidth = Math.abs(dx);
        let nextHeight = Math.abs(dy);

        nextWidth = clamp(nextWidth, minSize, maxWidth);
        nextHeight = clamp(nextHeight, minSize, maxHeight);

        let scaleX = nextWidth / bounds.width;
        let scaleY = nextHeight / bounds.height;

        if (dx < 0) scaleX *= -1;
        if (dy < 0) scaleY *= -1;

        if (shiftKey) {
            const uniformSize = Math.max(nextWidth, nextHeight);

            scaleX = uniformSize / bounds.width;
            scaleY = uniformSize / bounds.height;

            if (dx < 0) scaleX *= -1;
            if (dy < 0) scaleY *= -1;
        }

        if (altKey) {
            scaleX *= 2;
            scaleY *= 2;
        }

        return { scaleX, scaleY };
    };

    const onPointerDown = async (e) => {
        if (!props.selected) return;

        e.preventDefault();

        try {
            e.currentTarget?.setPointerCapture?.(e.pointerId);
        } catch (_) {
            console.log(_)}

        const startMouse = getPointerPosition(e);

        const selectedPath = deepClone(props.selected);
        const selectedBounds = getBounds(selectedPath.points || []);

        const moveX = startMouse.x - selectedBounds.minX;
        const moveY = startMouse.y - selectedBounds.minY;

        const originPath = translatePath(selectedPath, moveX, moveY);
        const originBounds = getBounds(originPath.points || []);

        dragStart.value = startMouse;

        dragOrigin.value = {
            path: originPath,
            bounds: originBounds,
            startX: startMouse.x,
            startY: startMouse.y,
        };

        dragPath.value = deepClone(originPath);

        emitEvent("path-drag-state", true);

        await draw();

        register("add", wrapper.value, "pointermove", onPointerMove, { passive: false });
        register("add", wrapper.value, "pointerup", onPointerUp);
        register("add", wrapper.value, "pointercancel", onPointerUp);
    };

    const onPointerMove = (e) => {
        if (!dragStart.value || !dragOrigin.value) return;

        e.preventDefault();

        const mouse = getPointerPosition(e);

        const dx = mouse.x - dragStart.value.x;
        const dy = mouse.y - dragStart.value.y;

        const { path: originPath, bounds } = dragOrigin.value;

        const altKey = !!e.altKey;
        const shiftKey = !!e.shiftKey;

        const { scaleX, scaleY } = getScaleFromDrag({
            dx,
            dy,
            bounds,
            altKey,
            shiftKey,
        });

        const pivotX = dragOrigin.value.startX;
        const pivotY = dragOrigin.value.startY;

        dragPath.value = transformPathFromOrigin(
            originPath,
            pivotX,
            pivotY,
            scaleX,
            scaleY
        );

        if (!frameRequested) {
            frameRequested = true;

            requestAnimationFrame(async () => {
                await draw();
                frameRequested = false;
            });
        }
    };

    const onPointerUp = async (e) => {
        try {
            e?.currentTarget?.releasePointerCapture?.(e.pointerId);
        } catch (_) {
            console.log(_)}

        if (dragPath.value) {
            emitEvent("update:path-layer", dragPath.value);
            emitEvent("path-drag-state", false);
            emitEvent("pen-state", true);
            emitEvent("path:lock", true);
            emitEvent("path:edit", false);
        }

        dragStart.value = null;
        dragOrigin.value = null;
        dragPath.value = null;

        resetCanvas();

        register("remove", wrapper.value, "pointermove", onPointerMove);
        register("remove", wrapper.value, "pointerup", onPointerUp);
        register("remove", wrapper.value, "pointercancel", onPointerUp);
    };

    const draw = async () => {
        if (!ctx.value || !dragPath.value) return;

        const c = ctx.value;
        const w = canvas.value.width;
        const h = canvas.value.height;

        c.clearRect(0, 0, w, h);

        const connections = dragPath.value.connections || [];
        const points = dragPath.value.points || [];

        let currentStrokeStyle = null;
        let currentLineWidth = null;

        for (let i = 0; i < connections.length; i++) {
            const [a, b] = connections[i];
            const pA = points[a];
            const pB = points[b];

            if (!pA || !pB) continue;

            if (
                (pA.x < 0 && pB.x < 0) ||
                (pA.x > w && pB.x > w) ||
                (pA.y < 0 && pB.y < 0) ||
                (pA.y > h && pB.y > h)
            ) {
                continue;
            }

            const linearA = !!pA.linear;
            const linearB = !!pB.linear;
            const bezA = pA.bezier;
            const bezB = pB.bezier;

            const hasCP2 = bezA && !!bezA.cp2;
            const hasCP1 = bezB && !!bezB.cp1;

            const isCubic = !linearA && !linearB && hasCP2 && hasCP1;
            const isQuadA = !linearA && hasCP2 && !isCubic;
            const isQuadB = !linearB && hasCP1 && !isCubic;

            let strokeStyle;
            let lineWidth;

            if (isCubic || isQuadA || isQuadB) {
                strokeStyle = "#1EA1F1";
                lineWidth = 1.5;
            } else {
                strokeStyle = "#aaf";
                lineWidth = 1;
            }

            if (strokeStyle !== currentStrokeStyle) {
                c.strokeStyle = strokeStyle;
                currentStrokeStyle = strokeStyle;
            }

            if (lineWidth !== currentLineWidth) {
                c.lineWidth = lineWidth;
                currentLineWidth = lineWidth;
            }

            c.beginPath();
            c.moveTo(pA.x, pA.y);

            if (isCubic) {
                c.bezierCurveTo(
                    bezA.cp2.x,
                    bezA.cp2.y,
                    bezB.cp1.x,
                    bezB.cp1.y,
                    pB.x,
                    pB.y
                );
            } else if (isQuadA) {
                c.quadraticCurveTo(
                    bezA.cp2.x,
                    bezA.cp2.y,
                    pB.x,
                    pB.y
                );
            } else if (isQuadB) {
                c.quadraticCurveTo(
                    bezB.cp1.x,
                    bezB.cp1.y,
                    pB.x,
                    pB.y
                );
            } else {
                c.lineTo(pB.x, pB.y);
            }

            c.stroke();
        }
    };

    const resetCanvas = () => {
        if (!ctx.value || !canvas.value) return;

        const w = canvas.value.width;
        const h = canvas.value.height;

        ctx.value.clearRect(0, 0, w, h);
    };

    const init = async () => {
        if (!canvas.value || !wrapper.value) return;

        const el = canvas.value;
        const { width, height } = props.viewport;

        Object.assign(el, { width, height });

        ctx.value = el.getContext("2d");

        Object.assign(ctx.value, {
            lineCap: "round",
            lineJoin: "round",
        });

        await draw();
    };

    onMounted(async () => {
        wrapper.value = document.getElementById(wrapperId.value);
        canvas.value = document.getElementById(canvasId.value);

        if (wrapper.value) {
            register("add", wrapper.value, "pointerdown", onPointerDown, { passive: false });
        }

        if (canvas.value) {
            await init();
            register("add", window, "resize", init);
        }

        register("pause");
    });

    onBeforeUnmount(() => {
        register("removeAll");
    });

    return {
        wrapper,
        wrapperId,
        canvas,
        canvasId,
    };
}

export const pathDragProps = {
    state: {
        type: Boolean,
        required: true,
    },
    selected: {
        type: Object,
        required: true,
    },
    viewport: {
        type: Object,
        required: true,
    },
    mouse: {
        type: Object,
        required: true,
    },
};