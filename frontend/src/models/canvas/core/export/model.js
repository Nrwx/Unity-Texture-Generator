import { matrixMultiply } from "@/utils/matrix";
import { transformedCorners } from "@/models/canvas/core/matrix/model";
import { renderToTempCanvas, drawLayer } from "@/models/canvas/core/render/model";
import { sortFilter } from "@/models/canvas/core/utils/model";

/**
 * Rendern von Layer-Gruppen in eine temporäre Canvas mit korrekten Bounding Box
 */
async function renderLayerGroupToCanvas(canvas, layersToRender) {
    if (!layersToRender.length) return null;

    const allCorners = [];
    for (const { layer, matrix } of layersToRender) {
        const w = layer.width ?? canvas.width;
        const h = layer.height ?? canvas.height;
        allCorners.push(...transformedCorners(matrix, 0, 0, w, h));
    }

    const xs = allCorners.map(c => c.x);
    const ys = allCorners.map(c => c.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const w = Math.max(1, Math.ceil(maxX - minX));
    const h = Math.max(1, Math.ceil(maxY - minY));

    const res = renderToTempCanvas(w, h, async (ctx) => {
        ctx.save();
        ctx.translate(-minX, -minY);
        for (const { layer, matrix } of layersToRender) {
            await drawLayer(ctx, { ...layer, matrix });
        }
        ctx.restore();
    });

    return { dataUrl: res.dataUrl, canvas: res.canvas, bounds: { minX, minY, w, h } };
}

/**
 * Exportiert Layer/Segmente/Base/Global zu Base64
 * Berücksichtigt seg.matrix für absolute Position
 * und seg.base + seg.layers innerhalb von Segmenten
 */
export async function toBase64Export(model, { segId = null, layerId = null, _fullscreen = false } = {}) {
    if (!model?.canvas) return {};
    const canvas = model.canvas;
    const out = {};

    const buildLayersToRender = async (seg) => {
        const layers = [];

        // Base-Layer (global)
        if (!layerId && model.base?.length) {
            const baseLayers = await sortFilter(model.base);
            baseLayers.forEach(b => layers.push({ layer: b, matrix: b.matrix}));
        }

        // Global-Layer (nicht segmentbezogen)
        if (!layerId && model.layers?.length) {
            const globalLayers = await sortFilter(model.layers);
            globalLayers.forEach(l => layers.push({ layer: l, matrix: l.matrix}));
        }

        // Segment-Layer: seg.base + seg.layers
        if (seg) {
            // 1️⃣ Segment Base-Layer
            if (seg.base?.length) {
                for (const b of seg.base) {
                    if (layerId && b.id !== layerId) continue;
                    const Mtotal = matrixMultiply(seg.matrix, b.matrix);
                    layers.push({ layer: b, matrix: Mtotal });
                }
            }

            // 2️⃣ Segment Layers
            if (seg.layers?.length) {
                for (const l of seg.layers) {
                    if ((layerId && l.id !== layerId) || l.hidden || (l.opacity ?? 1) === 0) continue;
                    const Mtotal = matrixMultiply(seg.matrix, l.matrix);
                    layers.push({ layer: l, matrix: Mtotal });
                }
            }
        }

        // Einzel-Layer Export (Base oder Global, wenn layerId angegeben aber kein Segment)
        if (layerId && !seg) {
            const allLayers = [...(model.base ?? []), ...(model.layers ?? [])];
            const l = allLayers.find(l => l.id === layerId);
            if (l) layers.push({ layer: l, matrix: l.matrix});
        }

        return layers;
    };

    // Segment-Auswahl
    const segArray = (() => {
        if (_fullscreen && segId) {
            const s = model.segments?.find(s => s.id === segId);
            return s ? [[segId, s]] : [];
        }
        if (segId) {
            const s = model.segments?.find(s => s.id === segId);
            return s ? [[segId, s]] : [];
        }
        return (model.segments ?? []).sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).map(s => [s.id, s]);
    })();

    // Export-Logik
    if (segArray.length > 0) {
        for (const [id, seg] of segArray) {
            if (!seg || seg.hidden) continue;
            const layersToRender = await buildLayersToRender(seg);
            const res = await renderLayerGroupToCanvas(canvas, layersToRender);
            if (res) out[id] = res;
        }
    } else if (layerId) {
        const layersToRender = await buildLayersToRender(null);
        const res = await renderLayerGroupToCanvas(canvas, layersToRender);
        if (res) out[layerId] = res;
    } else {
        // Komplett Export: Base + Global + alle Segmente
        const layersToRender = await buildLayersToRender(null);
        for (const seg of model.segments ?? []) {
            layersToRender.push(...(await buildLayersToRender(seg)));
        }
        const res = await renderLayerGroupToCanvas(canvas, layersToRender);
        if (res) out["all"] = res;
    }

    return out;
}

export async function exportAllSegmentsToBase64(model) {
    return toBase64Export(model);
}
