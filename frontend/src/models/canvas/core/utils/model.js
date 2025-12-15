// ==========================================================
// General utilities shared across canvas modules
// ==========================================================

// -----------------------------------------------------------
// safeCall(fn)
// Wraps optional hook calls to avoid breaking the renderer
// -----------------------------------------------------------
import {deg2rad, matrix2dAffineTo4x4, matrixDefault, matrixMultiply} from "@/utils/matrix";
import {drawBackground} from "@/models/canvas/background/model";

export const ensureModel = (id, ref) => ref.get(id);

export const ensureCanvasModel = (m) => {
    if (!m) return;

    if (!m.register) m.register = false;
    if (!m.active) m.active = false;
    if (m?.fps) {
        if(!m.fps.dynamic) m.fps.dynamic = false;
        if(!m.fps.min) m.fps.min = 30;
        if(!m.fps.max) m.fps.max = 60;
        if(!m.fps.buffer) m.fps.buffer = 10;
    } else {
        m.fps = {
            dynamic: false,
            min: 30,
            max: 60,
            buffer: 10
        }
    }

    m.fps.limit = m.fps.max / 2;

    // ensure canvas + ctx
    if (!(m.canvas instanceof HTMLCanvasElement)) return;
    if (!m.ctx && !m?.webgl) m.ctx = m.canvas.getContext("2d");
    if (!m.webgl) m.webgl = false;
    if (!m.glMode) m.glMode = 'webgl2';
    if (!m.glOpt) m.glOpt = {
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: false,
        desynchronized: true
    };
    if (m?.webgl) {
        const modes = {
            webgl2: m.canvas.getContext('webgl2', m.glOpt),
            webgl: m.canvas.getContext('webgl', m.glOpt),
            experimental: m.canvas.getContext('experimental-webgl', m.glOpt),
        }
        if (!m.ctx && m?.webgl) m.ctx = modes[m.glMode];
    }

    if (!m.background) m.background = "checker";

    if (!m.viewport) {
        m.viewport = {width: 256, height: 256, rows: 1, columns: 1};
    }

    if (!m.matrix) m.matrix = matrixDefault();

    if (!Array.isArray(m.base)) m.base = [];
    if (!Array.isArray(m.layers)) m.layers = [];
    if (!Array.isArray(m.segments)) m.segments = [];

    // ensure each base has matrix
    for (const b of m.base) {
        if (!b.matrix) b.matrix = matrixDefault();
    }

    // ensure each layer has matrix
    for (const l of m.layers) {
        if (!l.matrix) l.matrix = matrixDefault();
    }

    // ensure segments
    for (const seg of m.segments) {
        if (!seg.matrix) seg.matrix = matrixDefault();

        if (!Array.isArray(seg.layers)) seg.layers = [];
        if (!Array.isArray(seg.base)) seg.base = [];

        // ensure sub layers have matrix
        for (const l of seg.layers) {
            if (!l.matrix) l.matrix = matrixDefault();
        }
    }

    // selection guard
    if (!m.selectedLayer) {
        m.selectedLayer = {segId: null, layerId: null};
    }
    if (!m.selectedSegmentId) m.selectedSegmentId = null;
    if (!m._fullscreen) m._fullscreen = null;

    if (!m.hook) m.hook = {};
    return m;
};

// --- Matrix Konvertierung -----------------------
export const convertMatrix = (item) => {
    if (item?.matrix) item.matrix = matrix2dAffineTo4x4({ ...item.matrix });
};

