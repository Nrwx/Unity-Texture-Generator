// ==========================================================
// General utilities shared across canvas modules
// ==========================================================

// -----------------------------------------------------------
// safeCall(fn)
// Wraps optional hook calls to avoid breaking the renderer
// -----------------------------------------------------------
import {deg2rad, matrixDefault} from "@/utils/matrix";
import {drawBackground} from "@/models/canvas/background/model";

export const ensureModel = (id, ref) => ref.get(id);

export const ensureCanvasModel = async (m) => {
    if (!m) return;

    // ensure canvas + ctx
    if (!(m.canvas instanceof HTMLCanvasElement)) return;
    if (!m.ctx) m.ctx = m.canvas.getContext("2d");

    // ensure basic objects
    if (!m.background) m.background = "checker";

    if (!m.viewport) {
        m.viewport = {width: 256, height: 256, rows: 1, columns: 1};
    }

    if (!m.matrix) m.matrix = matrixDefault();

    if (!Array.isArray(m.base)) m.base = [];
    if (!Array.isArray(m.layers)) m.layers = [];
    if (!Array.isArray(m.segments)) m.segments = [];

    // ensure each base has matrix
    for (const b of m.base) {
        if (!b.matrix) b.matrix = matrixDefault();
    }

    // ensure each layer has matrix
    for (const l of m.layers) {
        if (!l.matrix) l.matrix = matrixDefault();
    }

    // ensure segments
    for (const seg of m.segments) {
        if (!seg.matrix) seg.matrix = matrixDefault();

        if (!Array.isArray(seg.layers)) seg.layers = [];
        if (!Array.isArray(seg.base)) seg.base = [];

        // ensure sub layers have matrix
        for (const l of seg.layers) {
            if (!l.matrix) l.matrix = matrixDefault();
        }
    }

    // selection guard
    if (!m.selectedLayer) {
        m.selectedLayer = {segId: null, layerId: null};
    }
    if (!m.selectedSegmentId) m.selectedSegmentId = null;
    if (!m._fullscreen) m._fullscreen = null;

    return m;
};


export const makeDefaultSegment = () => {
    return {
        id: "",
        row: 0,
        col: 0,
        width: 100,
        height: 100,
        opacity: 1,
        background: null,
        matrix: matrixDefault(),
        base: [],
        layers: []
    };
}


export function safeCall(fn) {
    try {
        return fn();
    } catch (err) {
        console.error('[CanvasEnvironment] Hook error:', err);
    }
}

// -----------------------------------------------------------
// toNumber(v, def = 0)
// Converts to number safely
// -----------------------------------------------------------
export function toNumber(v, def = 0) {
    const n = Number(v);
    return isFinite(n) ? n : def;
}

