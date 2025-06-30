import {computed, nextTick, onMounted, onUnmounted, ref} from 'vue';

const brushCache = new Map();

export function brushModel(props, emit) {
    const canvas = ref(null);
    const ctx = ref(null);
    const visible = ref(false);
    const menuPos = ref({ x: 0, y: 0 });

    const currentSize = ref(props.data.size);
    const currentAngle = ref( 0);
    const currentOpacity = ref( 0);

    let lastPos = null;
    let lastTime = null;
    let drawing = false;
    let moved = false;
    let currentBrush = null;
    let brushReady = false;
    let drawQueue = [];
    let animating = false;

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

    const emitEvent = (evt, payload) => emit('update:component-event', evt, payload);

    const initCanvas = () => {
        const el = canvas.value;
        if (!el) return;
        const { width, height } = props.viewport;
        Object.assign(el, { width, height });
        ctx.value = el.getContext('2d');
        Object.assign(ctx.value, { lineCap: 'round', lineJoin: 'round' });
    };

    onMounted(() => {
        initCanvas();
        window.addEventListener('resize', initCanvas);
    });

    onUnmounted(() => {
        window.removeEventListener('resize', initCanvas);
    });

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
            if (props.selected?.[0]?.url) {
                await drawToLayer();
            } else {
                drawLoop();
            }
        }
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

    const onPointerDown = async (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (!props.state) return;
        emitEvent('drawing-state', true);
        const rect = canvas.value.getBoundingClientRect();
        lastPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        lastTime = Date.now();
        moved = false;
        brushReady = false;
        currentBrush = await prepareBrush(props.data);
        brushReady = true;
        drawing = true;
    };

    const onPointerMove = async (e) => {
        if (!drawing || !brushReady || !lastPos) return;
        moved = true;

        const now = Date.now();
        const rect = canvas.value.getBoundingClientRect();
        const curr = {x: e.clientX - rect.left, y: e.clientY - rect.top};

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
                // Größe nimmt im Verlauf der Linie zu
                const progress = dt / steps;
                size *= 1 + progress * finalPressure;
                // Clamp: nicht größer als ursprüngliche Pinselgröße
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

    const drawToLayer = async () => {
        const layer = props.selected?.[0];
        if (!layer || !layer.url) {
            emitEvent('warn', 'Kein Layer ausgewählt. Bitte wählen Sie ein Ziel-Layer aus.');
            return;
        }

        const image = await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = layer.url;
            img.onload = () => resolve(img);
            img.onerror = reject;
        });

        const offCanvas = document.createElement('canvas');
        offCanvas.width = layer.width;
        offCanvas.height = layer.height;
        const offCtx = offCanvas.getContext('2d');

        // Aktuelle Ebene zeichnen (ursprünglicher Zustand)
        offCtx.drawImage(image, 0, 0);

        // Transformation anwenden
        const m = layer.matrix;
        offCtx.setTransform(m.a, m.b, m.c, m.d, m.x, m.y);

        if (m.rotate) {
            const cx = layer.width / 2;
            const cy = layer.height / 2;
            offCtx.translate(cx, cy);
            offCtx.rotate((m.rotate * Math.PI) / 180);
            offCtx.translate(-cx, -cy);
        }

        // Brush-Routine
        while (drawQueue.length && currentBrush) {
            const { x, y, alpha, size, angle, flipX, flipY } = drawQueue.shift();
            const sc = (props.data.scatter / 100) * size;
            const sx = (Math.random() - 0.5) * sc;
            const sy = (Math.random() - 0.5) * sc;
            const jitter = (props.data.jitter / 100) * size;
            const finalSize = Math.max(1, size + (Math.random() - 0.5) * jitter);

            offCtx.save();
            offCtx.globalAlpha = alpha;
            offCtx.globalCompositeOperation = props.data.blendMode;

            offCtx.translate(x + sx, y + sy);
            offCtx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
            offCtx.rotate(angle);
            offCtx.drawImage(currentBrush, -finalSize / 2, -finalSize / 2, finalSize, finalSize);
            offCtx.restore();
        }

        emitEvent('update-layer', {
            ...layer,
            url: offCanvas.toDataURL()
        });
    };





    const onPointerUp = (e) => {
        if (!drawing) return;
        if (!moved) onPointerMove(e);
        emitEvent('drawing-state', false);
        drawing = false;
        lastPos = null;
        moved = false;
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
        document.addEventListener('click', closeContextMenu);
    };

    const closeContextMenu = (e) => {
        const menu = document.querySelector('.brush-context-menu');
        if (menu && !menu.contains(e.target)) {
            visible.value = false;
            document.removeEventListener('click', closeContextMenu);
        }
    };

    const onSavePreset = (name) => {
        emitEvent('save-preset', { name, settings: props.data });
        visible.value = false;
    };

    const onUploadBrush = (file) => {
        emitEvent('upload-brush', file);
        visible.value = false;
    };

    return {
        canvas,
        visible,
        menuPos,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        openContextMenu,
        onSavePreset,
        onUploadBrush,
        emitEvent,
        setCursor
    };
}

export const brushProps = {
    state: { type: Boolean, required: true },
    drawing: { type: Boolean, required: true },
    viewport: { type: Object, required: true },
    data: { type: Object, required: true },
    brushes: { type: Array, required: true },
    cursor: { type: String, required: false },
    mouse: { type: Object, required: false },
    selected: { type: Array, required: false },
};
