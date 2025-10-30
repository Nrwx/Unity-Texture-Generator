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
    matrixApply3x3Affine,
    matrixCombine,
    matrixDefault,
    matrixMultiply3x3Affine,
    matrixTo3x3Affine
} from "@/utils/matrix";
import { blendModeMap } from "@/models/canvas/blend/model";
import {applyTransformMatrix, applyViewTransform, clearCanvas, sortFilter} from "@/models/canvas/core/utils/model";
import { drawBackground } from "@/models/canvas/background/model";
import { computeLayout } from "@/models/canvas/core/layout/model";
import { combinedRenderMatrix } from "@/models/canvas/core/matrix/model";
import {drawCornerHandles} from "@/models/canvas/ui/model";

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
export async function render(model ) {
    if (!model?.canvas || !model?.ctx) return;

    if (typeof model?.hook?.beforeUpdate === 'function') try { model?.hook.beforeUpdate(model); } catch(e){ console.error('hook.beforeUpdate', e); }

    await clearCanvas(model?.ctx, model?.canvas);
    await applyViewTransform(model?.ctx, model?.canvas, model?.wrapper, model?.viewport, model?.transform, model?.background);

    const layout = await computeLayout(model?.canvas, model?.rows, model?.columns, model?.viewport);
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
        console.log('itterate segs')

    }

    model?.ctx.restore();

    // Grid overlay
    if(model?.showGrid && layout && !layout.isSingle){
        model?.ctx.save();
        await applyViewTransform(model?.ctx, model?.canvas, model?.wrapper, model?.viewport, model?.transform, model?.background);
        model.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        model.lineWidth = 1;
        (layout.colOffset || []).forEach(o => { model?.ctx.beginPath(); model?.ctx.moveTo(o,0); model?.ctx.lineTo(o, model?.canvas.height); model?.ctx.stroke(); });
        (layout.rowOffset || []).forEach(o => { model?.ctx.beginPath(); model?.ctx.moveTo(0,o); model?.ctx.lineTo(model?.canvas.width,o); model?.ctx.stroke(); });
        model?.ctx.restore();
        console.log('grid overlaay')
    }

    // Selection: segment
    if(model?.selectedSegmentId && model?.segments.has(model?.selectedSegmentId)){
        const seg = model?.segments.get(model?.selectedSegmentId);
        const sx = layout.colOffset[seg.col] ?? 0;
        const sy = layout.rowOffset[seg.row] ?? 0;
        const sw = layout.colWidths[seg.col];
        const sh = layout.rowHeights[seg.row];
        const MsegFull = combinedRenderMatrix(seg.matrix ?? matrixDefault(), sx, sy, sw, sh);
        const corners = [
            matrixApply3x3Affine(matrixTo3x3Affine(MsegFull), sx, sy),
            matrixApply3x3Affine(matrixTo3x3Affine(MsegFull), sx+sw, sy),
            matrixApply3x3Affine(matrixTo3x3Affine(MsegFull), sx+sw, sy+sh),
            matrixApply3x3Affine(matrixTo3x3Affine(MsegFull), sx, sy+sh)
        ];
        model?.ctx.save();
        model.ctx.lineWidth = 2;
        model.ctx.strokeStyle = 'rgba(30,144,255,0.95)';
        model?.ctx.setLineDash([6,3]);
        model?.ctx.beginPath();
        model?.ctx.moveTo(corners[0].x, corners[0].y);
        for(let i=1;i<corners.length;i++) model?.ctx.lineTo(corners[i].x, corners[i].y);
        model?.ctx.closePath();
        model?.ctx.stroke();
        model?.ctx.restore();
        console.log('select segment')
    }

    // Selection: LAYER (segment → global → base)
    if (model?.selectedLayer?.layerId) {

        // ---------- 1) Segment layer ----------
        if (model?.selectedLayer?.segId && model?.segments.has(model?.selectedLayer.segId)) {

            const seg = model?.segments.get(model?.selectedLayer.segId);
            const sx = layout.colOffset[seg.col] ?? 0;
            const sy = layout.rowOffset[seg.row] ?? 0;
            const sw = layout.colWidths[seg.col];
            const sh = layout.rowHeights[seg.row];
            const layer = seg.layers.get(model?.selectedLayer.layerId);

            if (layer) {
                const lw = layer.width ?? sw;
                const lh = layer.height ?? sh;
                const MsegFull = combinedRenderMatrix(seg.matrix ?? matrixDefault(), sx, sy, sw, sh);
                const lMatrixLocal = combinedRenderMatrix(matrixCombine(layer.matrix ?? matrixDefault()), sx, sy, lw, lh);
                const Tot = matrixMultiply3x3Affine(matrixTo3x3Affine(MsegFull), matrixTo3x3Affine(lMatrixLocal));

                const pts = [
                    matrixApply3x3Affine(Tot, sx,     sy),
                    matrixApply3x3Affine(Tot, sx+lw, sy),
                    matrixApply3x3Affine(Tot, sx+lw, sy+lh),
                    matrixApply3x3Affine(Tot, sx,     sy+lh)
                ];

                model?.ctx.save();
                model.ctx.lineWidth = 2;
                model.ctx.strokeStyle = 'rgba(30,144,255,0.95)';
                model?.ctx.setLineDash([6,3]);
                model?.ctx.beginPath();
                model?.ctx.moveTo(pts[0].x, pts[0].y);
                for(let i=1;i<pts.length;i++) model?.ctx.lineTo(pts[i].x, pts[i].y);
                model?.ctx.closePath();
                model?.ctx.stroke();
                model?.ctx.restore();
                drawCornerHandles(model?.ctx, pts, 10);

                console.log('selection-layer(seg)');
                return;
            }
        }

        // ---------- 2) Global layer ----------
        if (model?.layers?.find(x => x.id === model?.selectedLayer.layerId)) {
            const layer = model?.layers?.find(x => x.id === model?.selectedLayer.layerId);
            const lw = layer.width ?? model?.canvas.width;
            const lh = layer.height ?? model?.canvas.height;
            const lc = matrixCombine(layer.matrix ?? matrixDefault());
            const lMatrix = combinedRenderMatrix(lc, 0, 0, lw, lh);

            const pts = [
                matrixApply3x3Affine(matrixTo3x3Affine(lMatrix), 0,   0),
                matrixApply3x3Affine(matrixTo3x3Affine(lMatrix), lw,  0),
                matrixApply3x3Affine(matrixTo3x3Affine(lMatrix), lw,  lh),
                matrixApply3x3Affine(matrixTo3x3Affine(lMatrix), 0,   lh)
            ];

            model?.ctx.save();
            model.ctx.lineWidth = 2;
            model.ctx.strokeStyle = 'rgba(30,144,255,0.95)';
            model?.ctx.setLineDash([6,3]);
            model?.ctx.beginPath();
            model?.ctx.moveTo(pts[0].x, pts[0].y);
            for(let i=1;i<pts.length;i++) model?.ctx.lineTo(pts[i].x, pts[i].y);
            model?.ctx.closePath();
            model?.ctx.stroke();
            model?.ctx.restore();
            drawCornerHandles(model?.ctx, pts, 10);
        }

        // ---------- 3) Base layer ----------
        if (!model?.selectedLayer?.segId && model?.base?.find(x => x.id === model?.selectedLayer.layerId)) {
            const layer = model?.base?.find(x => x.id === model?.selectedLayer.layerId);
            const lw = layer.width ?? model?.canvas.width;
            const lh = layer.height ?? model?.canvas.height;
            const lc = matrixCombine(layer.matrix ?? matrixDefault());
            const lMatrix = combinedRenderMatrix(lc, 0, 0, lw, lh);

            const pts = [
                matrixApply3x3Affine(matrixTo3x3Affine(lMatrix), 0,   0),
                matrixApply3x3Affine(matrixTo3x3Affine(lMatrix), lw,  0),
                matrixApply3x3Affine(matrixTo3x3Affine(lMatrix), lw,  lh),
                matrixApply3x3Affine(matrixTo3x3Affine(lMatrix), 0,   lh)
            ];

            model?.ctx.save();
            model.ctx.lineWidth = 2;
            model.ctx.strokeStyle = 'rgba(30,144,255,0.95)';
            model?.ctx.setLineDash([6,3]);
            model?.ctx.beginPath();
            model?.ctx.moveTo(pts[0].x, pts[0].y);
            for(let i=1;i<pts.length;i++) model?.ctx.lineTo(pts[i].x, pts[i].y);
            model?.ctx.closePath();
            model?.ctx.stroke();
            model?.ctx.restore();
            drawCornerHandles(model?.ctx, pts, 10);

            console.log('selection-layer(base)');
            return;
        }

    }

    model.ctx.globalCompositeOperation = "source-over";
    model.ctx.globalAlpha = 1;

    // Hooks after render
    if(typeof model?.hook?.update === 'function') try { model?.hook.update(model); } catch(e){ console.error('hook.update', e); }
    if(typeof model?.hook?.afterUpdate === 'function') try { model?.hook.afterUpdate(model); } catch(e){ console.error('hook.afterUpdate', e); }
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