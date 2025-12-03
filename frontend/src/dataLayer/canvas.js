import {
    matrixDefault,
} from "@/utils/matrix";
import {canvasEnvironment} from "@/models/canvas/config/model";
import {exportAllSegmentsToBase64} from "@/models/canvas/core/export/model";
import {selectEntity} from "@/models/canvas/core/event/model";
import {render} from "@/models/canvas/core/render/model";
import {nextTick} from "vue";
import {ensureModel} from "@/models/canvas/core/utils/model";

/**
 * createCanvasEnvironment - Canvas manager
 * - Multi Canvas
 * - Multi Segment
 * - Grid System
 * - Background
 * - Fullscreen Mode
 * - Per Canvas RAF
 * - Hook
 * - Segment-Selection + Border
 *
 * Behavior:
 *  - Canvas/View transform (dpr/zoom/matrix/rotate) applies ONLY to view: background, grid, global hooks.
 *  - Segments are rendered in layout space and have their own segment.matrix (scale/rotate/translate).
 *  - Hit testing considers combined transforms of segment (no global view transform).
 */

export const createCanvasEnvironment = () => {

    /**
     * | API | Instanz-Registrieren
     *  -> Erfordert eine Canvas-Register-ID.
     *  -> Erfordert ein Canvas-Config-Objekt.
     *
     * @param {string} [id=null]
     * @param config
     */
    const register = async (id, config) => {
        try {
            if (!ensureModel(id, canvasEnvironment.value.models)) {
                canvasEnvironment.value.models.set(id, {
                    ...config,
                    background: config?.background || 'checker',
                    viewport: config?.viewport || {
                        width: 256,
                        height: 256,
                        rows: 1,
                        columns: 1
                    },
                    ctx: config.canvas.getContext("2d"),
                    base: config?.base?.length || [],
                    layers: config?.layers?.length || [],
                    segments: new Map(),
                    selectedSegmentId: null,
                    selectedLayer: {segId: null, layerId: null},
                    transform: config?.transform || {matrix: matrixDefault()},
                    hook: config?.hook || {},
                    _paused: false,
                    _fullscreen: null
                });
                await nextTick();
                const m = ensureModel(id, canvasEnvironment.value.models);
                if (!m) return;
                if (typeof config?.hook?.register === 'function') {
                    try {
                        await nextTick();
                        await config.hook?.register(m);
                    } catch (e) {
                        console.warn('Indieviduelle Canvas registrierung fehlgeschlagen', e);
                    }
                }
                await render(m);
            }
        } catch (e) {
            console.error('Fehler beim registrieren des Canvas: ', id)
        }
    };

    /**
     * | API | Instanz-Löschen
     *  -> Erfordert die Canvas-Register-ID.
     * @param {string} [id=null]
     */
    const remove = async (id) => {
        try {
            const loop = canvasEnvironment.value.rafIds.has(id);
            if (loop) {
                await cancelAnimationFrame(canvasEnvironment.value.rafIds.get(id));
                await nextTick();
                canvasEnvironment.value.rafIds.delete(id);
                const item = canvasEnvironment.value.rafIds.get(id);
                if (item) console.warn('Canvas Animation konnte nicht gestoppt werden', id);
                else console.log('Canvas Animation erfolgreich gestoppt!')
            }
            canvasEnvironment.value.models.delete(id);
            await nextTick();
            const item = canvasEnvironment.value.models.get(id);
            if (item) {
                console.warn('Canvas model konnte nicht gelöscht werden', id);
            }
            else {
                console.log('Canvas erfolgreich gelöscht!')
            }
        } catch (e) {
            console.error('Fehler beim löschen des Canvas!', e)
        }
    };

    /**
     * | API | Environment-Instanz-Löschen
     * @returns Boolean
     */
    const destroy = async () => {
        try {
            canvasEnvironment.value.rafIds.forEach(id => cancelAnimationFrame(id));
            await nextTick();
            canvasEnvironment.value.rafIds.clear();
            canvasEnvironment.value.models.clear();
            canvasEnvironment.value.cache.clear();
            canvasEnvironment.value.layout.clear();
            await nextTick();
            const check = {
                0: canvasEnvironment.value.rafIds.size,
                1: canvasEnvironment.value.models.size,
                2: canvasEnvironment.value.cache.size,
                3: canvasEnvironment.value.layout.size
            }
            let total = 0;
            let processed = 0;
            for (const key in check) {
                const item = check[key];
                if (item) { total += item; processed += 1}
                else processed += 1;
            }
            if (total === 0) {
                console.log(`Canvas-Environment erfolgreich bereinigt! Bereinigt: ${processed} Reste: ${total}`);
            } else {
                console.warn(`Canvas-Environment konnte nicht bereinigt werden! Bereinigt: ${processed} Reste: ${total}`);
            }
        } catch (e) {
            console.error('Fehler beim löschen der Canvas-Environments!', e)
        }
    };

    // -----------------------------------------------------------
    // HIT SEGMENT TEST
    // -----------------------------------------------------------
    const select = async (id, x = null, y = null) => {
        const m = ensureModel(id, canvasEnvironment.value.models);
        if (!m) return;
        await selectEntity(m, x, y);
        await render(m);
    };


    /**
     * | API | Instanz-Updaten
     *  -> Erfordert die Canvas-Register-ID.
     *  -> Erfordert eine Update-Konfiguration.
     * @param {string} [id=null]
     * @param {object} [config=null]
     * @param {boolean} [loop=false]
     */
    const update = async (id, config, loop= false) => {
        try {
            const m = ensureModel(id, canvasEnvironment.value.models);
            if (!m) return;
            for (const key in config) {
                let back = null;
                try {
                    back = m[key];
                    m[key] = config[key];
                } catch (e){
                    m[key] = back;
                    console.log('Canvas springt auf vorherigen wert:', back, e)
                }
            }
            const step = async () => {
                await render(m);
                if(m?.emit && m?.update){
                    await m.emit.handler(m.emit.event, {...m, update: false})
                    console.log('UPDATE M', m.emit.event, m)
                }
                if (loop) {
                    const ref = requestAnimationFrame(step);
                    canvasEnvironment.value.rafIds.set(id, ref);
                }
            };
            await step();
        } catch (e) {
            console.error('Fehler beim updaten der Canvas-Instanz!', e)
        }
    };

    // -----------------------------------------------------------
    // SEGMENTS API
    // -----------------------------------------------------------
    const addSegment = async (canvasId, segmentId, row, col, data = {}) => {
        const m = ensureModel(canvasId, canvasEnvironment.value.models);
        if (!m) return;

        m?.segments.set(segmentId, {
            row, col,
            data: data,
            matrix: data.matrix || matrixDefault(),
            order: data.order ?? 0,
            hidden: data.hidden ?? 0,
            opacity: data.opacity ?? 1,
            blend_mode: data.blend_mode ?? 0,
            url: data.url ?? null,
            width: data.width ?? null,
            height: data.height ?? null,
            layers: new Map(),
            hook: {renderer: data.hook?.renderer ?? null}
        });

        await render(m);
    };

    const updateSegment = async (canvasId, segmentId, data = {}) => {
        const m = ensureModel(canvasId, canvasEnvironment.value.models);
        if (!m) return;
        const seg = m?.segments.get(segmentId);
        if (!seg) return;

        seg.data = {...seg.data, ...data};
        if (data.matrix) seg.matrix = data.matrix;
        if (data.order) seg.order = data.order;
        if (data.hidden) seg.hidden = data.hidden;
        if (data.opacity) seg.opacity = data.opacity;
        if (data.blend_mode) seg.blend_mode = data.blend_mode;
        if (data.hook) seg.hook.renderer = data.hook.renderer;
        if (data.width) seg.width = data.width;
        if (data.height) seg.height = data.height;
        if (data.url) seg.url = data.url;

        await render(m);
    };

    const removeSegment = async (canvasId, segmentId) => {
        const m = ensureModel(canvasId, canvasEnvironment.value.models);
        if (!m) return;
        m?.segments.delete(segmentId);
        await render(m);
    };

    const fullscreenSegment = async (canvasId, segmentId = null) => {
        const m = ensureModel(canvasId, canvasEnvironment.value.models);
        if (!m) return;
        m._fullscreen = segmentId;
        await render(m);
    };

    // -----------------------------------------------------------
    // LAYER API (Single + Segment)
    // -----------------------------------------------------------
    const addLayer = async (canvasId, layerData) => {
        const m = ensureModel(canvasId, canvasEnvironment.value.models);
        if (!m) return;
        const layer = {...layerData};
        m?.layers.set(layer.id, layer);
        await render(m);
    };
    const updateLayer = async (canvasId, layerId, data) => {
        const m = ensureModel(canvasId, canvasEnvironment.value.models);
        if (!m || !m?.layers?.has(layerId)) return;
        Object.assign(m?.layers.get(layerId), data);
        await render(m);
    };
    const removeLayer = async (canvasId, layerId) => {
        const m = ensureModel(canvasId, canvasEnvironment.value.models);
        if (!m || !m?.layers) return;
        m?.layers.delete(layerId);
        await render(m);
    };
    const addLayerToSegment = async (canvasId, segmentId, layerData) => {
        const m = ensureModel(canvasId, canvasEnvironment.value.models);
        const seg = m?.segments.get(segmentId);
        if (!seg) return;
        const layer = {...layerData};
        seg?.layers.set(layer.id, layer);
        await render(m);
    };
    const updateLayerInSegment = async (canvasId, segmentId, layerId, data) => {
        const m = ensureModel(canvasId, canvasEnvironment.value.models);
        const seg = m?.segments.get(segmentId);
        if (!seg || !seg.layers?.has(layerId)) return;
        Object.assign(seg?.layers.get(layerId), data);
        await render(m);
    };
    const removeLayerFromSegment = async (canvasId, segmentId, layerId) => {
        const m = ensureModel(canvasId, canvasEnvironment.value.models);
        const seg = m?.segments.get(segmentId);
        if (!seg || !seg?.layers) return;
        seg?.layers.delete(layerId);
        await render(m);
    };

    // -----------------------------------------------------------
    // CONTROL
    // -----------------------------------------------------------
    const pause = async (canvasId) => {
        const m = ensureModel(canvasId, canvasEnvironment.value.models);
        if (m) m._paused = true;
    };
    const resume = async (canvasId) => {
        const m = ensureModel(canvasId, canvasEnvironment.value.models);
        if (m) m._paused = false;
    };
    const pauseAll = async () => {
        canvasEnvironment.value.models.forEach(m => async () => {
            m._paused = true
        });
        canvasEnvironment.value.rafIds.forEach(id => cancelAnimationFrame(id));
    };
    const resumeAll = () => {
        canvasEnvironment.value.models.forEach(m => async () => {
            m._paused = false
        });
    };

    // -----------------------------------------------------------
    // UTIL
    // -----------------------------------------------------------
    const count = () => canvasEnvironment.value.models.size;
    const isActive = (canvasId) => { const m = ensureModel(canvasId, canvasEnvironment.value.models); return m ? !m?._paused : false; };
    
    /**
     * Exportiert alle Segmente als Base64.
     */
    const exportBase64 = async (canvasId) => {
        const m = ensureModel(canvasId, canvasEnvironment.value.models);
        if (!m) return {};
        return await exportAllSegmentsToBase64(m);
    };
    
    return {
        register,
        remove,
        destroy,

        update,
        pause,
        resume,
        pauseAll,
        resumeAll,

        addSegment,
        updateSegment,
        removeSegment,
        fullscreenSegment,

        addLayer,
        removeLayer,
        updateLayer,

        addLayerToSegment,
        removeLayerFromSegment,
        updateLayerInSegment,

        exportBase64,
        count,
        isActive,

        select,

        get models() { return canvasEnvironment.value.models; }
    };
};