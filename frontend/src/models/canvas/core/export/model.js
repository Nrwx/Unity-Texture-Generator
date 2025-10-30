// src/canvas/export.js
// ==========================================================
// Export utilities
// - toBase64Export(canvasId, { segId, _fullscreen })
// - exportAllSegmentsToBase64(canvasId)
// ==========================================================
import {
    matrixMultiply,
} from "@/utils/matrix";
import {
    combinedSegmentMatrix,
    combineLayerMatrix,
    transformedCorners
} from "@/models/canvas/core/matrix/model";

import {computeLayout} from "@/models/canvas/core/layout/model";
import {renderToTempCanvas} from "@/models/canvas/core/render/model";
import {loadImage} from "@/models/canvas/core/load/model";

// Main export function: returns { [segId]: { dataUrl, canvas } }
// options: { segId, _fullscreen }
export async function toBase64Export(model, { segId = null, _fullscreen = false } = {}) {
    if (!model) return {};

    const {
        canvas,
        segments,
        rows,
        columns,
        fixed
    } = model;

    if (!canvas) return {};

    // compute layout (use computeLayout directly)
    const layout = computeLayout(canvas, rows, columns, fixed);

    // build list of segments to export
    const segArray = (_fullscreen && segId && segments.has(segId))
        ? [[segId, segments.get(segId)]]
        : (segId ? [[segId, segments.get(segId)]].filter(Boolean) : Array.from(segments.entries()).sort(([a], [b]) => {
            const sa = segments.get(a);
            const sb = segments.get(b);
            return (sa?.order ?? 0) - (sb?.order ?? 0);
        }));

    const out = {};

    for (const [id, seg] of segArray) {
        if (!seg || seg.hidden) continue;

        // layout pos & size
        const sx = layout.colOffset[seg.col] ?? 0;
        const sy = layout.rowOffset[seg.row] ?? 0;
        const sw = layout.colWidths[seg.col] ?? canvas.width;
        const sh = layout.rowHeights[seg.row] ?? canvas.height;

        // full segment transform
        const MsegFull = combinedSegmentMatrix(sx, sy, sw, sh, seg.matrix);

        const layerArray = seg.layers
            ? Array.from(seg.layers.values()).filter(l => !l.hidden && (l.opacity ?? 1) > 0).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            : [];

        if (layerArray.length === 0) continue;

        // compute transformed corners for each layer and collect bounding box
        const allCorners = [];
        const layerMatrices = []; // { layer, lw, lh, Mtotal }

        for (const layer of layerArray) {
            const lw = layer.width ?? sw;
            const lh = layer.height ?? sh;

            const MlayerFull = combineLayerMatrix(sx, sy, lw, lh, layer.matrix);
            const Mtotal = matrixMultiply(MsegFull, MlayerFull);

            const corners = transformedCorners(Mtotal, sx, sy, lw, lh);
            allCorners.push(...corners);
            layerMatrices.push({ layer, lw, lh, Mtotal });
        }

        const xs = allCorners.map(c => c.x);
        const ys = allCorners.map(c => c.y);

        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        const w = Math.max(1, Math.ceil(maxX - minX));
        const h = Math.max(1, Math.ceil(maxY - minY));

        // render into temp canvas
        const res = renderToTempCanvas(w, h, async (ctx) => {
            // shift so that minX/minY maps to 0,0
            ctx.save();
            ctx.translate(-minX, -minY);

            // draw each layer with its computed transform (Mtotal)
            for (const { layer, lw, lh, Mtotal } of layerMatrices) {
                ctx.save();

                // Determine clipping region: intersection of transformed layer bounds
                const layerCorners = transformedCorners(Mtotal, sx, sy, lw, lh);
                const clipMinX = Math.min(...layerCorners.map(c => c.x)) - minX;
                const clipMinY = Math.min(...layerCorners.map(c => c.y)) - minY;
                const clipMaxX = Math.max(...layerCorners.map(c => c.x)) - minX;
                const clipMaxY = Math.max(...layerCorners.map(c => c.y)) - minY;

                ctx.beginPath();
                ctx.rect(clipMinX, clipMinY, clipMaxX - clipMinX, clipMaxY - clipMinY);
                ctx.clip();

                // apply matrix (Mtotal has fields a,b,c,d,x,y)
                ctx.setTransform(
                    Mtotal.a, Mtotal.b,
                    Mtotal.c, Mtotal.d,
                    Mtotal.x, Mtotal.y
                );

                // draw content: prefer cached image if present, else color
                let drew = false;
                if (layer._img && layer._img instanceof HTMLImageElement && layer._img.complete) {
                    ctx.globalAlpha = layer.opacity ?? 1;
                    ctx.globalCompositeOperation = (layer.blend_mode != null) ? (layer.blend_mode) : "source-over";
                    ctx.drawImage(layer._img, sx, sy, lw, lh);
                    drew = true;
                } else if (layer.url) {
                    try {
                        const img = await loadImage(layer.url);
                        if (img) {
                            // cache for subsequent calls (mirror previous behavior)
                            layer._img = img;
                            ctx.globalAlpha = layer.opacity ?? 1;
                            ctx.globalCompositeOperation = (layer.blend_mode != null) ? (layer.blend_mode) : "source-over";
                            ctx.drawImage(img, sx, sy, lw, lh);
                            drew = true;
                        }
                    } catch (e) {
                        console.warn(`[export] could not load image: ${layer.url}`, e);
                    }
                }

                if (!drew && layer.color) {
                    ctx.globalAlpha = layer.opacity ?? 1;
                    ctx.globalCompositeOperation = (layer.blend_mode != null) ? (layer.blend_mode) : "source-over";
                    ctx.fillStyle = layer.color;
                    ctx.fillRect(sx, sy, lw, lh);
                    drew = true;
                }

                ctx.restore();
            }

            ctx.restore();
        });

        out[id] = {
            dataUrl: res.dataUrl,
            canvas: res.canvas,
            bounds: { minX, minY, w, h }
        };
    }

    return out;
}

export async function exportAllSegmentsToBase64(model) {
    return await toBase64Export(model);
}