// -------------------- Helfer: renderSelection --------------------
import {combinedRenderMatrix} from "@/models/canvas/core/matrix/model";
import {
    matrixApply3x3Affine,
    matrixCombine,
    matrixDefault,
    matrixMultiply3x3Affine,
    matrixTo3x3Affine
} from "@/utils/matrix";
import {applyViewTransform} from "@/models/canvas/core/utils/model";

export async function showGrid(model, layout) {
    if(!model?.showGrid || !layout || layout.isSingle) return;
    try {
        model?.ctx.save();
        await applyViewTransform(model?.ctx, model?.canvas, model?.wrapper, model?.viewport, model?.transform, model?.background);
        model.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        model.lineWidth = 1;
        (layout.colOffset || []).forEach(o => {
            model?.ctx.beginPath();
            model?.ctx.moveTo(o,0);
            model?.ctx.lineTo(o, model?.canvas.height);
            model?.ctx.stroke();
        });
        (layout.rowOffset || []).forEach(o => {
            model?.ctx.beginPath();
            model?.ctx.moveTo(0,o);
            model?.ctx.lineTo(model?.canvas.width,o);
            model?.ctx.stroke();
        });
        model?.ctx.restore();
        console.log('grid overlaay');
    } catch(e) {
        console.error('showGrid error', e);
        try { model?.ctx.restore(); } catch(e) {
            console.log(e)}
    }
}

/**
 * Zeichnet Auswahl (segment, layer global/segment/base).
 * Gibt true zurück, wenn render() vorher beendet werden soll (originales Verhalten).
 */
export async function renderSelection(model, layout) {
    if (!layout) return false;

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
        console.log('select segment');
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
                return true; // original: returned from render
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
            return true; // original: returned from render
        }

    }

    return false;
}

// -------------------- drawCornerHandles (bleibt, ggf. umbenennen) --------------------
/**
 * draw small handles for transform (scale/rotate) at corners
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x:number,y:number}>} corners
 * @param {number} handleSize
 */
export const drawCornerHandles = (ctx, corners, handleSize = 8) => {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.strokeStyle = "rgba(30,144,255,0.95)";
    ctx.lineWidth = 1;
    for (const c of corners) {
        ctx.beginPath();
        ctx.rect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
};