export const ensureWebGLModel = (m) => {
    if (!m || !m.webgl) return m;
    if (!(m.canvas instanceof HTMLCanvasElement)) return m;

    if (!m.ctx) {
        console.warn("WebGL Kontext konnte nicht initialisiert werden");
        return m;
    }

    if (m.glOpt.alpha) {
        m.ctx.enable(m.ctx.BLEND);
        m.ctx.blendFunc(m.ctx.SRC_ALPHA, m.ctx.ONE_MINUS_SRC_ALPHA);
    }

    // --- Shader Programme ---------------------------
    if (!m.vertexShaderSource) {
        m.vertexShaderSource = `
            attribute vec2 a_pos;
            attribute vec2 a_uv;
            uniform mat4 u_view;
            varying vec2 v_uv;
            void main() {
                vec4 pos = u_view * vec4(a_pos, 0.0, 1.0);
                gl_Position = pos;
                v_uv = a_uv;
            }
        `;
    }

    if (!m.fragmentShaderSource) {
        m.fragmentShaderSource = `
            precision mediump float;
            uniform sampler2D u_tex;
            uniform float u_opacity;
            varying vec2 v_uv;
            void main() {
                vec4 color = texture2D(u_tex, v_uv);
                gl_FragColor = vec4(color.rgb, color.a * u_opacity);
            }
        `;
    }

    m.ctx.viewport(0, 0, m.canvas.width, m.canvas.height);

    // --- Shader kompilieren -------------------------
    const compile = (type, source) => {
        const s = m.ctx.createShader(type);
        m.ctx.shaderSource(s, source);
        m.ctx.compileShader(s);
        if (!m.ctx.getShaderParameter(s, m.ctx.COMPILE_STATUS)) {
            console.error("Shader compile error: ", m.ctx.getShaderInfoLog(s));
            m.ctx.deleteShader(s);
            return null;
        }
        return s;
    };

    const vs = compile(m.ctx.VERTEX_SHADER, m.vertexShaderSource);
    const fs = compile(m.ctx.FRAGMENT_SHADER, m.fragmentShaderSource);
    if (!vs || !fs) return m;

    // --- Program linken -----------------------------
    const program = m.ctx.createProgram();
    m.ctx.attachShader(program, vs);
    m.ctx.attachShader(program, fs);
    m.ctx.linkProgram(program);

    if (!m.ctx.getProgramParameter(program, m.ctx.LINK_STATUS)) {
        console.error("Program link error: ", m.ctx.getProgramInfoLog(program));
        return m;
    }

    m.program = program;
    m.ctx.useProgram(program);

    // --- Attribute + Uniform Locations --------------
    m.locPos = m.ctx.getAttribLocation(program, "a_pos");
    m.locUV = m.ctx.getAttribLocation(program, "a_uv");
    m.locView = m.ctx.getUniformLocation(program, "u_view"); // mat4
    m.locTex = m.ctx.getUniformLocation(program, "u_tex");
    m.locOpacity = m.ctx.getUniformLocation(program, "u_opacity");

    // --- Standardwerte ------------------------------
    if (!m.glQuadBuffer) {
        const verts = new Float32Array([
            -1,  1, 0, 0,   // oben links
            1,  1, 1, 0,   // oben rechts
            -1, -1, 0, 1,   // unten links
            1,  1, 1, 0,   // oben rechts
            1, -1, 1, 1,   // unten rechts
            -1, -1, 0, 1    // unten links
        ]);

        m.glQuadBuffer = m.ctx.createBuffer();
        m.ctx.bindBuffer(m.ctx.ARRAY_BUFFER, m.glQuadBuffer);
        m.ctx.bufferData(m.ctx.ARRAY_BUFFER, verts, m.ctx.STATIC_DRAW);
    }

    if (!m.opacity) m.opacity = 1;
    if (!m.glVAO) {
        m.glVAO = m.ctx.createVertexArray();
        m.ctx.bindVertexArray(m.glVAO);
        m.ctx.bindBuffer(m.ctx.ARRAY_BUFFER, m.glQuadBuffer);

        // Position
        m.ctx.enableVertexAttribArray(m.locPos);
        m.ctx.vertexAttribPointer(m.locPos, 2, m.ctx.FLOAT, false, 16, 0);

        // UV
        m.ctx.enableVertexAttribArray(m.locUV);
        m.ctx.vertexAttribPointer(m.locUV, 2, m.ctx.FLOAT, false, 16, 8);

        m.ctx.bindVertexArray(null);
    }

    m.ctx.uniform1i(m.locTex, 0);
    m.ctx.bindVertexArray(m.glVAO);

    const processObjects = (items) => {
        if (!items || !items.length) return;
        for (const i of items) {
            convertMatrix(i);
        }
    };

    processObjects(m.base);
    processObjects(m.layers);

    // Segments und deren Sub-Objekte
    if (m.segments.length) {
        for (const seg of m.segments) {
            convertMatrix(seg);
            processObjects(seg.base);
            processObjects(seg.layers);
        }
    }


    return m;
};

export const makeDefaultSegment = (webgl = false) => {
    return {
        id: "",
        row: 0,
        col: 0,
        width: 100,
        height: 100,
        opacity: 1,
        background: null,
        matrix: matrixDefault(webgl),
        base: [],
        layers: []
    };
}


export function safeCall(fn) {
    try {
        return fn();
    } catch (err) {
        console.error('[CanvasEnvironment] Hook error:', err);
    }
}

