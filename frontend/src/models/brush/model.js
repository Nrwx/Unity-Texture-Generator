import { nextTick, onMounted, onUnmounted, ref } from 'vue';

const brushCache = new Map();

export function brushModel(props, emit) {
    const canvas = ref(null);
    const ctx = ref(null);
    const visible = ref(false);
    const menuPos = ref({ x: 0, y: 0 });

    let lastPos = null;
    let lastTime = null;
    let drawing = false;
    let moved = false;
    let currentBrush = null;
    let brushReady = false;
    let drawQueue = [];
    let animating = false;
    let lastSmoothedPressure = props.data.pressure;

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

    const enqueue = ({ x, y, alpha, size, angle, flipX, flipY }) => {
        drawQueue.push({ x, y, alpha, size, angle, flipX, flipY });
        if (!animating) drawLoop();
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
        lastSmoothedPressure = props.data.pressure;
        lastTime = Date.now();
        moved = false;
        brushReady = false;
        currentBrush = await prepareBrush(props.data);
        brushReady = true;
        drawing = true;
    };

    const onPointerMove = (e) => {
        if (!drawing || !brushReady || !lastPos) return;
        moved = true;

        const now = Date.now();
        const rect = canvas.value.getBoundingClientRect();
        const curr = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        // Pressure: vom Pointer, oder fallback (Maus 0.5, sonst props.data.pressure)
        const rawPressure = e.pressure != null ? e.pressure : (e.pointerType === 'mouse' ? 0.5 : props.data.pressure);
        const smoothingFactor = 0.2;
        lastSmoothedPressure = lastSmoothedPressure * (1 - smoothingFactor) + rawPressure * smoothingFactor;

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
            let alpha = props.data.opacity // Basis-Opacity * Flow (0..1)

            if (props.data.opacityDynamics) {
                // Druck-basierte Opacity-Dynamik
                alpha = alpha * props.data.flow;
                alpha *= Math.pow(lastSmoothedPressure, 1.0);
            }

            if (props.data.fadeDynamics) {
                alpha = alpha * props.data.flow;

                // Distanz & Zeit normalisiert mit größerem Bereich (z.B. 150 für mehr Länge)
                const distFactorRaw = Math.min(dist / 150, 1);
                const timeFactorRaw = Math.min(dt / 150, 1);
                const pressureFactor = Math.pow(lastSmoothedPressure, 1.0);

                // Cubic Ease-In: langsamer Start, dann steiler Anstieg
                const easeIn = t => t * t * t;

                const distFactor = easeIn(distFactorRaw);
                const timeFactor = easeIn(timeFactorRaw);

                // Fade: umgekehrt, also von 1 (am Anfang) auf 0 (am Ende), hier länger und weicher
                const fadeDist = 1 - distFactor * 0.7;
                const fadeTime = 1 - timeFactor * 0.7;

                const fade = fadeDist * fadeTime * pressureFactor;

                alpha *= fade;
            }

            // Clamp alpha auf [0,1]
            alpha = Math.min(Math.max(alpha, 0), 1);

            // === GRÖSSE / SIZE ===
            let size = props.data.size;

            if (props.data.sizeDynamics) {
                const distFactor = Math.min(dist / 50, 1);
                const timeFactor = Math.min(dt / 50, 1);
                const pressureFactor = Math.pow(lastSmoothedPressure, 1.0);
                const combined = 0.5 + 0.5 * (1 - distFactor) * (1 - timeFactor) * pressureFactor;

                size *= combined;
                const minSize = props.data.size * 0.3;
                const maxSize = props.data.size * 1.2;
                size = Math.min(Math.max(size, minSize), maxSize);
            }

            // === ROTATION ===
            let angle = (props.data.angle * Math.PI) / 180;

            if (props.data.angleDynamics) {
                angle += Math.atan2(dy, dx);
            }

            if (props.data.rotationRandom) {
                angle += Math.random() * Math.PI * 2;
            }

            enqueue({
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
    };
}

export const brushProps = {
    state: { type: Boolean, required: true },
    drawing: { type: Boolean, required: true },
    viewport: { type: Object, required: true },
    data: { type: Object, required: true },
    brushes: { type: Array, required: true },
};
