import {
    matrixDefault,
} from "@/utils/matrix";
import {canvasEnvironment} from "@/models/canvas/config/model";
import {exportAllSegmentsToBase64} from "@/models/canvas/core/export/model";
import {selectEntity} from "@/models/canvas/core/event/model";
import {render} from "@/models/canvas/core/render/model";
import {
    destroyCanvas,
    ensureCanvasModel,
    ensureModel,
    ensureWebGLModel,
    wipeCanvas
} from "@/models/canvas/core/utils/model";
import {computeLayout, ensure_segments} from "@/models/canvas/core/layout/model";

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
    const register = (id, config) => {
        try {
            if (!ensureModel(id, canvasEnvironment.models)) {
                canvasEnvironment.models.set(id, config);
                const m = ensureModel(id, canvasEnvironment.models);
                if (!m) return console.warn('Model nicht registriert!');
                ensureCanvasModel(m);
                if (m.webgl) {
                    ensureWebGLModel(m);
                }
                if (m.viewport) {
                    if (!m.layout)  m.layout = computeLayout({canvas: m.canvas, viewport: m.viewport})
                    ensure_segments({webgl: m.webgl, segments: m.segments, ctx: m.ctx, viewport: m.viewport, layout: m.layout});
                }
                if (typeof m?.hook?.register === 'function') {
                    try {
                        m.hook?.register(m);
                    } catch (e) {
                        console.warn('Indieviduelle Canvas registrierung fehlgeschlagen', e);
                    }
                }
                if (!m.register) m.register = true;
                update(id, m, false);
            }
        } catch (e) {
            console.error('Fehler beim registrieren des Canvas: ', id, e)
        }
    };

    /**
     * | API | Instanz-Updaten
     *  -> Erfordert die Canvas-Register-ID.
     *  -> Erfordert eine Update-Konfiguration.
     * @param {string} [id=null]
     * @param {object} [config=null]
     * @param {boolean} [loop=false]
     */
    const update = (id, config, loop = false) => {
        try {
            const m = ensureModel(id, canvasEnvironment.models);
            if (!m) return;

            // Konfiguration anwenden
            for (const key in config) {
                const back = m[key];
                try { if (config[key] !== undefined) m[key] = config[key]; }
                catch { m[key] = back; }
            }

            if (!m.active || !m.register) return;

            const step = ()  => {
                const now = performance.now();
                m._lastRAFTime = now;

                const frameInterval = 1000 / m.fps.limit;
                const maxDeltaClamp = (1000 / m.fps.min) * 4;
                let rawDelta = now - m._lastRAFTime;
                let delta = Math.max(0, Math.min(rawDelta, maxDeltaClamp));

                const deltaAlpha = 0.25;
                if (!m._avgDelta) m._avgDelta = delta;
                m._avgDelta = m._avgDelta * (1 - deltaAlpha) + delta * deltaAlpha;
                const avgDelta = m._avgDelta;

                // FramesToProcess berechnen
                let framesToProcess = Math.max(1, Math.floor(avgDelta / frameInterval));
                framesToProcess = Math.min(framesToProcess, m.fps.buffer);
                m.fps.stack = framesToProcess;

                const renderStart = performance.now();

                // Nur begrenzt Frames pro RAF nachholen
                const processFrames = Math.min(framesToProcess, 2);
                for (let i = 0; i < processFrames; i++) {
                    render(m);
                    m._lastRAFTime += frameInterval;
                }

                if (m.fps.dynamic) {
                    const renderTime = performance.now() - renderStart;
                    const loadFactor = (delta + renderTime) / frameInterval;

                    const loadAlpha = 0.2;
                    if (m._avgLoad == null) m._avgLoad = loadFactor;
                    m._avgLoad = m._avgLoad * (1 - loadAlpha) + loadFactor * loadAlpha;

                    if (m._avgLoad > 1.1) {
                        m.fps.limit = Math.max(m.fps.min, m.fps.limit - 5);
                    } else if (m._avgLoad < 0.9) {
                        m.fps.limit = Math.min(m.fps.max, m.fps.limit + 1);
                    }

                    console.log(
                        `FPS limit: ${m.fps.limit}, ` +
                        `Stack: ${m.fps.stack}, ` +
                        `LoadEWMA: ${m._avgLoad.toFixed(2)}`
                    );
                }

                if (loop) {
                    const ref = requestAnimationFrame(step);
                    canvasEnvironment.rafIds.set(id, ref);
                }
            };

            step();

        } catch (e) {
            console.error('Fehler beim updaten der Canvas-Instanz!', e);
        }
    };


    /**
     * | API | Instanz-Löschen
     *  -> Erfordert die Canvas-Register-ID.
     * @param {string} [id=null]
     */
    const remove = async (id) => {
        try {
            const rafId = canvasEnvironment.rafIds.get(id)
            if (typeof rafId === "number") {
                cancelAnimationFrame(rafId);
                canvasEnvironment.rafIds.delete(id);
            }

            const m = ensureModel(id, canvasEnvironment.models);
            if (!m) return;

            m.register = false;
            m.active = false;
            destroyCanvas(m);
            wipeCanvas(m);

            canvasEnvironment.models.delete(id);

            console.log(`Canvas ${id} erfolgreich entfernt.`);
        }
        catch (e) {
            console.error("remove(): Fehler", e);
        }
    };


    /**
     * | API | Environment-Instanz-Löschen
     * @returns Boolean
     */
    const destroy = () => {
        try {
            canvasEnvironment.rafIds.forEach(id => {
                const rafId = canvasEnvironment.rafIds.get(id)
                if (typeof rafId === "number") {
                    cancelAnimationFrame(rafId);
                    canvasEnvironment.rafIds.delete(id);
                }
            });
            canvasEnvironment.rafIds.clear();

            canvasEnvironment.models.forEach((m) => {
                m.register = false;
                m.active = false;
                destroyCanvas(m);
                wipeCanvas(m);
            });

            canvasEnvironment.models.clear();
            canvasEnvironment.cache.clear();
            canvasEnvironment.layout.clear();

            console.log("Canvas-Environment vollständig bereinigt!");
        }
        catch (e) {
            console.error("destroy(): Fehler", e);
        }
    };


    // -----------------------------------------------------------
    // HIT SEGMENT TEST
    // -----------------------------------------------------------
    const select = async (id, x = null, y = null) => {
        const m = ensureModel(id, canvasEnvironment.models);
        if (!m) return;
        await selectEntity(m, x, y);
        await update(id, m, false);
    };


    // -----------------------------------------------------------
    // SEGMENTS API
    // -----------------------------------------------------------
    const addSegment = async (canvasId, segmentId, data = {}) => {
        const m = ensureModel(canvasId, canvasEnvironment.models);
        if (!m) return;

        m?.segments.set(segmentId, {
            row: data.row,
            col: data.col,
            matrix: data.matrix || matrixDefault(),
            order: data.order ?? 0,
            hidden: data.hidden ?? 0,
            opacity: data.opacity ?? 1,
            blend_mode: data.blend_mode ?? 0,
            width: data.width ?? null,
            height: data.height ?? null,
            base: [],
            layers: [],
            hook: {renderer: data.hook?.renderer ?? null}
        });

        await render(m);
    };

    const updateSegment = async (canvasId, segmentId, data = {}) => {
        const m = ensureModel(canvasId, canvasEnvironment.models);
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
        const m = ensureModel(canvasId, canvasEnvironment.models);
        if (!m) return;
        m?.segments.delete(segmentId);
        await render(m);
    };

    const fullscreenSegment = async (canvasId, segmentId = null) => {
        const m = ensureModel(canvasId, canvasEnvironment.models);
        if (!m) return;
        m._fullscreen = segmentId;
        await render(m);
    };

    // -----------------------------------------------------------
    // LAYER API (Single + Segment)
    // -----------------------------------------------------------
    const addLayer = async (canvasId, layerData) => {
        const m = ensureModel(canvasId, canvasEnvironment.models);
        if (!m) return;
        const layer = {...layerData};
        m?.layers.set(layer.id, layer);
        // if WebGL renderer exists, rasterize and schedule tiles
        if (m.glRenderer) {
            try {
                await m.glRenderer.rasterizeLayerAndSchedule(layer, { id: 'global' , matrix: { x:0, y:0 } }, m);
            } catch (e) { console.warn('rasterize layer failed', e); }
        }
        await render(m);
    };
    const updateLayer = async (canvasId, layerId, data) => {
        const m = ensureModel(canvasId, canvasEnvironment.models);
        if (!m || !m?.layers?.has(layerId)) return;
        Object.assign(m?.layers.get(layerId), data);
        await render(m);
    };
    const removeLayer = async (canvasId, layerId) => {
        const m = ensureModel(canvasId, canvasEnvironment.models);
        if (!m || !m?.layers) return;
        m?.layers.delete(layerId);
        await render(m);
    };
    const addLayerToSegment = async (canvasId, segmentId, layerData) => {
        const m = ensureModel(canvasId, canvasEnvironment.models);
        const seg = m?.segments.get(segmentId);
        if (!seg) return;
        const layer = {...layerData};
        seg?.layers.set(layer.id, layer);
        if (m.glRenderer) {
            try { await m.glRenderer.rasterizeLayerAndSchedule(layer, seg, m); } catch(e) { console.warn(e); }
        }
        await render(m);
    };
    const updateLayerInSegment = async (canvasId, segmentId, layerId, data) => {
        const m = ensureModel(canvasId, canvasEnvironment.models);
        const seg = m?.segments.get(segmentId);
        if (!seg || !seg.layers?.has(layerId)) return;
        Object.assign(seg?.layers.get(layerId), data);
        await render(m);
    };
    const removeLayerFromSegment = async (canvasId, segmentId, layerId) => {
        const m = ensureModel(canvasId, canvasEnvironment.models);
        const seg = m?.segments.get(segmentId);
        if (!seg || !seg?.layers) return;
        seg?.layers.delete(layerId);
        await render(m);
    };

    // -----------------------------------------------------------
    // CONTROL
    // -----------------------------------------------------------
    const pause = async (canvasId) => {
        const m = ensureModel(canvasId, canvasEnvironment.models);
        if (m) m._paused = true;
    };
    const resume = async (canvasId) => {
        const m = ensureModel(canvasId, canvasEnvironment.models);
        if (m) m._paused = false;
    };
    const pauseAll = async () => {
        canvasEnvironment.models.forEach(m => async () => {
            m._paused = true
        });
        canvasEnvironment.rafIds.forEach(id => cancelAnimationFrame(id));
    };
    const resumeAll = () => {
        canvasEnvironment.models.forEach(m => async () => {
            m._paused = false
        });
    };

    // -----------------------------------------------------------
    // UTIL
    // -----------------------------------------------------------
    const count = () => canvasEnvironment.models.size;
    const isActive = (canvasId) => { const m = ensureModel(canvasId, canvasEnvironment.models); return m ? !m?._paused : false; };
    
    /**
     * Exportiert alle Segmente als Base64.
     */
    const exportBase64 = async (canvasId) => {
        const m = ensureModel(canvasId, canvasEnvironment.models);
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

        get models() { return canvasEnvironment.models; }
    };
};