export function wipeCanvas (m) {
    try {
        for (const key of Object.keys(m)) {
            try { delete m[key]; } catch {
                console.log('Fehler beim zerstören des keys', m[key])}
        }
    } catch (err) {
        console.error('[CanvasEnvironment] wipeCanvas error:', err);
    }
}

export function destroyCanvas(m) {
    if (!m || !m.ctx) return;
    // --------------------------------------------
    // 1. Helper: Textur + Image sauber freigeben
    // --------------------------------------------
    const destroyItem = (item) => {
        if (!item) return;

        // GPU-Textur freigeben
        if (item._tex) {
            try {
                m.ctx.deleteTexture(item._tex);
            } catch {
                console.log('WebGl konnte GL-GPU-Textur nicht freigeben!')
            }
        }

        // JS-Referenzen löschen (EXTREM wichtig)

        if (item.matrix) {
            delete item.matrix;
        }

        if (item._tex) {
            delete item._tex;
            delete item._texture;
        }

        // Image RAM freigeben
        if (item._img) {
            delete item._img;
        }

        // Payload kann riesig sein
        if (item.payload) {
            delete item.payload;
        }
    };

    // --------------------------------------------
    // 2. Alle Model-Items durchgehen
    // --------------------------------------------
    m.base?.forEach(destroyItem);
    m.layers?.forEach(destroyItem);

    if (m.segments) {
        if (m.segments?.length) {
            for (const seg of m.segments) {
                destroyItem(seg);
                seg.base?.forEach(destroyItem);
                seg.layers?.forEach(destroyItem);
            }
        }
        delete m.segments
    }

    if (m.matrix) {
        delete m.matrix;
    }

    if (m.selectedLayer) delete m.selectedLayer;
    if (m.selectedSegmentId) delete m.selectedSegmentId;

    delete m._fullscreen;
    if (m._lastRAFTime) delete m._lastRAFTime;
    if (m._avgDelta) delete m._avgDelta;
    if (m._avgLoad) delete m._avgLoad;

    if (!m.webgl) return;

    // --------------------------------------------
    // 3. Buffers freigeben
    // --------------------------------------------
    if (m.glQuadBuffer) {
        try {
            m.ctx.deleteBuffer(m.glQuadBuffer);
        } catch {
            console.log('WebGl konnte GL-Buffers nicht freigeben!')
        }
        delete m.glQuadBuffer;
    }

    // --------------------------------------------
    // 4. VAO freigeben
    // --------------------------------------------
    if (m.glVAO) {
        try {
            m.ctx.deleteVertexArray(m.glVAO);
        } catch {
            console.log('WebGl konnte GL-VAO nicht freigeben!')
        }
        delete m.glVAO;
    }

    // --------------------------------------------
    // 5. Shader / Program freigeben
    // --------------------------------------------
    if (m.program) {
        try {
            m.ctx.useProgram(null);
        } catch {
            console.log('WebGl konnte GL-Program nicht zurücksetzen!')
        }
        try {
            m.ctx.deleteProgram(m.program);
        } catch {
            console.log('WebGl konnte GL-Program nicht freigeben!')
        }
        delete m.program;
    }

    // --------------------------------------------
    // 6. Shader Source Strings freigeben (RAM!)
    // --------------------------------------------
    delete m.vertexShaderSource;
    delete m.fragmentShaderSource;

    // --------------------------------------------
    // 7. WebGL Handles zurücksetzen
    // --------------------------------------------
    delete m.locPos;
    delete m.locUV;
    delete m.locView;
    delete m.locTex;
    delete m.locOpacity;
    // --------------------------------------------
    // 8. GL-Bindings lösen (Sicherheit)
    // --------------------------------------------
    try {
        m.ctx.bindTexture(m.ctx.TEXTURE_2D, null);
        m.ctx.bindBuffer(m.ctx.ARRAY_BUFFER, null);
        m.ctx.bindVertexArray(null);
    } catch {
        console.log('WebGl konnte GL-Bindings nicht freigeben!')
    }
}

export function isGLContext(ctx) {
    return (
        ctx instanceof WebGLRenderingContext ||
        ctx instanceof WebGL2RenderingContext
    );
}

// -----------------------------------------------------------
// toNumber(v, def = 0)
// Converts to number safely
// -----------------------------------------------------------
export function toNumber(v, def = 0) {
    const n = Number(v);
    return isFinite(n) ? n : def;
}

