import {
    matrixApply,
    matrixDefault, matrixMultiply,
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
    const ctx = model?.ctx;
    if (!ctx) return false;

    // ============================
    // SEGMENT SELECTION
    // ============================
    if(model?.selectedSegmentId){
        const seg = model.segments.find(s => s.id === model.selectedSegmentId);
        if(seg){
            const M = seg.matrix;

            const w = seg.width;
            const h = seg.height;

            const localCorners = [
                {x:0, y:0},
                {x:w, y:0},
                {x:w, y:h},
                {x:0, y:h}
            ];
            const corners = localCorners.map(p => matrixApply(M, p));

            renderSelectionBox(ctx, corners);
        }
    }

    // ============================
    // LAYER SELECTION
    // ============================
    if (model?.selectedLayer?.layerId) {

        // ------ Segment-Layer ------
        if (model?.selectedLayer?.segId){
            const seg = model.segments.find(x => x.id === model.selectedLayer.segId);
            const layer = seg?.layers?.find(x => x.id === model.selectedLayer.layerId);
            if(seg && layer){
                const Mseg = seg.matrix;
                const Mlayer = layer.matrix ?? matrixDefault();
                const Mtotal = matrixMultiply(Mseg, Mlayer);

                const w = layer.width ?? seg.width;
                const h = layer.height ?? seg.height;

                const pts = [
                    matrixApply(Mtotal,{x:0,y:0}),
                    matrixApply(Mtotal,{x:w,y:0}),
                    matrixApply(Mtotal,{x:w,y:h}),
                    matrixApply(Mtotal,{x:0,y:h})
                ];

                renderSelectionBox(ctx, pts);
                drawCornerHandles(ctx, pts, 10);

                console.log('selection-layer(seg)');
                return true;
            }
        }

        // ------ Global Layer ------
        const layerGlobal = model?.layers?.find(x => x.id === model?.selectedLayer.layerId);
        if(layerGlobal){
            const M = layerGlobal.matrix ?? matrixDefault();
            const w = layerGlobal.width ?? model?.canvas.width;
            const h = layerGlobal.height ?? model?.canvas.height;

            const pts = [
                matrixApply(M,{x:0,y:0}),
                matrixApply(M,{x:w,y:0}),
                matrixApply(M,{x:w,y:h}),
                matrixApply(M,{x:0,y:h})
            ];

            renderSelectionBox(ctx, pts);
            drawCornerHandles(ctx, pts, 10);
        }

        // ------ Base Layer ------
        const layerBase = model?.base?.find(x => x.id === model?.selectedLayer.layerId);
        if(layerBase){
            const M = layerBase.matrix ?? matrixDefault();
            const w = layerBase.width ?? model?.canvas.width;
            const h = layerBase.height ?? model?.canvas.height;

            const pts = [
                matrixApply(M,{x:0,y:0}),
                matrixApply(M,{x:w,y:0}),
                matrixApply(M,{x:w,y:h}),
                matrixApply(M,{x:0,y:h})
            ];

            renderSelectionBox(ctx, pts);
            drawCornerHandles(ctx, pts, 10);

            console.log('selection-layer(base)');
            return true;
        }
    }

    return false;
}


function renderSelectionBox(ctx, pts) {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(30,144,255,0.95)';
    ctx.setLineDash([6,3]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
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