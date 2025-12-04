// ==========================================================
// CANVAS RENDERER
// Responsible for:
//  - Background
//  - Segments
//  - Layers (global + per-segment)
//  - Matrix transforms
//  - Viewport transform (pan/zoom)
//  - Opacity
//  - Order sorting
//  - Hooks (beforeUpdate, renderer, update, afterUpdate)
//  - Grid overlay
//  - Selection outline + handles
// ==========================================================

import {loadImage} from "@/models/canvas/core/load/model";
import {blendModeMap} from "@/models/canvas/blend/model";
import {applyTransformMatrix, applyViewTransform, clearCanvas, sortFilter} from "@/models/canvas/core/utils/model";
import {drawBackground} from "@/models/canvas/background/model";
import {computeLayout, updateSegmentGridData} from "@/models/canvas/core/layout/model";
import {renderSelection, showGrid} from "@/models/canvas/ui/model";
import {matrixMultiply} from "@/utils/matrix";

/**
 * Draws a single layer with affine transform
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} layer - layer object {width,height,url,color,opacity,blend_mode,matrix,_img}
 */
export const drawLayer = async (ctx, layer) => {
    try {
        ctx.save();

        await applyTransformMatrix(ctx, layer, layer?.matrix);

        const lw = layer?.width;
        const lh = layer?.height;

        ctx.globalAlpha = layer?.opacity;
        ctx.globalCompositeOperation = blendModeMap(layer?.blend_mode) || 'source-over';

        if(layer?.color){
            ctx.fillStyle = layer.color;
            ctx.fillRect(0, 0, lw, lh);
        }

        if (layer?.url) {
            if (layer._img && layer._img instanceof HTMLImageElement && layer._img.complete) {
                ctx.drawImage(layer._img, 0, 0, lw, lh);
            } else {
                try {
                    const img = layer.url ? await loadImage(layer.url) : null;
                    if (img) {
                        layer._img = img;
                    }
                    if (img && img.complete) {
                        ctx.drawImage(img, 0, 0, lw, lh);
                    }
                } catch (e) {
                    console.warn('drawLayer: loadImage failed', e);
                }
            }
        }

        ctx.restore();
    } catch (e) {
        console.warn('drawLayer: failed', e);
    }
};

/**
 * Main canvas render function
 * @param {object} model - canvas model object
 */
export async function render(model) {
    if (!model?.canvas || !model?.ctx) return;

    // -------------------
    // Before hooks
    // -------------------
    if (typeof model?.hook?.beforeUpdate === 'function') {
        try { model.hook.beforeUpdate(model); } catch(e){ console.error('hook.beforeUpdate', e); }
    }

    await clearCanvas(model.ctx, model.canvas);
    await applyViewTransform(model.ctx, model.canvas, model.wrapper, model.viewport, model.matrix, model.background);

    const layout = await computeLayout(model.canvas, model.viewport);
    await updateSegmentGridData(model, layout);

    // -------------------
    // Global Base Layers
    // -------------------
    if (model.base?.length) {
        for (const base of await sortFilter(model.base)) {
            await drawLayer(model.ctx, base);
        }
    }

    // -------------------
    // Global Layers
    // -------------------
    if (model.layers?.length) {
        for (const layer of await sortFilter(model.layers)) {
            await drawLayer(model.ctx, layer);
        }
    }

    // -------------------
    // Segments
    // -------------------
    const segArray = model._fullscreen
        ? model.segments.filter(s => s.id === model._fullscreen)
        : await sortFilter(model.segments);

    for (const seg of segArray) {
        const sx = seg.matrix.x;
        const sy = seg.matrix.y;
        const sw = seg.width;
        const sh = seg.height;

        model.ctx.save();
        model.ctx.globalAlpha = seg.opacity ?? 1;
        await applyTransformMatrix(model.ctx, seg, seg.matrix);

        // Segment background
        if (seg.background) {
            await drawBackground(model.ctx, model.canvas, seg.background, { x: sx, y: sy, w: sw, h: sh });
        }

        // Segment Layers
        const segLayers = seg.layers ? await sortFilter(seg.layers) : [];
        for (const layer of segLayers) {
            layer.matrix = matrixMultiply(seg.matrix, layer.matrix);
            await drawLayer(model.ctx, layer);
        }

        model.ctx.restore();
    }

    model.ctx.restore();

    // -------------------
    // Grid
    // -------------------
    await showGrid(model, layout);

    // -------------------
    // Selection
    // -------------------
    await renderSelection(model, layout);

    model.ctx.globalCompositeOperation = "source-over";
    model.ctx.globalAlpha = 1;

    // -------------------
    // After hooks
    // -------------------
    if (typeof model?.hook?.update === 'function') try { model.hook.update(model); } catch(e){ console.error('hook.update', e); }
    if (typeof model?.hook?.afterUpdate === 'function') try { model.hook.afterUpdate(model); } catch(e){ console.error('hook.afterUpdate', e); }
    console.log(model)
}

/**
 * Render a temporary canvas with a given width, height, and render function
 * @param {number} width
 * @param {number} height
 * @param {(ctx: CanvasRenderingContext2D)=>void} renderFn
 * @returns {{canvas:HTMLCanvasElement, dataUrl:string}}
 */
export const renderToTempCanvas = (width, height, renderFn) => {
    const w = Math.max(1, Math.ceil(width));
    const h = Math.max(1, Math.ceil(height));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if(!ctx) throw new Error('Canvas-Context konnte nicht erstellt werden');
    renderFn(ctx);
    return { canvas, dataUrl: canvas.toDataURL() };
};