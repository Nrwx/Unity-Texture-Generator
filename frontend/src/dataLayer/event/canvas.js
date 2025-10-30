/**
 * Canvas Event Handler
 * @param {Object} route - z.B. { canvas: createCanvasEnvironment() }
 */
export const canvasEvent = (route) => ({

    // REGISTER benötigt (canvasId, config!)
    "canvas:register": ({ id, config }) => {
        route.canvas.register(id, config);
        console.log("REGISTER EVENT:", id, config);
    },

    // UPDATE — Signatur: update(canvasId, payload, loop)
    "canvas:update": (data) =>
        route.canvas.update(data?.id, data?.payload, data?.loop),

    "canvas:pause": ({ id }) =>
        route.canvas.pause(id),

    "canvas:resume": ({ id }) =>
        route.canvas.resume(id),

    "canvas:remove": (id) =>
        route.canvas.remove(id),

    "canvas:remove-all": () =>
        route.canvas.destroy(),


    "canvas:pause-all": () =>
        route.canvas.pauseAll(),

    "canvas:resume-all": () =>
        route.canvas.resumeAll(),

    "canvas:select": (payload) =>
        route.canvas.select(payload?.id, payload?.x, payload?.y),

    // SEGMENT API (Signature beachten)
    "canvas:add-segment": ({ id, segmentId, row, col, data }) =>
        route.canvas.addSegment(id, segmentId, row, col, data),

    "canvas:update-segment": ({ id, segmentId, data }) =>
        route.canvas.updateSegment(id, segmentId, data),

    "canvas:remove-segment": ({ id, segmentId }) =>
        route.canvas.removeSegment(id, segmentId),

    "canvas:fullscreen-segment": ({ id, segmentId }) =>
        route.canvas.fullscreenSegment(id, segmentId),


    // LAYER API
    "canvas:add-layer": ({ id, layerData }) =>
        route.canvas.addLayer(id, layerData),

    "canvas:update-layer": ({ id, layerId, data }) =>
        route.canvas.updateLayer(id, layerId, data),

    "canvas:remove-layer": ({ id, layerId }) =>
        route.canvas.removeLayer(id, layerId),


    // Für Segment-Layer
    "canvas:add-layer-seg": ({ id, segmentId, layerData }) =>
        route.canvas.addLayerToSegment(id, segmentId, layerData),

    "canvas:update-layer-seg": ({ id, segmentId, layerId, data }) =>
        route.canvas.updateLayerInSegment(id, segmentId, layerId, data),

    "canvas:remove-layer-seg": ({ id, segmentId, layerId }) =>
        route.canvas.removeLayerFromSegment(id, segmentId, layerId),


    // EXPORT
    "canvas:export": ({ id }) =>
        route.canvas.exportBase64(id),
});