// -----------------------------------------------------------
// toNumber(v, def = 0)
// Converts to number safely
// -----------------------------------------------------------
export function sortFilter (v) {
    return Array.from(v)
        .filter(x => x.hidden !== 1 && (x.opacity ?? 1) > 0)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// -----------------------------------------------------------
// clamp(n, min, max)
// -----------------------------------------------------------
export function clamp(n, min, max) {
    return Math.max(min, Math.min(n, max));
}

// -----------------------------------------------------------
// applyViewTransform(ctx, canvas, transform)
// Generic transform before rendering, used by renderer & export
// transform = { mode: 'none'|'panzoom', x, y, scaleX, scaleY }
// -----------------------------------------------------------
export function applyViewTransform (model) {
    try {
        if (!model?.ctx) return;
        if (model?.matrix) {
            const dpr = getDpr();
            model.canvas.width = Math.round(model.viewport.width * dpr);
            model.canvas.height = Math.round(model.viewport.height * dpr);

            if (model.wrapper) {
                const zoom = model.matrix.a || 1;
                model.wrapper = model.canvas.parentElement;

                const scale = zoom * Math.min(
                    model.wrapper.clientWidth / model.viewport.width || dpr,
                    model.wrapper.clientHeight / model.viewport.height || dpr
                );

                const newWidth = model.viewport.width * scale;
                const newHeight = model.viewport.height * scale;
                const baseCenterX = (model.wrapper.clientWidth - newWidth) / 2;
                const baseCenterY = (model.wrapper.clientHeight - newHeight) / 2;
                const finalX = baseCenterX + model.matrix.x;
                const finalY = baseCenterY + model.matrix.y;

                model.canvas.style.position = "absolute";
                model.canvas.style.left = `${finalX}px`;
                model.canvas.style.top = `${finalY}px`;
                model.canvas.style.width = Math.round(newWidth) + "px";
                model.canvas.style.height = Math.round(newHeight) + "px";

                model.matrix.d = zoom;
            }

            resetViewportTransform(model);
            drawBackground(model);

            if (!model.wrapper) {
                applyTransformMatrix({...model, el: model.canvas});
            }
        }
    } catch (e) {
        console.warn('Fehler beim vorbereiten der viewport transformation;', e);
    }
}

// -----------------------------------------------------------
// applyTransformMatrix(model)
// -----------------------------------------------------------
export function applyTransformMatrix(model) {
    try {
        if (!model?.ctx) return;
        if (model.webgl) {
            const u_view =  model.ctx.getUniformLocation(model.program, 'u_view');
            if (!u_view) return;

            const w = Math.max(1, model.el?.width || 1);
            const h = Math.max(1, model.el?.height || 1);
            const rotate = model.matrix?.rotate || 0;

            // -------------------------------------------------------
            // 1) Basis-Matrix
            // -------------------------------------------------------
            let mat = (model.matrix instanceof Float32Array && model.matrix.length === 16)
                ? model.matrix
                : matrix2dAffineTo4x4(model.matrix);

            // -------------------------------------------------------
            // 2) ROTATION UM CENTER (wie Canvas)
            // -------------------------------------------------------
            if (rotate) {
                const cx = w / 2;
                const cy = h / 2;
                const r = deg2rad(model.matrix.rotate);
                const c = Math.cos(r);
                const s = Math.sin(r);

                const T1 = new Float32Array([
                    1,0,0,0,
                    0,1,0,0,
                    0,0,1,0,
                    cx,cy,0,1
                ]);

                const R = new Float32Array([
                    c, s,0,0,
                    -s, c,0,0,
                    0, 0,1,0,
                    0, 0,0,1
                ]);

                const T2 = new Float32Array([
                    1,0,0,0,
                    0,1,0,0,
                    0,0,1,0,
                    -cx,-cy,0,1
                ]);

                mat = matrixMultiply(T1, mat, true);
                mat = matrixMultiply(R,  mat, true);
                mat = matrixMultiply(T2, mat, true);
            }

            // -------------------------------------------------------
            // 3) CLIPSPACE-PROJEKTION (EINMAL!)
            // Canvas (0..w,0..h) → WebGL (-1..1)
            // -------------------------------------------------------
            const proj = new Float32Array([
                2 / w, 0,       0, 0,
                0,    -2 / h,   0, 0,
                0,     0,       1, 0,
                -1,     1,       0, 1
            ]);

            mat = matrixMultiply(proj, mat, true);

            // -------------------------------------------------------
            // 4) Upload
            // -------------------------------------------------------
            model.ctx.uniformMatrix4fv(u_view, false, mat);
            return;
        }

        // =========================
        // CANVAS (Referenz – unverändert)
        // =========================
        if (!isGLContext(model.ctx)) {
            const dpr = getDpr();
            const cx = (model?.el?.width  / dpr) / 2;
            const cy = (model?.el?.height / dpr) / 2;

            model.ctx.translate(model.matrix.x, model.matrix.y);

            if (model.matrix.rotate) {
                model.ctx.translate(cx, cy);
                model.ctx.rotate(deg2rad(model.matrix.rotate));
                model.ctx.translate(-cx, -cy);
            }

            model.ctx.transform(
                model.matrix.a,
                model.matrix.b,
                model.matrix.c,
                model.matrix.d,
                0, 0
            );
        }

    } catch (e) {
        console.warn('Fehler beim Anwenden der viewport transformation;', e);
    }
}

// -----------------------------------------------------------
// clearCanvas(ctx, canvas)
// -----------------------------------------------------------
export function clearCanvas(model) {
    try {
        if (!model?.ctx || !model?.canvas) return;
        if (model?.webgl) {
            model.ctx.viewport(0, 0, model.canvas.width, model.canvas.height);
            model.ctx.clearColor(0, 0, 0, 0);
            model.ctx.clear(model.ctx.COLOR_BUFFER_BIT | model.ctx.DEPTH_BUFFER_BIT | model.ctx.STENCIL_BUFFER_BIT);
        } else if (!isGLContext(model.ctx)) {
            model.ctx.clearRect(0, 0, model.canvas.width, model.canvas.height);
        }
    } catch (e) {
        console.warn('Fehler beim Bereinigen des Viewports;', e);
    }
}

export function getDpr() {
    try {
        return window.devicePixelRatio || 1;
    } catch (e) {
        return console.warn('Fehler beim ermitteln der Geräte-Pixel-Dimension', e);
    }
}

export function resetViewportTransform(model) {
    try {
        if (!model?.ctx) return;
        const dpr = getDpr();
        if (model?.webgl) {
            model.ctx.viewport(0, 0, model.ctx.drawingBufferWidth, model.ctx.drawingBufferHeight);

            if (model?.program && model.locView) {
                model.ctx.uniformMatrix4fv(model.locView, false, matrixDefault(true));
            }
        } else if (!isGLContext(model.ctx)) {
            const { a, b, c, d, x, y, rotate } = matrixDefault();
            model.ctx.setTransform(a, b, c, d, x, y);
            model.ctx.rotate(deg2rad(rotate));
            model.ctx.scale(dpr, dpr);
        }
    } catch (e) {
        console.warn('Fehler beim Zurücksetzen des Viewports;', e);
    }
}

// -----------------------------------------------------------
// rectCorners(x, y, w, h)
// quickly returns the 4 corners (not transformed)
// -----------------------------------------------------------
export function rectCorners(x, y, w, h) {
    return [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h }
    ];
}

