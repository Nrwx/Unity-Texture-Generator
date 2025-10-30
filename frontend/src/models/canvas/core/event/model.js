// -----------------------------------------------------------
// MAIN HIT TESTING
// -----------------------------------------------------------
import {getCanvasCoords, sortFilter} from "@/models/canvas/core/utils/model";
import {computeLayout} from "@/models/canvas/core/layout/model";
import {
    matrixAffineCombine,
    matrixCombine,
    matrixDefault,
    matrixMultiply,
    matrixTranslate,
    rayCast
} from "@/utils/matrix";
import {combinedSegmentMatrix, transformedCorners} from "@/models/canvas/core/matrix/model";

export const selectEntity = async (model, x = null, y = null) => {
    const {
        canvas,
        segments,
        layers,
        rows,
        columns,
        viewport,
        hook,
        _fullscreen
    } = model;

    if (!canvas) return;

    const {x: wx, y: wy} = getCanvasCoords(canvas, x, y);

    const layout = computeLayout(canvas, rows, columns, viewport);
    // -------------------------------------------------------
    // 1) global canvas layers (non-segment layers)
    // -------------------------------------------------------
    if (layers.length > 0) {
        for (const layer of await sortFilter(layers)) {
            const lw = layer?.width || canvas?.width;
            const lh = layer?.height || canvas?.height;

            const lcm = matrixCombine(layer.matrix || matrixDefault());
            const Mlayer = matrixAffineCombine(lcm);

            const cx = lw / 2;
            const cy = lh / 2;

            const Tneg = matrixTranslate(-cx, -cy);
            const step1 = matrixMultiply(Mlayer, Tneg);
            const Mfull = matrixMultiply(matrixTranslate(cx, cy), step1);

            const corners = transformedCorners(Mfull, 0, 0, lw, lh);
            if (rayCast(wx, wy, corners)) {
                model.selectedSegmentId = null;
                model.selectedLayer = {segId: null, layerId: layer.id};

                if (typeof hook?.selectLayer === "function") {
                    hook.selectLayer(model, null, {
                        layerId: layer.id,
                        x: wx,
                        y: wy
                    });
                }

                console.log({segId: null, layerId: layer.id}, 'select rycst init pss')
                return;
            }
        }
    }

    // -------------------------------------------------------
    // 2) segments (fullscreen or normal list)
    // -------------------------------------------------------
    const segArray = _fullscreen && segments.has(_fullscreen) ? [[_fullscreen, segments.get(_fullscreen)]] : await sortFilter(segments.entries())

    for (const [segId, seg] of segArray) {
        const sx = layout?.colOffset[seg.col] ?? 0;
        const sy = layout?.rowOffset[seg.row] ?? 0;
        const sw = layout.colWidths[seg.col] ?? canvas.width;
        const sh = layout.rowHeights[seg.row] ?? canvas.height;

        const MsegFull = combinedSegmentMatrix(sx, sy, sw, sh, seg.matrix);

        // ---------------------------------------------------
        // segment layers
        // ---------------------------------------------------
        const segLayers = seg.layers ? await sortFilter(seg.layers) : [];

        for (const layer of segLayers) {
            const lw = layer.width || sw;
            const lh = layer.height || sh;

            const lcm = matrixCombine(layer.matrix || matrixDefault());
            const Mlayer = matrixAffineCombine(lcm);

            const cxL = sx + lw / 2;
            const cyL = sy + lh / 2;

            const TnegL = matrixTranslate(-cxL, -cyL);
            const MlayerFull = matrixMultiply(
                matrixTranslate(cxL, cyL),
                matrixMultiply(Mlayer, TnegL)
            );

            const Mtotal = matrixMultiply(MsegFull, MlayerFull);

            const corners = transformedCorners(Mtotal, sx, sy, lw, lh);

            if (rayCast(wx, wy, corners)) {
                model.selectedSegmentId = segId;
                model.selectedLayer = {segId, layerId: layer.id};

                if (typeof hook?.select === "function") {
                    hook.select(model, segId, {
                        layerId: layer.id,
                        x: wx,
                        y: wy
                    });
                }

                console.log({segId, layerId: layer.id})
                return
            }
        }

        // ---------------------------------------------------
        // segment bounding box (fallback)
        // ---------------------------------------------------
        const segCorners = transformedCorners(MsegFull, sx, sy, sw, sh);
        if (rayCast(wx, wy, segCorners)) {
            model.selectedSegmentId = segId;
            model.selectedLayer = {segId, layerId: null};

            if (typeof hook?.select === "function") {
                hook.select(model, segId);
            }
            console.log('select fllbck init pss')
            return;
        }
    }

    // nothing hit
    model.selectedSegmentId = null;
    model.selectedLayer = {segId: null, layerId: null};
    return null;
}