import {getCanvasCoords, sortFilter} from "@/models/canvas/core/utils/model";
import {
    matrixMultiply,
    rayCast
} from "@/utils/matrix";
import {transformedCorners} from "@/models/canvas/core/matrix/model";

export const selectEntity = async (model, x = null, y = null) => {
    if (!model?.canvas) return;

    const { x: wx, y: wy } = getCanvasCoords(model, x, y);

    // -------------------
    // Global Layers
    // -------------------
    if (model.layers?.length) {
        for (const layer of await sortFilter(model.layers)) {
            const corners = transformedCorners(layer.matrix, 0, 0, layer.width, layer.height);

            if (rayCast(wx, wy, corners)) {
                model.selectedSegmentId = null;
                model.selectedLayer = { segId: null, layerId: layer.id };
                return;
            }
        }
    }

    // -------------------
    // Base Layers
    // -------------------
    if (model.base?.length) {
        for (const base of await sortFilter(model.base)) {
            const corners = transformedCorners(base?.matrix, 0, 0, base.width, base.height);

            if (rayCast(wx, wy, corners)) {
                model.selectedSegmentId = null;
                model.selectedLayer = { segId: null, layerId: base.id };
                return;
            }
        }
    }

    // -------------------
    // Segments
    // -------------------
    if (model.segments?.length) {
        const segArray = model._fullscreen
            ? model.segments.filter(s => s.id === model._fullscreen)
            : await sortFilter(model.segments);

        for (const seg of segArray) {
            const sw = seg.width;
            const sh = seg.height;

            const segLayers = seg.layers ? await sortFilter(seg.layers) : [];
            for (const layer of segLayers) {
                const Mtotal = matrixMultiply(seg.matrix, layer.matrix);
                const corners = transformedCorners(Mtotal, 0, 0, layer.width, layer.height);

                if (rayCast(wx, wy, corners)) {
                    model.selectedSegmentId = seg.id;
                    model.selectedLayer = { segId: seg.id, layerId: layer.id };
                    return;
                }
            }

            const segCorners = transformedCorners(seg.matrix, 0, 0, sw, sh);
            if (rayCast(wx, wy, segCorners)) {
                model.selectedSegmentId = seg.id;
                model.selectedLayer = { segId: seg.id, layerId: null };
                return;
            }
        }
    }

    // Nothing selected
    model.selectedSegmentId = null;
    model.selectedLayer = { segId: null, layerId: null };
}