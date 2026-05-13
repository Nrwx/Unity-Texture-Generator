import { computed, nextTick, ref, watch } from 'vue';
import { eventRegister } from "@/dataLayer/event";
import { nowMs } from "@/utils/dayJs";
import { matrixCombine } from "@/utils/matrix";

const brushCache = new Map();

export function brushModel(props, emit) {
    const canvas = ref(null);
    const ctx = ref(null);

    const visible = ref(false);
    const menuPos = ref({ x: 0, y: 0 });

    const currentSize = ref(props.data.size);
    const currentAngle = ref(0);
    const currentOpacity = ref(0);

    const lastPos = ref(null);
    const lastTime = ref(null);
    const pointerMoved = ref(false);
    const currentBrush = ref(null);
    const drawQueue = ref([]);
    const animating = ref(false);

    const localMouse = ref({ x: 0, y: 0 });

    const setCursor = computed(() => {
        if (!props.cursor && !props.state && !props.data.id) return {};

        let size = props.data.size;
        let angle = 0;
        let opacity = 1;

        if (props.data.fadeDynamics) {
            opacity = currentOpacity.value;
        }

        if (props.data.sizeDynamics) {
            size = currentSize.value;
        }

        if (props.data.angleDynamics) {
            angle = currentAngle.value;
        }

        if (props.data.rotationRandom) {
            angle = currentAngle.value;
        }

        return {
            position: 'absolute',
            opacity: opacity,
            left: `${localMouse.value.x}px`,
            top: `${localMouse.value.y}px`,
            width: `${size}px`,
            height: `${size}px`,
            pointerEvents: 'none',
            zIndex: 9999,
            userSelect: 'none',
            cursor: 'none',
            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
            transformOrigin: 'center center'
        };
    });

    const emitEvent = (event, payload) => emit('update:component-event', event, payload);

    const { register } = eventRegister('listener:brush', emitEvent);

    const setup = async () => {
        canvas.value = document.getElementById(props.canvasId);

        if (!canvas.value) {
            return console.warn('BRUSH CANVAS NOT INITIALIZED');
        }

        ctx.value = canvas.value.getContext('2d');

        Object.assign(ctx.value, {
            lineCap: 'round',
            lineJoin: 'round'
        });
    };

    const parseColor = (() => {
        const cache = {};
        const context = document.createElement('canvas').getContext('2d');

        return (str) => {
            if (cache[str]) return cache[str];

            context.fillStyle = str;
            context.fillRect(0, 0, 1, 1);

            const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;

            cache[str] = {
                r,
                g,
                b,
                a: a / 255
            };

            return cache[str];
        };
    })();

    const prepareBrush = async (data) => {
        const key = `${data.url}|${data.color}`;

        if (brushCache.has(key)) {
            return brushCache.get(key);
        }

        emitEvent('generate:cursor', {
            id: data.id,
            size: data.size,
            opacity: data.opacity ?? 1.0,
            rotation: data.angle || 0
        });

        const img = await new Promise((res, rej) => {
            const i = new Image();
            i.crossOrigin = 'Anonymous';
            i.src = data.url;
            i.onload = () => res(i);
            i.onerror = rej;
        });

        const off = document.createElement('canvas');
        Object.assign(off, {
            width: img.width,
            height: img.height
        });

        const octx = off.getContext('2d');
        octx.drawImage(img, 0, 0);

        const imgData = octx.getImageData(0, 0, img.width, img.height);
        const c = parseColor(data.color);

        for (let i = 0; i < imgData.data.length; i += 4) {
            const gray = imgData.data[i];

            imgData.data[i] = c.r;
            imgData.data[i + 1] = c.g;
            imgData.data[i + 2] = c.b;
            imgData.data[i + 3] = gray;
        }

        octx.putImageData(imgData, 0, 0);

        brushCache.set(key, off);

        return off;
    };

    const getSpacing = () => {
        const { spacing, size } = props.data;
        return Math.max(0.5, (spacing / 100) * size);
    };

    const enqueue = async ({ x, y, alpha, size, angle, flipX, flipY }) => {
        drawQueue.value.push({
            x,
            y,
            alpha,
            size,
            angle,
            flipX,
            flipY
        });

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
        animating.value = true;

        requestAnimationFrame(() => {
            while (ctx.value && currentBrush.value && drawQueue.value.length) {
                const {
                    x,
                    y,
                    alpha,
                    size,
                    angle,
                    flipX,
                    flipY
                } = drawQueue.value.shift();

                const sc = (props.data.scatter / 100) * size;
                const sx = (Math.random() - 0.5) * sc;
                const sy = (Math.random() - 0.5) * sc;

                const jitter = (props.data.jitter / 100) * size;
                const finalSize = Math.max(1, size + (Math.random() - 0.5) * jitter);

                ctx.value.save();

                ctx.value.globalAlpha = alpha;
                ctx.value.globalCompositeOperation = props.eraser
                    ? 'destination-out'
                    : props.data.blendMode;

                ctx.value.translate(x + sx, y + sy);
                ctx.value.scale(flipX ? -1 : 1, flipY ? -1 : 1);
                ctx.value.rotate(angle);

                ctx.value.drawImage(
                    currentBrush.value,
                    -finalSize / 2,
                    -finalSize / 2,
                    finalSize,
                    finalSize
                );

                ctx.value.restore();

                lastPos.value = { x, y };
            }

            animating.value = false;
        });
    };

    const buildMatrix = (m) => {
        const matrix = matrixCombine(m);
        return `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.x}, ${matrix.y})`;
    };

    const parseTransformOrigin = (el) => {
        const style = window.getComputedStyle(el);
        const parts = style.transformOrigin.split(" ");

        return {
            x: Number.parseFloat(parts[0]) || 0,
            y: Number.parseFloat(parts[1]) || 0
        };
    };

    const getElementTransformMatrix = (el) => {
        const style = window.getComputedStyle(el);

        if (!style.transform || style.transform === "none") {
            return new DOMMatrix();
        }

        return new DOMMatrix(style.transform);
    };

    const getNodeLocalMatrix = (node) => {
        const origin = parseTransformOrigin(node);
        const transform = getElementTransformMatrix(node);

        return new DOMMatrix()
            .translateSelf(node.offsetLeft || 0, node.offsetTop || 0)
            .translateSelf(origin.x, origin.y)
            .multiplySelf(transform)
            .translateSelf(-origin.x, -origin.y);
    };

    const getAncestorsToDocumentMatrix = (el) => {
        let matrix = new DOMMatrix();

        /**
         * Wichtig:
         * Wir starten NICHT bei el selbst, sondern beim offsetParent.
         * Dadurch wird die Container-Transformation gegengerechnet,
         * aber die eigene Layer-/Canvas-Transformation bleibt erstmal außen vor.
         */
        let node = el.offsetParent;

        while (node && node instanceof HTMLElement) {
            const localMatrix = getNodeLocalMatrix(node);
            matrix = localMatrix.multiply(matrix);
            node = node.offsetParent;
        }

        return matrix;
    };

    const clientToPreLayerPoint = (event) => {
        const el = canvas.value;

        if (!el) {
            return { x: 0, y: 0 };
        }

        const documentPoint = new DOMPoint(
            event.clientX + window.scrollX,
            event.clientY + window.scrollY
        );

        /**
         * Container/Parents invers.
         * Ergebnis: Punkt im Koordinatenraum des Layer-Parents.
         */
        const ancestorsToDocument = getAncestorsToDocumentMatrix(el);
        const documentToAncestors = ancestorsToDocument.inverse();

        const parentPoint = documentPoint.matrixTransform(documentToAncestors);

        /**
         * Jetzt nur noch die Layout-Position des Brush-Layers abziehen.
         * Noch KEINE eigene Layer-Transform invertieren.
         */
        return {
            x: parentPoint.x - (el.offsetLeft || 0),
            y: parentPoint.y - (el.offsetTop || 0)
        };
    };

    const clientToCanvasPoint = (event) => {
        return clientToPreLayerPoint(event);
    };

    const onCanvasPointerMove = (e) => {
        localMouse.value = clientToCanvasPoint(e);
    };

    const onPointerDown = async (e) => {
        if (visible.value || (e.pointerType === 'mouse' && e.button !== 0)) return;
        if (!props.state) return;

        e.preventDefault();

        register('add', window, 'pointermove', onPointerMove);
        register('add', window, 'pointerup', onPointerUp);
        register('add', canvas.value, 'pointerleave', onPointerUp);

        emitEvent('drawing-state', true);

        localMouse.value = clientToCanvasPoint(e);
        lastPos.value = { ...localMouse.value };

        lastTime.value = nowMs();
        pointerMoved.value = false;

        currentBrush.value = await prepareBrush(props.data);
    };

    const onPointerMove = async (e) => {
        if (!props.drawing || !lastPos.value) return;

        e.preventDefault();

        pointerMoved.value = true;

        const now = nowMs();

        const curr = clientToCanvasPoint(e);
        localMouse.value = curr;

        if (!curr) return;

        const rawPressure = e.pressure != null ? e.pressure : props.data.pressure;
        const finalPressure = Math.min(rawPressure * props.data.pressure);

        const dx = curr.x - lastPos.value.x;
        const dy = curr.y - lastPos.value.y;
        const dist = Math.hypot(dx, dy);

        const dt = now - lastTime.value || 16;
        lastTime.value = now;

        const steps = Math.max(1, Math.floor(dist / getSpacing()));

        for (let i = 1; i <= steps; i++) {
            const x = lastPos.value.x + dx * (i / steps);
            const y = lastPos.value.y + dy * (i / steps);

            let alpha = props.data.opacity;

            if (props.data.fadeDynamics) {
                alpha *= props.data.flow;

                const distFactorRaw = Math.min(dist / steps, 1);
                const timeFactorRaw = Math.min(dt * steps, 1);
                const pressureFactor = Math.pow(finalPressure, 1.0);

                const easeIn = t => t * t * t;

                const distFactor = easeIn(distFactorRaw);
                const timeFactor = easeIn(timeFactorRaw);

                const fadeDist = 1 - distFactor * 0.7;
                const fadeTime = 1 - timeFactor * 0.7;

                const fade = fadeDist * fadeTime * pressureFactor;

                alpha *= fade;

                currentOpacity.value = alpha;
            }

            alpha = Math.min(Math.max(alpha, 0), 1);

            let size = props.data.size;

            if (props.data.sizeDynamics) {
                const progress = dt / steps;
                size *= 1 + progress * finalPressure;
                size = Math.min(size - steps, props.data.size);
                currentSize.value = size;
            }

            let angle = (props.data.angle || 0) * (Math.PI / 180);

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

            await enqueue({
                x,
                y,
                alpha,
                size,
                angle,
                flipX: props.data.flipX,
                flipY: props.data.flipY
            });
        }

        lastPos.value = curr;
    };

    const onPointerUp = async (e) => {
        if (!props.drawing) return;

        if (!pointerMoved.value) {
            await onPointerMove(e);
        }

        emitEvent('drawing-state', false);

        lastPos.value = null;
        pointerMoved.value = false;

        register('remove', window, 'pointerup', onPointerUp);
        register('remove', window, 'pointermove', onPointerMove);
        register('remove', canvas.value, 'pointerleave', onPointerUp);
    };

    const openContextMenu = async (e) => {
        if (!props.state) return;

        e.preventDefault();

        const point = clientToCanvasPoint(e);

        menuPos.value = {
            x: Math.round(point.x),
            y: Math.round(point.y)
        };

        visible.value = true;

        await nextTick();

        register('add', window, 'click', closeContextMenu);
    };

    const closeContextMenu = (e) => {
        const menu = document.querySelector('.brush-context-menu');

        if (menu && !menu.contains(e.target)) {
            visible.value = false;
            register('remove', window, 'click', closeContextMenu);
        }
    };

    async function _init(unregister = false) {
        if (unregister) {
            if (drawQueue.value.length > 0) return;

            const render = await createLayer();

            if (!render) return;

            await emitEvent("update-layer", render);
            await emitEvent('hide-layer', {
                id: render.id,
                hidden: 1
            });

            await nextTick();

            ctx.value = null;
            register('removeAll');
        } else {
            await setup();

            register('add', canvas.value, 'pointerdown', onPointerDown);
            register('add', canvas.value, 'pointermove', onCanvasPointerMove);
            register('add', canvas.value, 'contextmenu', openContextMenu, { prevent: true });

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
        visible,
        menuPos,

        setCursor,

        buildMatrix,
        emitEvent
    };
}

export const brushProps = {
    state: { type: Boolean, required: true },
    drawing: { type: Boolean, required: true },
    viewport: { type: Object, required: true },
    selectedLayer: { type: Object, required: true },
    data: { type: Object, required: true },
    brushes: { type: Array, required: true },
    cursor: { type: String, required: false },
    canvasId: { type: String, required: true },
    mouse: { type: Object, required: false },
    eraser: { type: Boolean, required: false, default: false },
};