// -----------------------------------------------------------
// toNumber(v, def = 0)
// Converts to number safely
// -----------------------------------------------------------
export async function sortFilter(v) {
    return Array.from(v)
        .filter(x => x.hidden !== 1 && (x.opacity ?? 1) > 0)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// -----------------------------------------------------------
// clamp(n, min, max)
// -----------------------------------------------------------
export function clamp(n, min, max) {
    return Math.max(min, Math.min(n, max));
}

// -----------------------------------------------------------
// applyViewTransform(ctx, canvas, transform)
// Generic transform before rendering, used by renderer & export
// transform = { mode: 'none'|'panzoom', x, y, scaleX, scaleY }
// -----------------------------------------------------------
export async function applyViewTransform(ctx, canvas, wrapper, viewport, matrix, background) {
    try {
        if (matrix) {
            const dpr = getDpr();
            canvas.width = Math.round(viewport?.width * dpr);
            canvas.height = Math.round(viewport?.height * dpr);

            if (wrapper) {
                const zoom = matrix.a || 1;
                wrapper = canvas.parentElement;

                const scale = zoom * Math.min(
                    wrapper.clientWidth / viewport.width || dpr,
                    wrapper.clientHeight / viewport.height || dpr
                );

                const newWidth = viewport.width * scale;
                const newHeight = viewport.height * scale;

                // Basis-Zentrierung im Wrapper
                const baseCenterX = (wrapper.clientWidth - newWidth) / 2;
                const baseCenterY = (wrapper.clientHeight - newHeight) / 2;

                // transform.matrix.x / y werden korrekt addiert!
                const finalX = baseCenterX + matrix.x;
                const finalY = baseCenterY + matrix.y;

                canvas.style.position = "absolute";
                canvas.style.left = `${finalX}px`;
                canvas.style.top = `${finalY}px`;
                canvas.style.width = Math.round(newWidth) + "px";
                canvas.style.height = Math.round(newHeight) + "px";

                matrix.d = zoom;
            }

            await clearCanvas(ctx, canvas);
            await resetViewportTransform(ctx);
            await drawBackground(ctx, canvas, background);

            if (!wrapper) {
                await applyTransformMatrix(ctx, canvas, matrix);
            }
        }
    } catch (e) {
        console.warn('Fehler beim vorbereiten der viewport transformation;', e);
    }
}

// -----------------------------------------------------------
// applyTransformMatrix(ctx, canvas, transform)
// -----------------------------------------------------------
export async function applyTransformMatrix(ctx, el, matrix) {
    try {
        const dpr = getDpr();
        const cx = (el.width / dpr) / 2;
        const cy = (el.height / dpr) / 2;
        ctx.translate(matrix.x, matrix.y);
        if (matrix.rotate) {
            ctx.translate(cx, cy);
            ctx.rotate(deg2rad(matrix.rotate));
            ctx.translate(-cx, -cy);
        }
        ctx.transform(
            matrix.a,
            matrix.b,
            matrix.c,
            matrix.d,
            0, 0
        );
    } catch (e) {
        console.warn('Fehler beim anwenden der viewport transformation;', e);
    }
}

// -----------------------------------------------------------
// clearCanvas(ctx, canvas)
// -----------------------------------------------------------
export async function clearCanvas(ctx, canvas) {
    try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch (e) {
        console.warn('Fehler beim bereinigen des viewports;', e);
    }
}

export function getDpr() {
    try {
        return window.devicePixelRatio || 1;
    } catch (e) {
        return console.warn('Fehler beim ermitteln der Geräte-Pixel-Dimension', e);
    }
}

export async function resetViewportTransform(ctx) {
    try {
        const dpr = getDpr();
        const {a, b, c ,d, x, y, rotate} = matrixDefault();
        ctx.setTransform(a, b, c, d, x, y);
        ctx.rotate(deg2rad(rotate));
        ctx.scale(dpr, dpr);
    } catch (e) {
        console.warn('Fehler beim zurückstzen des viewports;', e);
    }
}

// -----------------------------------------------------------
// rectCorners(x, y, w, h)
// quickly returns the 4 corners (not transformed)
// -----------------------------------------------------------
export function rectCorners(x, y, w, h) {
    return [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h }
    ];
}

// -----------------------------------------------------------
// getCanvasCoords(canvas, clientX, clientY)
// maps mouse to canvas space
// -----------------------------------------------------------
export function getCanvasCoords(model, clientX, clientY) {
    const canvas = model.canvas;
    const dpr = getDpr();

    if (model.wrapper) {
        const wrapper = canvas.parentElement;
        const rect = wrapper.getBoundingClientRect();

        // client -> wrapper space
        const rx = clientX - rect.left;
        const ry = clientY - rect.top;

        // zoom (aus matrix) und scale (wie in applyViewTransform)
        const zoom = model.matrix?.a ?? 1;
        const scale = Math.min(
            wrapper.clientWidth / model.viewport.width,
            wrapper.clientHeight / model.viewport.height
        ) * zoom;

        const newWidth = model.viewport.width * scale;
        const newHeight = model.viewport.height * scale;

        const baseCenterX = (wrapper.clientWidth - newWidth) / 2;
        const baseCenterY = (wrapper.clientHeight - newHeight) / 2;

        const finalX = baseCenterX + (model.matrix?.x || 0);
        const finalY = baseCenterY + (model.matrix?.y || 0);

        return {
            x: ((rx - finalX) / scale) * dpr,
            y: ((ry - finalY) / scale) * dpr
        };
    }

    // CASE 2 — Canvas ohne Wrapper
    const rect = canvas.getBoundingClientRect();
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

