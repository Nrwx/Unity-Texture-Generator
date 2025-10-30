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
export async function applyViewTransform(ctx, canvas, wrapper, viewport, transform, background) {
    try {
        if (transform && transform?.matrix) {
            const dpr = getDpr();
            canvas.width = Math.round(viewport?.width * dpr);
            canvas.height = Math.round(viewport?.height * dpr);

            if (wrapper) {
                const zoom = transform.matrix.a || 1;
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
                const finalX = baseCenterX + transform.matrix.x;
                const finalY = baseCenterY + transform.matrix.y;

                canvas.style.position = "absolute";
                canvas.style.left = `${finalX}px`;
                canvas.style.top = `${finalY}px`;
                canvas.style.width = Math.round(newWidth) + "px";
                canvas.style.height = Math.round(newHeight) + "px";

                transform.matrix.d = zoom;
            }

            await clearCanvas(ctx, canvas);
            await resetViewportTransform(ctx);
            await drawBackground(ctx, canvas, background);

            if (!wrapper) {
                await applyTransformMatrix(ctx, canvas, transform);
            }
        }
    } catch (e) {
        console.warn('Fehler beim vorbereiten der viewport transformation;', e);
    }
}

// -----------------------------------------------------------
// applyTransformMatrix(ctx, canvas, transform)
// -----------------------------------------------------------
export async function applyTransformMatrix(ctx, el, transform) {
    try {
        const dpr = getDpr();
        const cx = (el.width / dpr) / 2;
        const cy = (el.height / dpr) / 2;
        ctx.translate(transform.matrix.x, transform.matrix.y);
        if (transform.matrix.rotate) {
            ctx.translate(cx, cy);
            ctx.rotate(deg2rad(transform.matrix.rotate));
            ctx.translate(-cx, -cy);
        }
        ctx.transform(
            transform.matrix.a,
            transform.matrix.b,
            transform.matrix.c,
            transform.matrix.d,
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
export function getCanvasCoords(canvas, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
}