// -----------------------------------------------------------
// getCanvasCoords(canvas, clientX, clientY)
// maps mouse to canvas space
// -----------------------------------------------------------
export function getCanvasCoords(model, clientX, clientY) {
    const canvas = model.canvas;
    const dpr = getDpr();

    if (model.wrapper) {
        const wrapper = canvas.parentElement;
        const rect = wrapper.getBoundingClientRect();

        // client -> wrapper space
        const rx = clientX - rect.left;
        const ry = clientY - rect.top;

        // zoom (aus matrix) und scale (wie in applyViewTransform)
        const zoom = model.matrix?.a ?? 1;
        const scale = Math.min(
            wrapper.clientWidth / model.viewport.width,
            wrapper.clientHeight / model.viewport.height
        ) * zoom;

        const newWidth = model.viewport.width * scale;
        const newHeight = model.viewport.height * scale;

        const baseCenterX = (wrapper.clientWidth - newWidth) / 2;
        const baseCenterY = (wrapper.clientHeight - newHeight) / 2;

        const finalX = baseCenterX + (model.matrix?.x || 0);
        const finalY = baseCenterY + (model.matrix?.y || 0);

        return {
            x: ((rx - finalX) / scale) * dpr,
            y: ((ry - finalY) / scale) * dpr
        };
    }

    // CASE 2 — Canvas ohne Wrapper
    const rect = canvas.getBoundingClientRect();
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

