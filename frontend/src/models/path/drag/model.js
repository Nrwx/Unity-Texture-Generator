import {ref, onMounted, onBeforeUnmount} from "vue";
import {eventRegister} from "@/dataLayer/event";
import {uuid} from "@/utils/uuid";

export function pathDragModel(props, emit) {
    const wrapper = ref(null);
    const wrapperId = ref(uuid())
    const canvas = ref(null);
    const canvasId = ref(uuid());
    const ctx = ref(null);
    const cloned = ref(null);

    const dragStart = ref(null);
    const dragPath = ref(null);


    const emitEvent = (event, payload) => emit('update:component-event', event, payload);
    const { register } = eventRegister('listener:path', emitEvent);

    const onPointerDown = async () => {
        dragStart.value = null
        dragPath.value = null
        if (!props.selected) return;

        // Init Drag
        cloned.value = JSON.parse(JSON.stringify(props.selected));
        const center = getCenter(cloned.value.points);
        const offsetX = props.mouse.x - center.x;
        const offsetY = props.mouse.y - center.y;

        cloned.value.points.forEach((pt) => {
            pt.x += offsetX;
            pt.y += offsetY;
            if (pt.anchor) {
                pt.anchor.start.x += offsetX;
                pt.anchor.start.y += offsetY;
                pt.anchor.end.x += offsetX;
                pt.anchor.end.y += offsetY;
            }
        });

        dragStart.value = { x: props.mouse.x, y: props.mouse.y };
        dragPath.value = cloned.value;

        await draw();

        register('add', wrapper.value, 'pointermove', onPointerMove, { passive: false });
        register('add', wrapper.value, 'pointerup', onPointerUp);
    };

    let frameRequested = false;

    const onPointerMove = (e) => {
        if (!dragStart.value || !dragPath.value) return;
        e.preventDefault();

        const dx = props.mouse.x - dragStart.value.x;
        const dy = props.mouse.y - dragStart.value.y;

        const baseScaleX = 1 + dx * 0.0005;
        const baseScaleY = 1 + dy * 0.0005;

        const isAltPressed = e.altKey;
        const minSize = 32;
        const maxWidth = props.viewport.width;
        const maxHeight = props.viewport.height;

        const getBounds = (points) => {
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
            return {
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys)
            };
        };

        const simulateScale = (points, cx, cy, scale) => {
            return points.map(pt => ({
                x: cx + (pt.x - cx) * scale,
                y: cy + (pt.y - cy) * scale
            }));
        };

        if (isAltPressed) {
            const center = getCenter(dragPath.value.points);
            const cx = center.x;
            const cy = center.y;

            // Simulierte neue Punkte für Größenprüfung
            const newPoints = simulateScale(dragPath.value.points, cx, cy, baseScaleX);
            const { width, height } = getBounds(newPoints);
            if (width < minSize || height < minSize || width > maxWidth || height > maxHeight) return;

            dragPath.value.points.forEach(pt => {
                pt.x = cx + (pt.x - cx) * baseScaleX;
                pt.y = cy + (pt.y - cy) * baseScaleX;
                if (pt.anchor) {
                    pt.anchor.start.x = cx + (pt.anchor.start.x - cx) * baseScaleX;
                    pt.anchor.start.y = cy + (pt.anchor.start.y - cy) * baseScaleX;
                    pt.anchor.end.x = cx + (pt.anchor.end.x - cx) * baseScaleX;
                    pt.anchor.end.y = cy + (pt.anchor.end.y - cy) * baseScaleX;
                }
            });
        } else {
            const fix = getTopLeft(dragPath.value.points);
            const fixX = fix.x;
            const fixY = fix.y;

            // Simulierte neue Punkte für Größenprüfung
            const newPoints = dragPath.value.points.map(pt => ({
                x: pt.x >= fixX ? fixX + (pt.x - fixX) * baseScaleX : pt.x,
                y: pt.y >= fixY ? fixY + (pt.y - fixY) * baseScaleY : pt.y
            }));
            const { width, height } = getBounds(newPoints);
            if (width < minSize || height < minSize || width > maxWidth || height > maxHeight) return;

            dragPath.value.points.forEach(pt => {
                if (pt.x >= fixX) pt.x = fixX + (pt.x - fixX) * baseScaleX;
                if (pt.y >= fixY) pt.y = fixY + (pt.y - fixY) * baseScaleY;

                if (pt.anchor) {
                    if (pt.anchor.start.x >= fixX) pt.anchor.start.x = fixX + (pt.anchor.start.x - fixX) * baseScaleX;
                    if (pt.anchor.start.y >= fixY) pt.anchor.start.y = fixY + (pt.anchor.start.y - fixY) * baseScaleY;
                    if (pt.anchor.end.x >= fixX) pt.anchor.end.x = fixX + (pt.anchor.end.x - fixX) * baseScaleX;
                    if (pt.anchor.end.y >= fixY) pt.anchor.end.y = fixY + (pt.anchor.end.y - fixY) * baseScaleY;
                }
            });
        }

        if (!frameRequested) {
            frameRequested = true;
            requestAnimationFrame(async () => {
                await draw();
                frameRequested = false;
            });
        }
    };


    function getTopLeft(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return { x: Math.min(...xs), y: Math.min(...ys) };
    }



    const onPointerUp = async () => {
        if (dragPath.value) {
            emitEvent("update:path-layer", dragPath.value);
            emitEvent("path-drag-state", false);
            emitEvent("pen-state", true);
            emitEvent("path:lock", true);
            emitEvent("path:edit", false);
        }

        dragStart.value = null
        dragPath.value = null
        cloned.value = null
        resetCanvas()

        register('remove', wrapper.value, 'pointermove', onPointerMove);
        register('remove', wrapper.value, 'pointerup', onPointerUp);
    };

    const getCenter = (points) => {
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
        return { x: avg(xs), y: avg(ys) };
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

            // Sichtbarkeit prüfen (optional)
            if ((pA.x < 0 && pB.x < 0) || (pA.x > w && pB.x > w) || (pA.y < 0 && pB.y < 0) || (pA.y > h && pB.y > h)) {
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

            let strokeStyle, lineWidth;
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
                    bezA.cp2.x, bezA.cp2.y,
                    bezB.cp1.x, bezB.cp1.y,
                    pB.x, pB.y
                );
            } else if (isQuadA) {
                c.quadraticCurveTo(bezA.cp2.x, bezA.cp2.y, pB.x, pB.y);
            } else if (isQuadB) {
                c.quadraticCurveTo(bezB.cp1.x, bezB.cp1.y, pB.x, pB.y);
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


    // Canvas initialisieren (Größe setzen, Kontext holen)
    const init = async () => {
        if (!canvas.value || !wrapper.value) return;
        const el = canvas.value;
        const {width, height} = props.viewport;
        Object.assign(el, {width, height});
        ctx.value = el.getContext('2d');
        Object.assign(ctx.value, {lineCap: 'round', lineJoin: 'round'});
        await draw();
    };

    onMounted(async () => {
        wrapper.value = document.getElementById(wrapperId.value);
        canvas.value = document.getElementById(canvasId.value);

        if(wrapper.value) {
            register('add', wrapper.value, 'pointerdown', onPointerDown);
        }

        if (canvas.value) {
            await init();
            register('add', document, 'resize', init);
        }

        register('pause');
    });

    onBeforeUnmount(() => {
        register('removeAll');
    });


    return {
        wrapper,
        wrapperId,
        canvas,
        canvasId
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
