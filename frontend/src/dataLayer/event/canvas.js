/**
 * Canvas Event Handler
 * @param {Object} route - z.B. { canvas: createCanvasEnvironment() }
 */
import {ref} from "vue";

const _prepare = (data) => {
    const update = ref(null);

    update.value = {
        updatedAt: ''
    }

    if (data?.payload) {
        const item = data.payload;

        if (item?.webgl) update.value.webgl = item.webgl;
        if (item?.register) update.value.register = item.register;
        if (item?.fps) update.value.fps = item.fps;
        if (item?.active) update.value.active = item.active;
        if (item?.id) update.value.id = item.id;
        if (item?.viewport) update.value.viewport = item.viewport;
        if (item?.wrapper) update.value.wrapper = item.wrapper;
        if (item?.canvas) update.value.canvas = item.canvas;
        if (item?.ctx) update.value.ctx = item.ctx;
        if (item?.base) update.value.base = item.base;
        if (item?.layers) update.value.layers = item.layers;
        if (item?.segments) update.value.segments = item.segments;
        if (item?.background) update.value.background = item.background;
        if (item?.matrix) update.value.matrix = item.matrix;
        if (item?.opacity) update.value.opacity = item.opacity;
        if (item?.selectedLayer) update.value.selectedLayer = item.selectedLayer;
        if (item?.selectedSegmentId) update.value.selectedSegmentId = item.selectedSegmentId;
        if (item?.hook) update.value.hook = item.hook;
    }

    update.value.updatedAt = new Date().toISOString();
    return update.value
}

export const canvasEvent = (route) => ({
    "canvas:register": ({id, config}) => {
        const update = _prepare({payload: config})
        if (update) {
            console.log("REGISTER EVENT:", id, update);
            route.canvas.register(id, update)
        }
    },

    "canvas:update": (data) => {
        const update = _prepare(data);
        if (update) {
            route.canvas.update(data?.id, update, data?.loop);
        }
    },

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