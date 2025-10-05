import {computed, nextTick, onBeforeUnmount, onMounted, ref} from 'vue';
import {eventRegister} from "@/dataLayer/event";

const brushCache = new Map();

export function brushModel(props, emit) {
    const wrapper = ref(null);
    const canvas = ref(null);
    const ctx = ref(null);

    const visible = ref(false);
    const menuPos = ref({ x: 0, y: 0 });

    const currentSize = ref(props.data.size);
    const currentAngle = ref( 0);
    const currentOpacity = ref( 0);

    let lastPos = null;
    let lastTime = null;
    let moved = false;
    let currentBrush = null;
    let drawQueue = [];
    let animating = false;
    let updateTimeout = null;

    const setCursor = computed(() => {
        if (!props.cursor && !props.state && !props.mouse && !props.data.id) return {};

        // Basiswerte
        let size = props.data.size;
        let angle = 0;
        let opacity = 1

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

        const x = props.mouse.x - size / 2;
        const y = props.mouse.y - size / 2;

        return {
            position: 'fixed',
            opacity: opacity,
            left: `${x}px`,
            top: `${y}px`,
            width: `${size}px`,
            height: `${size}px`,
            pointerEvents: 'none',
            zIndex: 9999,
            userSelect: 'none',
            cursor: 'none',
            transform: `rotate(${angle}deg)`
        };
    });

    const emitEvent = (event, payload) => emit('update:component-event', event, payload);

    const { register } = eventRegister('listener:brush', emitEvent);

    const setup = async () => {
        canvas.value = document.getElementById(props.canvasId);
        if (!canvas.value) return console.warn('BRUSH CANVAS NOT INITIALIZED')
        ctx.value = canvas.value.getContext('2d');
        Object.assign(ctx.value, { lineCap: 'round', lineJoin: 'round' });
    };


    const parseColor = (() => {
        const cache = {};
        const cctx = document.createElement('canvas').getContext('2d');
        return (str) => {
            if (cache[str]) return cache[str];
            cctx.fillStyle = str;
            cctx.fillRect(0, 0, 1, 1);
            const [r, g, b, a] = cctx.getImageData(0, 0, 1, 1).data;
            cache[str] = { r, g, b, a: a / 255 };
            return cache[str];
        };
    })();

    const prepareBrush = async (data) => {
        const key = `${data.url}|${data.color}`;
        if (brushCache.has(key)) return brushCache.get(key);

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
        Object.assign(off, { width: img.width, height: img.height });
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

    const enqueue = async ({x, y, alpha, size, angle, flipX, flipY}) => {
        drawQueue.push({x, y, alpha, size, angle, flipX, flipY});
        if (!animating) {
            drawLoop();
        }
        updateQueue();
    };

    /**
     * Erstellt ein neues Layer-Objekt aus dem aktuellen Canvas
     */
    const createLayer = () => {
        if (!canvas.value || !props.selectedLayer) return null;

        const { width: layerWidth, height: layerHeight } = props.selectedLayer;

        // Shadow-Canvas exakt in Layer-Größe
        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = layerWidth;
        shadowCanvas.height = layerHeight;
        const shadowCtx = shadowCanvas.getContext('2d');

        // Direkt den Canvas-Inhalt kopieren (ohne Skalierung)
        shadowCtx.clearRect(0, 0, layerWidth, layerHeight);
        shadowCtx.drawImage(
            canvas.value,
            0, 0, canvas.value.width, canvas.value.height, // Quelle
            0, 0, layerWidth, layerHeight                  // Ziel: exakt Layer-Größe
        );

        const base64 = shadowCanvas.toDataURL('image/png');

        return {
            ...props.selectedLayer,
            base64
        };
    };

    /**
     * Überwacht die DrawQueue und triggert nach 1 Sekunde Inaktivität ein Update
     */
    const updateQueue = () => {
        // Timer zurücksetzen, falls noch aktiv
        if (updateTimeout) clearTimeout(updateTimeout);

        // Neuen Timer setzen
        updateTimeout = setTimeout(async () => {
            // Prüfen: nur ausführen, wenn DrawQueue leer ist
            if (drawQueue.length > 0) return;

            // Neues Layer erstellen
            const render = createLayer();
            if (!render) return;

            // Event feuern
            emitEvent("update-layer", render);

            // Canvas leeren
            if (ctx.value) {
                ctx.value.clearRect(0, 0, canvas.value.width, canvas.value.height);
            }
        }, 2000); // 2 Sekunde Inaktivität
    };

    const drawLoop = () => {
        animating = true;
        requestAnimationFrame(() => {
            while (ctx.value && currentBrush && drawQueue.length) {
                const { x, y, alpha, size, angle, flipX, flipY } = drawQueue.shift();
                const sc = (props.data.scatter / 100) * size;
                const sx = (Math.random() - 0.5) * sc;
                const sy = (Math.random() - 0.5) * sc;
                const jitter = (props.data.jitter / 100) * size;
                const finalSize = Math.max(1, size + (Math.random() - 0.5) * jitter);

                ctx.value.save();
                ctx.value.globalAlpha = alpha;
                ctx.value.globalCompositeOperation = props.data.blendMode;

                ctx.value.translate(x + sx, y + sy);
                ctx.value.scale(flipX ? -1 : 1, flipY ? -1 : 1);
                ctx.value.rotate(angle);
                ctx.value.drawImage(currentBrush, -finalSize / 2, -finalSize / 2, finalSize, finalSize);
                ctx.value.restore();
                lastPos = { x, y };
            }
            animating = false;
        });
    };

    const buildMatrix = (m) => {
        const rad = (m.rotate || 0) * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Kombiniert Translation + Rotation + Scale in einer Matrix
        const a = (m.a ?? 1) * cos;
        const b = (m.a ?? 1) * sin;
        const c = (m.d ?? 1) * -sin;
        const d = (m.d ?? 1) * cos;
        const x = m.x ?? 0;
        const y = m.y ?? 0;

        return `matrix(${a}, ${b}, ${c}, ${d}, ${x}, ${y})`;
    };

    const getTransformedPoint = () => {
        const el = canvas.value;
        if (!el) return { x: 0, y: 0 };

        const x = props.mouse.x;
        const y = props.mouse.y;

        // Hole CSS-Matrix + Transform-Origin
        const style = window.getComputedStyle(el);
        const transform = style.transform;
        const originStr = style.transformOrigin || '0px 0px';
        const [originX, originY] = originStr.split(' ').map(v => parseFloat(v));

        if (!transform || transform === 'none') {
            return { x, y };
        }

        const matrix = new DOMMatrix(transform);

        // Ursprungsverschiebung (wegen transform-origin)
        // Schritt 1: zum Ursprung verschieben
        const preTranslate = new DOMMatrix().translate(originX, originY);
        // Schritt 2: Matrix anwenden
        const fullMatrix = preTranslate.multiply(matrix).multiply(new DOMMatrix().translate(-originX, -originY));

        // Inverse berechnen
        const inverse = fullMatrix.inverse();

        // Punkt transformieren
        const point = new DOMPoint(x, y).matrixTransform(inverse);

        return { x: point.x, y: point.y };
    };


    const onPointerDown = async (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (!props.state) return;

        register('add', canvas.value, 'pointermove', onPointerMove);
        register('add', canvas.value, 'pointerup', onPointerUp);
        register('add', canvas.value, 'pointerleave', onPointerUp);

        emitEvent('drawing-state', true);

        lastPos = getTransformedPoint(e);

        lastTime = Date.now();
        moved = false;
        currentBrush = await prepareBrush(props.data);
    };

    const onPointerMove = async (e) => {
        if (!props.drawing || !lastPos) return;
        moved = true;

        const now = Date.now();

        const curr = getTransformedPoint(e);

        if (!curr) return;

        // === DRUCK / PRESSURE ===
        const rawPressure = e.pressure != null ? e.pressure : props.data.pressure;
        const finalPressure = Math.min(rawPressure * props.data.pressure);

        const dx = curr.x - lastPos.x;
        const dy = curr.y - lastPos.y;
        const dist = Math.hypot(dx, dy);
        const dt = now - lastTime || 16;
        lastTime = now;

        const steps = Math.max(1, Math.floor(dist / getSpacing()));

        for (let i = 1; i <= steps; i++) {
            const x = lastPos.x + dx * (i / steps);
            const y = lastPos.y + dy * (i / steps);

            // === DECKKRAFT / OPACITY ===
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

            // === GRÖSSE / SIZE ===
            let size = props.data.size;

            if (props.data.sizeDynamics) {
                const progress = dt / steps;
                size *= 1 + progress * finalPressure;
                size = Math.min(size - steps, props.data.size);
                currentSize.value = size;
            }

            // === ROTATION ===
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

        lastPos = curr;
    };


    const onPointerUp = async (e) => {
        if (!props.drawing) return;
        if (!moved) await onPointerMove(e);
        emitEvent('drawing-state', false);
        lastPos = null;
        moved = false;
        register('remove', canvas.value, 'pointerup', onPointerUp);
        register('remove', canvas.value, 'pointermove', onPointerMove);
        register('remove', canvas.value, 'pointerleave', onPointerMove);
    };

    const openContextMenu = async (e) => {
        if (!props.state) return;
        e.preventDefault();
        const rect = canvas.value.getBoundingClientRect();
        const relX = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
        const relY = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
        menuPos.value = {
            x: Math.round((relX * props.viewport.width) / rect.width),
            y: Math.round((relY * props.viewport.height) / rect.height),
        };
        visible.value = true;
        await nextTick();
        register('add', document, 'click', closeContextMenu);
    };

    const closeContextMenu = (e) => {
        const menu = document.querySelector('.brush-context-menu');
        if (menu && !menu.contains(e.target)) {
            visible.value = false;
            register('remove', document, 'click', closeContextMenu);
        }
    };

    onMounted(async () => {
        await setup();

        register('add', canvas.value, 'pointerdown', onPointerDown);
        register('add', canvas.value, 'contextmenu', openContextMenu, {prevent: true});

        register('pause');
    });

    onBeforeUnmount(() => {
        register('removeAll');
    });

    return {
        canvas,
        wrapper,
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
    brushLayer: { type: Object, required: true },
    selectedLayer: { type: Object, required: true },
    data: { type: Object, required: true },
    brushes: { type: Array, required: true },
    cursor: { type: String, required: false },
    canvasId: { type: String, required: true },
    mouse: { type: Object, required: false },
};
