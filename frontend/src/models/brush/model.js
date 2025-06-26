import {nextTick, onMounted, onUnmounted, ref} from 'vue';
import dayjs from 'dayjs';

const brushCache = new Map();

export function brushModel(props, emit) {
    const canvas = ref(null);
    const ctx = ref(null);
    const visible = ref(false);
    const menuPos = ref({ x: 0, y: 0 });
    const minDeltaPressureThreshold = 0.01;

    let lastPos = null;
    let drawing = false;
    let moved = false;
    let currentBrush = null;
    let brushReady = false;
    let drawQueue = [];
    let animating = false;
    let strokeStartTime = null;
    let lastSmoothedPressure = 1;

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
    onUnmounted(() => window.removeEventListener('resize', initCanvas));

    const parseColor = (() => {
        const cache = {};
        const cctx = document.createElement('canvas').getContext('2d');
        return str => {
            if (cache[str]) return cache[str];
            cctx.fillStyle = str;
            cctx.fillRect(0, 0, 1, 1);
            const [r, g, b, a] = cctx.getImageData(0, 0, 1, 1).data;
            return (cache[str] = { r, g, b, a: a / 255 });
        };
    })();

    const prepareBrush = async data => {
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
            imgData.data[i]   = c.r;
            imgData.data[i+1] = c.g;
            imgData.data[i+2] = c.b;
            imgData.data[i+3] = gray;
        }
        octx.putImageData(imgData, 0, 0);
        brushCache.set(key, off);
        return off;
    };

    const getSpacing = () => {
        const baseSpacing = props.data.spacing;
        const size = props.data.size;
        const scale = Math.log2(Math.max(1, size)) / 6;
        return Math.max(0.5, baseSpacing * (1 + scale));
    };

    const calculateAlphaWithPressure = ({ pressure, size, opacity, timeDelta }) => {
        const pressureCurve = Math.pow(pressure, 2.2);

        // Zeitbasiertes sanftes An- und Ausblenden
        const fadeInDuration = 150;
        const fadeOutDuration = 150;
        const strokeTime = Math.min(timeDelta, fadeInDuration + fadeOutDuration);

        let timeFactor = 1.0;
        if (strokeTime < fadeInDuration) {
            timeFactor = 0.2 + 0.8 * (strokeTime / fadeInDuration); // langsames Einfaden
        } else if (strokeTime > 1000) {
            const fadeOut = Math.max(0, 1 - (strokeTime - 1000) / fadeOutDuration);
            timeFactor = Math.max(0.1, fadeOut);
        }

        const visualSizeFactor = normalizeSmallSizeOpacity(size, pressure, timeDelta);

        // Gesamtes Alpha
        return opacity * pressureCurve * timeFactor * visualSizeFactor;
    };

    const normalizeSmallSizeOpacity = (size, pressure, timeDelta) => {
        if (size >= 6) return 1;

        const maxBoost = 1.6 + (6 - size) * 0.15; // sanft auf 2–2.2x boost
        const timeFade = Math.min(timeDelta, 300) / 300; // Anfang = 0, später = 1
        const pressureCurve = Math.pow(pressure, 0.7);   // bei wenig Druck mehr boost

        const fadeBoost = 1 + (maxBoost - 1) * (1 - timeFade);

        return fadeBoost * (1 + (1 - pressureCurve) * 0.3);
    };

    const interpolateWithPressure = (start, end, rawPressure = 1) => {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dist = Math.hypot(dx, dy);
        const spacing = getSpacing();
        const steps = Math.max(1, Math.floor(dist / spacing));

        // Pressure smoothing (Low-pass filter)
        const smoothedPressure = lastSmoothedPressure * 0.8 + rawPressure * 0.2;
        lastSmoothedPressure = smoothedPressure;

        const now = dayjs();
        const timeDelta = now.diff(strokeStartTime, 'millisecond');

        const points = Array.from({ length: steps }, (_, i) => ({
            x: start.x + dx * ((i + 1) / steps),
            y: start.y + dy * ((i + 1) / steps),
        }));

        const alphaPerStamp = calculateAlphaWithPressure({
            pressure: smoothedPressure,
            size: props.data.size,
            opacity: props.data.opacity,
            timeDelta,
        });

        return { points, alphaPerStamp };
    };

    const enqueueStamp = (x, y, alpha) => {
        drawQueue.push({ x, y, alpha });
        if (!animating) processDrawQueue();
    };

    const processDrawQueue = () => {
        animating = true;
        requestAnimationFrame(() => {
            while (drawQueue.length && ctx.value && currentBrush) {
                const { x, y, alpha } = drawQueue.shift();
                const jitter = (props.data.jitter / 100) * props.data.size;
                const size = props.data.size + (Math.random() - 0.5) * jitter;
                ctx.value.save();
                ctx.value.globalAlpha = alpha;
                ctx.value.globalCompositeOperation = props.data.blendMode;
                ctx.value.translate(x, y);
                ctx.value.rotate((props.data.angle * Math.PI) / 180);
                ctx.value.drawImage(currentBrush, -size / 2, -size / 2, size, size);
                ctx.value.restore();
            }
            drawQueue.length ? processDrawQueue() : (animating = false);
        });
    };

    const onPointerDown = async e => {
        if (!props.state) return;
        emitEvent('drawing-state', true);
        const { left, top } = canvas.value.getBoundingClientRect();
        lastPos = { x: e.clientX - left, y: e.clientY - top };
        strokeStartTime = dayjs();
        moved = false;
        lastSmoothedPressure = e.pressure ?? 1;
        brushReady = false;
        currentBrush = await prepareBrush(props.data);
        brushReady = true;
        drawing = true;
    };

    const onPointerMove = e => {
        if (!drawing || !brushReady || !lastPos) return;
        moved = true;
        const { left, top } = canvas.value.getBoundingClientRect();
        const curr = { x: e.clientX - left, y: e.clientY - top };

        const rawPressure = e.pressure ?? 1;

        // Druckdifferenz prüfen
        const deltaPressure = Math.abs(rawPressure - lastSmoothedPressure);

        // Wenn der Druckunterschied klein ist, verwenden wir den letzten geglätteten Druck für das Zeichnen
        // und aktualisieren lastPos normal für das Ziehen
        if (deltaPressure < minDeltaPressureThreshold) {
            // Verwende lastSmoothedPressure für das Zeichnen
            const { points, alphaPerStamp } = interpolateWithPressure(lastPos, curr, lastSmoothedPressure);
            points.forEach(p => enqueueStamp(p.x, p.y, alphaPerStamp));
            lastPos = curr;
            // Druck nicht updaten, bleibt geglättet (lastSmoothedPressure bleibt gleich)
            return;
        }

        // Wenn großer Druckunterschied, glätten und aktualisieren
        const { points, alphaPerStamp } = interpolateWithPressure(lastPos, curr, rawPressure);
        points.forEach(p => enqueueStamp(p.x, p.y, alphaPerStamp));
        lastPos = curr;
    };

    const onPointerUp = e => {
        if (!drawing) return;
        if (!moved) {
            const { x, y } = lastPos;
            const { alphaPerStamp } = interpolateWithPressure(lastPos, lastPos, e.pressure ?? 1);
            enqueueStamp(x, y, alphaPerStamp);
        }
        emitEvent('drawing-state', false);
        drawing = false;
        lastPos = null;
    };

    const openContextMenu = async e => {
        if (!props.state) return;
        e.preventDefault();
        const { left, top, width, height } = canvas.value.getBoundingClientRect();
        const relX = Math.min(Math.max(e.clientX - left, 0), width);
        const relY = Math.min(Math.max(e.clientY - top, 0), height);
        const scaleX = props.viewport.width / width;
        const scaleY = props.viewport.height / height;
        menuPos.value = { x: Math.round(relX * scaleX), y: Math.round(relY * scaleY) };
        visible.value = true;
        await nextTick();
        document.addEventListener('click', closeContextMenu);
    };

    const closeContextMenu = e => {
        const menu = document.querySelector('.brush-context-menu');
        if (menu && !menu.contains(e.target)) {
            visible.value = false;
            document.removeEventListener('click', closeContextMenu);
        }
    };

    const onSavePreset = name => {
        emitEvent('save-preset', { name, settings: props.data });
        visible.value = false;
    };
    const onUploadBrush = file => {
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
