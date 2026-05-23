import { nextTick, ref, watch } from 'vue';
import { eventRegister } from "@/dataLayer/event";
import { nowMs } from "@/utils/dayJs";
import { matrixCombine } from "@/utils/matrix";
import { useMouse } from "@/composables/mouse/model";
import {clamp, lerp} from "@/utils/tools";

export function brushModel(props, emit) {
    const canvas = ref(null);
    const ctx = ref(null);

    /**
     * Optionales Input-Ziel.
     * Wenn props.wrapper gesetzt ist, kommen pointerdown/move vom Wrapper,
     * gerendert wird aber weiterhin nur auf canvas.
     */
    const inputTarget = ref(null);

    const currentSize = ref(props.data.size);
    const currentAngle = ref(0);
    const currentOpacity = ref(0);

    /**
     * lastPos bleibt aus Kompatibilitätsgründen vorhanden,
     * wird aber NICHT mehr vom drawLoop verändert.
     */
    const lastPos = ref(null);

    /**
     * Separater Input-State.
     * Render-Queue darf niemals Pointer-State überschreiben.
     */
    const prevInputPos = ref(null);
    const lastInputPos = ref(null);
    const lastTime = ref(null);
    const pointerMoved = ref(false);
    const activePointerId = ref(null);


    const brushCursorEl = ref(null);

    const getBrushCursorEl = () => {
        if (!brushCursorEl.value) {
            brushCursorEl.value = document.querySelector(".brush-cursor");
        }

        return brushCursorEl.value;
    };

    const updateBrushCursorDynamics = ({ size, rotation, opacity }) => {
        const el = getBrushCursorEl();

        if (!el) return;

        const safeOpacity = Math.min(1, Math.max(0, opacity ?? 1));

        el.style.setProperty("--brush-cursor-dynamic-size", `${Math.max(1, size)}px`);
        el.style.setProperty("--brush-cursor-dynamic-angle", `${rotation || 0}deg`);

        el.style.setProperty(
            "--brush-cursor-dynamic-border-opacity",
            `${Math.min(1, Math.max(0.55, safeOpacity * 1.2))}`
        );

        el.style.setProperty(
            "--brush-cursor-dynamic-blue-opacity",
            `${Math.min(1, Math.max(0.45, safeOpacity * 1.35))}`
        );
    };

    const resetBrushCursorDynamics = () => {
        const el = getBrushCursorEl();

        if (!el) return;

        el.style.removeProperty("--brush-cursor-dynamic-size");
        el.style.removeProperty("--brush-cursor-dynamic-angle");
        el.style.removeProperty("--brush-cursor-dynamic-opacity");
        el.style.removeProperty("--brush-cursor-dynamic-border-opacity");
        el.style.removeProperty("--brush-cursor-dynamic-blue-opacity");

        brushCursorEl.value = null;
    };

    /**
     * Verhindert Doppel-Stamps bei echtem Single Click.
     * Production-Brush-Verhalten:
     * pointerdown erzeugt genau einen Tap-Stamp.
     * pointerup erzeugt nur dann einen Fallback-Stamp, wenn noch gar keiner gesetzt wurde.
     */
    const strokeStamped = ref(false);

    /**
     * Restdistanz zwischen Stamps.
     * Dadurch bleiben Stamps über mehrere Pointer-Events hinweg gleichmäßig.
     */
    const stampRemainder = ref(0);

    /**
     * Queue mit Read-Index statt shift().
     * shift() ist bei großen Arrays extrem teuer.
     */
    const drawQueue = ref([]);
    const queueReadIndex = ref(0);
    const animating = ref(false);

    const supportsPointerRawUpdate = ref(false);
    const moveEventName = ref('pointermove');

    const MIN_PRESSURE = 0.015;
    const MIN_ALPHA = 0.003;
    const MIN_SIZE = 0.35;

    /**
     * Nicht zu hoch setzen.
     * drawImage() bleibt teuer.
     */
    const MAX_STAMPS_PER_FRAME = 1600;

    /**
     * Mehr Budget, damit Curves nicht sichtbar mehrere Sekunden nachlaufen.
     */
    const FRAME_BUDGET_MS = 14;

    /**
     * Emergency-Limit.
     */
    const MAX_QUEUE = 30000;

    /**
     * Wichtig:
     * Bei sehr schnellen Strichen darf Spacing nicht zu klein werden,
     * sonst erzeugst du tausende Dabs pro Sekunde.
     */
    const FAST_STROKE_MIN_SPACING = 0.75;

    /**
     * Production-Input-Filter:
     * Kleine Pointer-Micro-Bewegungen bei Klicks/Pen-Jitter sollen keinen echten Stroke starten.
     */
    const MIN_STROKE_DIST = 0.75;

    const emitEvent = (event, payload) => emit('update:component-event', event, payload);

    const { register } = eventRegister('listener:brush', emitEvent);

    const mouse = useMouse({
        register,
        elementId: props.canvasId,
        mode: "local",
    });

    const getMoveThreshold = () => {
        /**
         * Dynamischer Threshold:
         * Kleine Brushes bleiben präzise.
         * Große Brushes ignorieren mehr Handzittern.
         */
        return clamp((props.data.size ?? 1) * 0.015, 0.75, 3);
    };

    const easePressure = (pressure) => {
        const p = clamp(pressure, MIN_PRESSURE, 1);

        /**
         * Unterer Druckbereich wird dadurch feinfühliger.
         */
        return Math.pow(p, 0.72);
    };

    const getBrushPressure = (e) => {
        const userPressure = props.data.pressure ?? 1;
        let raw = e?.pressure;

        /**
         * Mouse soll volle Kraft bekommen.
         * Pen darf nie komplett 0 werden.
         */
        if (raw == null || raw <= 0) {
            raw = e?.pointerType === 'pen' ? MIN_PRESSURE : 1;
        }

        return clamp(raw * userPressure, MIN_PRESSURE, 1);
    };

    const getBaseSpacing = (size = props.data.size) => {
        const spacing = props.data.spacing ?? 10;
        const safeSize = Math.max(size ?? 1, MIN_SIZE);

        return Math.max(0.25, (spacing / 100) * safeSize);
    };

    const getDynamicSpacing = (size, pressure, speed) => {
        const baseSpacing = getBaseSpacing(size);

        /**
         * Bei wenig Druck etwas dichter, bei hohem Druck normaler.
         */
        const pressureSpacing = lerp(1.15, 0.78, easePressure(pressure));

        /**
         * Wichtig:
         * Bei schnellen Strichen NICHT immer dichter werden.
         * Sonst explodiert die Queue.
         *
         * Bis mittlere Geschwindigkeit etwas dichter,
         * bei extremer Geschwindigkeit wieder leicht gröber.
         */
        const speedNorm = clamp(speed / 8, 0, 1);

        const speedSpacing = speedNorm < 0.65
            ? lerp(1, 0.72, speedNorm / 0.65)
            : lerp(0.72, 1.05, (speedNorm - 0.65) / 0.35);

        return Math.max(
            FAST_STROKE_MIN_SPACING,
            baseSpacing * pressureSpacing * speedSpacing
        );
    };

    const computeAlpha = (pressure, speed) => {
        const opacity = clamp(props.data.opacity ?? 1, MIN_ALPHA, 1);
        const flow = clamp(props.data.flow ?? 1, MIN_ALPHA, 1);

        if (!props.data.fadeDynamics) {
            return clamp(opacity, MIN_ALPHA, 1);
        }

        const p = easePressure(pressure);

        /**
         * Speed-Fade bewusst mild.
         * Bei sehr schnellen Strichen darf der Brush nicht verschwinden.
         */
        const speedNorm = clamp(speed / 8, 0, 1);
        const speedFade = lerp(1, 0.88, speedNorm);

        const alpha = opacity * flow * p * speedFade;

        return clamp(alpha, MIN_ALPHA, 1);
    };

    const computeSize = (pressure, speed) => {
        const baseSize = Math.max(props.data.size ?? 1, MIN_SIZE);

        if (!props.data.sizeDynamics) {
            return baseSize;
        }

        const p = easePressure(pressure);

        /**
         * Niedriger Druck = klein, aber niemals 0.
         */
        const minSizeRatio = 0.055;
        const dynamicSize = baseSize * lerp(minSizeRatio, 1, p);

        /**
         * Bei schnellen Bewegungen nur minimal stabilisieren.
         */
        const speedNorm = clamp(speed / 8, 0, 1);
        const stabilizedSize = dynamicSize * lerp(1, 0.96, speedNorm);

        return Math.max(MIN_SIZE, stabilizedSize);
    };

    const computeAngle = (dx, dy) => {
        let angle = ((props.data.angle || 0) * Math.PI) / 180;

        if (props.data.angleDynamics) {
            const dynamicAngle = Math.atan2(dy, dx);

            angle += dynamicAngle;
            currentAngle.value = dynamicAngle * (180 / Math.PI);
        }

        if (props.data.rotationRandom) {
            const randomAngle = Math.random() * Math.PI * 2;

            angle += randomAngle;
            currentAngle.value = randomAngle * (180 / Math.PI);
        }

        return angle;
    };

    const midpoint = (a, b) => {
        return {
            x: (a.x + b.x) * 0.5,
            y: (a.y + b.y) * 0.5,
        };
    };

    const quadAt = (p0, p1, p2, t) => {
        const mt = 1 - t;

        return {
            x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
            y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
        };
    };

    const resolveInputTarget = () => {
        if (!props.wrapper) {
            return canvas.value;
        }

        if (typeof props.wrapper === 'string') {
            const el = document.getElementById(props.wrapper);

            if (!el) {
                console.warn(`BRUSH WRAPPER NOT FOUND: ${props.wrapper}`);
                return canvas.value;
            }

            return el;
        }

        if (
            typeof HTMLElement !== 'undefined' &&
            props.wrapper instanceof HTMLElement
        ) {
            return props.wrapper;
        }

        /**
         * Falls aus Vue mal ein ref-artiges Objekt kommt.
         */
        if (props.wrapper?.value instanceof HTMLElement) {
            return props.wrapper.value;
        }

        return canvas.value;
    };

    const setup = async () => {
        canvas.value = document.getElementById(props.canvasId);

        if (!canvas.value) {
            return console.warn('BRUSH CANVAS NOT INITIALIZED');
        }

        inputTarget.value = resolveInputTarget();

        supportsPointerRawUpdate.value =
            typeof window !== 'undefined' &&
            'onpointerrawupdate' in window;

        moveEventName.value = supportsPointerRawUpdate.value
            ? 'pointerrawupdate'
            : 'pointermove';

        mouse.init();

        ctx.value = canvas.value.getContext('2d', {
            alpha: true,
            desynchronized: true,
        });

        Object.assign(ctx.value, {
            lineCap: 'round',
            lineJoin: 'round'
        });
    };

    const enqueue = ({ x, y, alpha, size, angle, flipX, flipY }) => {
        updateBrushCursorDynamics({
            size,
            rotation: currentAngle.value,
            opacity: alpha,
        });

        drawQueue.value.push({
            x,
            y,
            alpha,
            size,
            angle,
            flipX,
            flipY
        });

        /**
         * Wenn die Queue zu groß wird:
         * Nicht alles langsam abarbeiten.
         * Wir komprimieren die noch nicht gerenderten Stamps.
         */
        const pending = drawQueue.value.length - queueReadIndex.value;

        if (pending > MAX_QUEUE) {
            const compacted = [];

            for (let i = queueReadIndex.value; i < drawQueue.value.length; i += 2) {
                compacted.push(drawQueue.value[i]);
            }

            drawQueue.value = compacted;
            queueReadIndex.value = 0;
        }

        if (!animating.value) {
            drawLoop();
        }
    };

    const createLayer = async () => {
        if (!canvas.value || !props.selectedLayer) return null;

        const { width: layerWidth, height: layerHeight } = props.selectedLayer;

        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = layerWidth;
        shadowCanvas.height = layerHeight;

        const shadowCtx = shadowCanvas.getContext('2d');
        shadowCtx.clearRect(0, 0, layerWidth, layerHeight);

        shadowCtx.drawImage(
            canvas.value,
            0,
            0,
            canvas.value.width,
            canvas.value.height,
            0,
            0,
            layerWidth,
            layerHeight
        );

        const blob = await new Promise(resolve =>
            shadowCanvas.toBlob(resolve, 'image/png', 0.95)
        );

        if (!blob) return null;

        return {
            ...props.selectedLayer,
            image: blob
        };
    };

    const drawLoop = () => {
        if (animating.value) return;

        animating.value = true;

        const frame = () => {
            if (!ctx.value || !props.currentBrush) {
                animating.value = false;
                return;
            }

            const frameStart = performance.now();
            let rendered = 0;

            while (
                queueReadIndex.value < drawQueue.value.length &&
                rendered < MAX_STAMPS_PER_FRAME &&
                performance.now() - frameStart < FRAME_BUDGET_MS
                ) {
                const {
                    x,
                    y,
                    alpha,
                    size,
                    angle,
                    flipX,
                    flipY
                } = drawQueue.value[queueReadIndex.value++];

                const sc = ((props.data.scatter ?? 0) / 100) * size;
                const sx = (Math.random() - 0.5) * sc;
                const sy = (Math.random() - 0.5) * sc;

                const jitter = ((props.data.jitter ?? 0) / 100) * size;
                const finalSize = Math.max(
                    MIN_SIZE,
                    size + (Math.random() - 0.5) * jitter
                );

                ctx.value.save();

                ctx.value.globalAlpha = clamp(alpha, MIN_ALPHA, 1);
                ctx.value.globalCompositeOperation = props.eraser
                    ? 'destination-out'
                    : props.data.blendMode;

                ctx.value.translate(x + sx, y + sy);
                ctx.value.scale(flipX ? -1 : 1, flipY ? -1 : 1);
                ctx.value.rotate(angle);

                ctx.value.drawImage(
                    props.currentBrush,
                    -finalSize / 2,
                    -finalSize / 2,
                    finalSize,
                    finalSize
                );

                ctx.value.restore();

                rendered++;
            }

            /**
             * Wenn alles verarbeitet ist, Queue wirklich leeren.
             */
            if (queueReadIndex.value >= drawQueue.value.length) {
                drawQueue.value = [];
                queueReadIndex.value = 0;
                animating.value = false;
                return;
            }

            /**
             * Bereits gerenderte Stamps gelegentlich entfernen,
             * aber nicht pro Stamp.
             */
            if (queueReadIndex.value > 5000) {
                drawQueue.value = drawQueue.value.slice(queueReadIndex.value);
                queueReadIndex.value = 0;
            }

            requestAnimationFrame(frame);
        };

        requestAnimationFrame(frame);
    };

    const waitForQueueDrain = async () => {
        while (
            queueReadIndex.value < drawQueue.value.length ||
            animating.value
            ) {
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    };

    const buildMatrix = (m) => {
        const matrix = matrixCombine(m);
        return `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.x}, ${matrix.y})`;
    };

    const onCanvasPointerMove = async (e) => {
        await mouse.move(e);
    };

    const getFastPoint = (e) => {
        /**
         * Deutlich schneller als mouse.move(),
         * weil kein kompletter async Context erzeugt wird.
         */
        return mouse.point(e);
    };

    const stampTap = (e, p) => {
        const pressure = getBrushPressure(e);
        const size = computeSize(pressure, 0);
        const alpha = computeAlpha(pressure, 0);
        const angle = ((props.data.angle || 0) * Math.PI) / 180;

        currentSize.value = size;
        currentOpacity.value = alpha;
        currentAngle.value = props.data.angle || 0;

        enqueue({
            x: p.x,
            y: p.y,
            alpha,
            size,
            angle,
            flipX: props.data.flipX,
            flipY: props.data.flipY,
        });

        strokeStamped.value = true;
    };

    const processPointerSample = (e) => {
        if (!props.drawing || !lastInputPos.value) return;
        if (activePointerId.value != null && e.pointerId !== activePointerId.value) return;

        const current = getFastPoint(e);

        if (!current) return;

        const now = e.timeStamp || nowMs();
        const dt = Math.max(1, now - (lastTime.value || now));

        const curr = { ...current };
        const last = lastInputPos.value;
        const prev = prevInputPos.value || last;

        const dx = curr.x - last.x;
        const dy = curr.y - last.y;
        const dist = Math.hypot(dx, dy);

        /**
         * Micro-Movement ignorieren.
         * Dadurch erzeugt ein normaler Single Click nicht 3-5 Stamps.
         */
        if (dist < MIN_STROKE_DIST) {
            return;
        }

        const moveThreshold = getMoveThreshold();

        /**
         * Erst ab sinnvoller Bewegung gilt der Stroke wirklich als bewegt.
         * Das verhindert den zusätzlichen Finish-Stamp bei fast stehenden Klicks.
         */
        if (dist >= moveThreshold) {
            pointerMoved.value = true;
        }

        lastTime.value = now;

        const speed = dist / dt;
        const pressure = getBrushPressure(e);

        const size = computeSize(pressure, speed);
        const alpha = computeAlpha(pressure, speed);
        const spacing = getDynamicSpacing(size, pressure, speed);

        currentSize.value = size;
        currentOpacity.value = alpha;

        /**
         * Quadratic Curve:
         * Dadurch bleiben schnelle Skizzenstriche gebogen,
         * statt als gerade Verbindung zwischen Event-Punkten zu enden.
         */
        const start = midpoint(prev, last);
        const control = last;
        const end = midpoint(last, curr);

        const approxCurveLength =
            Math.hypot(control.x - start.x, control.y - start.y) +
            Math.hypot(end.x - control.x, end.y - control.y);

        let travel = stampRemainder.value;
        const total = approxCurveLength;

        /**
         * Safety:
         * Ein einzelnes Sample darf niemals tausende Stamps erzeugen.
         */
        let localStampCount = 0;
        const maxLocalStamps = 256;

        while (travel <= total && localStampCount < maxLocalStamps) {
            const t = clamp(total <= 0 ? 1 : travel / total, 0, 1);
            const p = quadAt(start, control, end, t);

            const t2 = clamp(t + 0.01, 0, 1);
            const p2 = quadAt(start, control, end, t2);

            const adx = p2.x - p.x;
            const ady = p2.y - p.y;

            enqueue({
                x: p.x,
                y: p.y,
                alpha,
                size,
                angle: computeAngle(adx || dx, ady || dy),
                flipX: props.data.flipX,
                flipY: props.data.flipY,
            });

            travel += spacing;
            localStampCount++;
        }

        stampRemainder.value = travel - total;

        prevInputPos.value = last;
        lastInputPos.value = curr;
        lastPos.value = curr;
    };

    const onPointerMove = (e) => {
        if (!props.drawing || !lastInputPos.value) return;
        if (activePointerId.value != null && e.pointerId !== activePointerId.value) return;

        e.preventDefault();

        /**
         * Browser liefern bei schnellen Pointerbewegungen echte Zwischenpunkte.
         * Wir verarbeiten aber nicht blind alle, weil sonst die Queue explodiert.
         */
        const samples =
            typeof e.getCoalescedEvents === 'function'
                ? e.getCoalescedEvents()
                : [];

        if (!samples.length) {
            processPointerSample(e);
            return;
        }

        /**
         * Genug Samples für Kurvenqualität,
         * aber nicht so viele, dass eine Curve Sekunden nachläuft.
         */
        const maxSamples = 12;
        const step = Math.max(1, Math.ceil(samples.length / maxSamples));

        for (let i = 0; i < samples.length; i += step) {
            processPointerSample(samples[i]);
        }

        /**
         * Letztes Sample immer verarbeiten,
         * damit der Stroke exakt am Pointer endet.
         */
        const lastSample = samples[samples.length - 1];

        if (lastSample && samples.length > 1) {
            processPointerSample(lastSample);
        }
    };

    const onPointerDown = async (e) => {
        if (props.brushMenu || (e.pointerType === 'mouse' && e.button !== 0)) return;
        if (!props.state || !props.currentBrush) return;

        e.preventDefault();

        activePointerId.value = e.pointerId;

        const target = inputTarget.value || canvas.value;

        /**
         * Dadurch läuft der Stroke weiter,
         * auch wenn der Pointer außerhalb vom Canvas oder Wrapper ist.
         */
        if (target?.setPointerCapture && e.pointerId != null) {
            try {
                target.setPointerCapture(e.pointerId);
            } catch (_) {
                // Browser kann Pointer Capture in Sonderfällen ablehnen.
            }
        }

        register('add', target, moveEventName.value, onPointerMove);
        register('add', window, 'pointerup', onPointerUp);
        register('add', window, 'pointercancel', onPointerCancel);

        emitEvent('drawing-state', true);

        await mouse.down(e, async ({ current }) => {
            if (!current) return;

            const p = { ...current };

            prevInputPos.value = p;
            lastInputPos.value = p;
            lastPos.value = p;

            stampRemainder.value = 0;
            lastTime.value = e.timeStamp || nowMs();
            pointerMoved.value = false;
            strokeStamped.value = false;

            /**
             * Production-Verhalten:
             * Ein Tap startet sofort mit genau einem Stamp.
             */
            stampTap(e, p);
        });
    };

    const finishStroke = async (e, cancelled = false) => {
        if (!props.drawing && !lastInputPos.value) return;
        if (activePointerId.value != null && e.pointerId !== activePointerId.value) return;

        /**
         * Fallback nur, wenn aus irgendeinem Grund noch kein Stamp gesetzt wurde.
         * Normaler Single Click erzeugt dadurch NICHT mehr doppelt.
         */
        if (!cancelled && !pointerMoved.value && !strokeStamped.value && lastInputPos.value) {
            stampTap(e, lastInputPos.value);
        }

        const target = inputTarget.value || canvas.value;

        if (target?.releasePointerCapture && activePointerId.value != null) {
            try {
                target.releasePointerCapture(activePointerId.value);
            } catch (_) {
                // Ignore.
            }
        }

        await mouse.up(e);

        emitEvent("drawing-state", false);

        resetBrushCursorDynamics();

        prevInputPos.value = null;
        lastInputPos.value = null;
        lastPos.value = null;
        stampRemainder.value = 0;
        pointerMoved.value = false;
        strokeStamped.value = false;
        activePointerId.value = null;

        register("remove", window, "pointerup", onPointerUp);
        register("remove", window, "pointercancel", onPointerCancel);

        if (target) {
            register("remove", target, moveEventName.value, onPointerMove);
        }
    };

    const onPointerUp = async (e) => {
        await finishStroke(e, false);
    };

    const onPointerCancel = async (e) => {
        await finishStroke(e, true);
    };

    async function _init(unregister = false) {
        if (unregister) {
            /**
             * Nicht committen, solange noch Stamps offen sind.
             */
            await waitForQueueDrain();

            const render = await createLayer();

            if (!render) return;

            await emitEvent("update-layer", render);
            await emitEvent('hide-layer', {
                id: render.id,
                hidden: 1
            });

            await nextTick();

            ctx.value = null;
            inputTarget.value = null;
            register('removeAll');
        } else {
            await setup();

            const target = inputTarget.value || canvas.value;

            register('add', target, 'pointerdown', onPointerDown);
            register('add', target, 'pointermove', onCanvasPointerMove);

            /**
             * Wichtig für Touch/Pen:
             * Verhindert Browser-Gesten während des Zeichnens.
             */
            if (canvas.value) {
                canvas.value.style.touchAction = 'none';
            }

            if (target) {
                target.style.touchAction = 'none';
            }

            register('pause');

            emitEvent('hide-layer', {
                id: props.selectedLayer.id,
                hidden: 0
            });
        }
    }

    watch(() => props.state, async (v) => {
        await nextTick();

        if (v) {
            await _init();
        } else {
            await _init(true);
            console.log('Cleaned Brush-Canvas');
        }
    });

    return {
        canvas,
        buildMatrix,
        emitEvent
    };
}

export const brushProps = {
    state: { type: Boolean, required: true },
    brushMenu: { type: Boolean, required: true },
    currentBrush: { type: Object, required: true },
    drawing: { type: Boolean, required: true },
    viewport: { type: Object, required: true },
    selectedLayer: { type: Object, required: true },
    data: { type: Object, required: true },
    brushes: { type: Array, required: true },
    cursor: { type: String, required: false },
    canvasId: { type: String, required: true },
    mouse: { type: Object, required: false },
    eraser: { type: Boolean, required: false, default: false },

    /**
     * Optional:
     * ID oder HTMLElement vom äußeren Input-Container.
     *
     * Beispiel:
     * <Brush :wrapper="grid.main.id" />
     *
     * Dadurch können große Brushes auch außerhalb vom eigentlichen Canvas
     * angesetzt und bewegt werden, während weiterhin auf dem Canvas gerendert wird.
     */
    wrapper: { type: [String, Object], required: false, default: null },
};