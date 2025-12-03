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

import { loadImage } from "@/models/canvas/core/load/model";
import {
    matrixCombine,
    matrixDefault,
} from "@/utils/matrix";
import { blendModeMap } from "@/models/canvas/blend/model";
import { applyTransformMatrix, applyViewTransform, clearCanvas, sortFilter} from "@/models/canvas/core/utils/model";
import { drawBackground } from "@/models/canvas/background/model";
import { computeLayout } from "@/models/canvas/core/layout/model";
import { combinedRenderMatrix } from "@/models/canvas/core/matrix/model";
import { renderSelection, showGrid} from "@/models/canvas/ui/model";

/**
 * Draws a single layer with affine transform
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} transform - transform object -> matrix: {a,b,c,d,x,y,rotate}, dpr: true
 * @param {object} layer - layer object {width,height,url,color,opacity,blend_mode,matrix,_img}
 */
export const drawLayer = async (ctx, layer, transform) => {
    try {
        ctx.save();

        await applyTransformMatrix(ctx, layer, transform);

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

    if (typeof model?.hook?.beforeUpdate === 'function') try { model?.hook.beforeUpdate(model); } catch(e){ console.error('hook.beforeUpdate', e); }

    await clearCanvas(model?.ctx, model?.canvas);
    await applyViewTransform(model?.ctx, model?.canvas, model?.wrapper, model?.viewport, model?.transform, model?.background);

    const layout = await computeLayout(model?.canvas, model?.viewport);
    console.log(layout)
    // Global Base
    if (model?.base && model?.base.length > 0){
        for(const basement of await sortFilter(model?.base)){
            const bw = basement.width ?? model?.canvas.width;
            const bh = basement.height ?? model?.canvas.height;
            const bc = matrixCombine(basement.matrix ?? matrixDefault());
            const bMatrix = combinedRenderMatrix(bc, 0, 0, bw, bh);
            await drawLayer(model?.ctx, basement, {matrix: bMatrix});
        }
    }

    // Global layers
    if (model?.layers && model?.layers.length > 0) {
        for(const layer of await sortFilter(model?.layers)){
            const lw = layer.width ?? model?.canvas.width;
            const lh = layer.height ?? model?.canvas.height;
            const lc = matrixCombine(layer.matrix ?? matrixDefault());
            const lMatrix = combinedRenderMatrix(lc, 0, 0, lw, lh);
            await drawLayer(model?.ctx, layer, {matrix: lMatrix});
        }
    }

    // Segments
    const segEntries = model?._fullscreen && model?.segments.has(model?._fullscreen)
        ? [[model?._fullscreen, model?.segments.get(model?._fullscreen)]]
        : await sortFilter(model?.segments.entries());

    for(const seg of segEntries){
        const sx = layout.colOffset[seg.col] ?? 0;
        const sy = layout.rowOffset[seg.row] ?? 0;
        const sw = layout.colWidths[seg.col] ?? model?.canvas.width;
        const sh = layout.rowHeights[seg.row] ?? model?.canvas.height;
        const segBase = seg.matrix ?? matrixDefault();
        const Mseg = combinedRenderMatrix(segBase, sx, sy, sw, sh);

        model?.ctx.save();
        model.ctx.globalAlpha = seg.opacity;
        if(Mseg) model?.ctx.setTransform(Mseg.a ?? 1, Mseg.b ?? 0, Mseg.c ?? 0, Mseg.d ?? 1, Mseg.x ?? 0, Mseg.y ?? 0);

        if(seg.background) {
            await drawBackground(model?.ctx, model?.canvas, seg.background, {x: sx, y: sy, w: sw, h: sh});
        }

        // Segment layers
        const segLayers = seg.layers
            ? await sortFilter( seg.layers)
            : [];
        for(const layer of segLayers){
            const lw = layer.width ?? sw;
            const lh = layer.height ?? sh;
            const lc = matrixCombine(layer.matrix ?? matrixDefault());
            const lMatrix = combinedRenderMatrix(lc, sx, sy, lw, lh);
            await drawLayer(model?.ctx, layer, {matrix: lMatrix});
        }

        if(typeof seg?.hook?.renderer === 'function') try { seg.hook.renderer(model?.ctx, seg.data, {x: sx, y: sy, width: sw, height: sh}); } catch(e){ console.error('seg.renderer error', e); }

        model?.ctx.restore();

    }

    model?.ctx.restore();

    // Grid
    await showGrid(model, layout);

    // Selection
    await renderSelection(model, layout);

    model.ctx.globalCompositeOperation = "source-over";
    model.ctx.globalAlpha = 1;

    // Hooks after render
    if(typeof model?.hook?.update === 'function') try { model?.hook.update(model); } catch(e){ console.error('hook.update', e); }
    if(typeof model?.hook?.afterUpdate === 'function') try { model?.hook.afterUpdate(model); } catch(e){ console.error('hook.afterUpdate', e); }
} // end render

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