import {
    matrixApply,
    matrixDefault, matrixMultiply,
} from "@/utils/matrix";
import {applyTransformMatrix} from "@/models/canvas/core/utils/model";

/**
 * Show a grid overlay on the canvas
 * @param {object} model - {webgl, ctx, canvas, matrix, showGrid, layout}
 */
export function showGrid (model) {
    if (!model?.showGrid || !model?.layout || model?.layout.isSingle) return;

    try {
        if (model.webgl && model.program) {
            const u_view = model.ctx.getUniformLocation(model.program, 'u_view');
            if (!u_view) return;

            applyTransformMatrix({
                webgl: model.webgl,
                ctx: model.ctx,
                program: model.program,
                el: model.canvas,
                matrix: model.matrix
            });

            // Linienfarbe: rgba(255,255,255,0.3)
            const color = new Float32Array([1, 1, 1, 0.3]);
            const u_color = model.ctx.getUniformLocation(model.program, 'u_color');
            if (u_color) model.ctx.uniform4fv(u_color, color);

            // einfache 1px Rechtecke für Spalten
            (model.layout.colOffset || []).forEach(x => {
                const lineVerts = new Float32Array([
                    x / model.canvas.width, 0,
                    (x + 1) / model.canvas.width, 0,
                    x / model.canvas.width, 1,
                    (x + 1) / model.canvas.width, 0,
                    (x + 1) / model.canvas.width, 1,
                    x / model.canvas.width, 1
                ]);
                const buf = model.ctx.createBuffer();
                model.ctx.bindBuffer(model.ctx.ARRAY_BUFFER, buf);
                model.ctx.bufferData(model.ctx.ARRAY_BUFFER, lineVerts, model.ctx.STATIC_DRAW);

                const locPos = model.ctx.getAttribLocation(model.program, 'a_pos');
                model.ctx.enableVertexAttribArray(locPos);
                model.ctx.vertexAttribPointer(locPos, 2, model.ctx.FLOAT, false, 0, 0);

                // setze u_opacity uniform falls vorhanden
                const u_opacity = model.ctx.getUniformLocation(model.program, 'u_opacity');
                if(u_opacity) model.ctx.uniform1f(u_opacity, 0.3);

                model.ctx.drawArrays(model.ctx.TRIANGLES, 0, 6);
                model.ctx.deleteBuffer(buf);
            });

            // Zeilenlinien
            (model.layout.rowOffset || []).forEach(y => {
                const lineVerts = new Float32Array([
                    0, y / model.canvas.height,
                    1, y / model.canvas.height,
                    0, (y + 1) / model.canvas.height,
                    1, y / model.canvas.height,
                    1, (y + 1) / model.canvas.height,
                    0, (y + 1) / model.canvas.height
                ]);
                const buf = model.ctx.createBuffer();
                model.ctx.bindBuffer(model.ctx.ARRAY_BUFFER, buf);
                model.ctx.bufferData(model.ctx.ARRAY_BUFFER, lineVerts, model.ctx.STATIC_DRAW);

                const locPos = model.ctx.getAttribLocation(model.program, 'a_pos');
                model.ctx.enableVertexAttribArray(locPos);
                model.ctx.vertexAttribPointer(locPos, 2, model.ctx.FLOAT, false, 0, 0);

                const u_opacity = model.ctx.getUniformLocation(model.program, 'u_opacity');
                if(u_opacity) model.ctx.uniform1f(u_opacity, 0.3);

                model.ctx.drawArrays(model.ctx.TRIANGLES, 0, 6);
                model.ctx.deleteBuffer(buf);
            });

        }
        // --- 2D Canvas ---
        else {
            model.ctx.save();

            applyTransformMatrix({
                webgl: model.webgl,
                ctx: model.ctx,
                el: model.canvas,
                matrix: model.matrix
            });

            model.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            model.ctx.lineWidth = 1;

            (model.layout.colOffset || []).forEach(o => {
                model.ctx.beginPath();
                model.ctx.moveTo(o, 0);
                model.ctx.lineTo(o, model.canvas.height);
                model.ctx.stroke();
            });

            (model.layout.rowOffset || []).forEach(o => {
                model.ctx.beginPath();
                model.ctx.moveTo(0, o);
                model.ctx.lineTo(model.canvas.width, o);
                model.ctx.stroke();
            });

            model.ctx.restore();
        }

        console.log('grid overlay');
    } catch (e) {
        console.error('showGrid error', e);
        try { model?.ctx.restore(); } catch(e) { console.log(e); }
    }
}

/**
 * Zeichnet Auswahl (segment, layer global/segment/base).
 * Gibt true zurück, wenn render() vorher beendet werden soll.
 */
export function renderSelection(model) {
    if (!model.layout) return false;
    if (!model.ctx) return false;

    // ---------------------------
    // SEGMENT SELECTION
    // ---------------------------
    if (model?.selectedSegmentId) {
        const seg = model.segments.find(s => s.id === model.selectedSegmentId);
        if (seg) {
            const M = seg.matrix;
            const w = seg.width;
            const h = seg.height;

            const localCorners = [
                {x: 0, y: 0},
                {x: w, y: 0},
                {x: w, y: h},
                {x: 0, y: h}
            ];
            const corners = localCorners.map(p => matrixApply(M, p));

            if (model.webgl) {
                drawBoxWebGL({
                    webgl: model.webgl,
                    ctx: model.ctx,
                    program: model.program,
                    el: seg,
                    matrix: seg.matrix,
                    points: corners,
                    glVAO: model.glVAO,
                    locPos: model.locPos
                });
                drawHandlesWebGL({
                    webgl: model.webgl,
                    ctx: model.ctx,
                    el: seg,
                    matrix: seg.matrix,
                    program: model.program,
                    points: corners,
                    locPos: model.locPos,
                    glVAO: model.glVAO,
                    size: 10
                });
            } else {
                drawBox2D(model.ctx, corners);
                drawCornerHandles(model.ctx, corners, 10);
            }
        }
    }

    // ---------------------------
    // LAYER SELECTION
    // ---------------------------
    if (model?.selectedLayer?.layerId) {
        const layerModels = [
            // Segment Layer
            ...(model.selectedLayer.segId ? [{
                seg: model.segments.find(s => s.id === model.selectedLayer.segId),
                layer: model.segments.find(s => s.id === model.selectedLayer.segId)?.layers?.find(l => l.id === model.selectedLayer.layerId)
            }] : []),
            // Global Layer
            ...(model.layers?.find(x => x.id === model.selectedLayer.layerId) ? [{
                seg: null,
                layer: model.layers.find(x => x.id === model.selectedLayer.layerId)
            }] : []),
            // Base Layer
            ...(model.base?.find(x => x.id === model.selectedLayer.layerId) ? [{
                seg: null,
                layer: model.base.find(x => x.id === model.selectedLayer.layerId)
            }] : [])
        ];

        for (const {seg, layer} of layerModels) {
            if (!layer) continue;

            const Mseg = seg?.matrix ?? matrixDefault();
            const Mlayer = layer.matrix ?? matrixDefault();
            const Mtotal = seg ? matrixMultiply(Mseg, Mlayer) : Mlayer;

            const w = layer.width ?? (seg?.width ?? model.canvas.width);
            const h = layer.height ?? (seg?.height ?? model.canvas.height);

            const pts = [
                matrixApply(Mtotal, {x: 0, y: 0}),
                matrixApply(Mtotal, {x: w, y: 0}),
                matrixApply(Mtotal, {x: w, y: h}),
                matrixApply(Mtotal, {x: 0, y: h})
            ];

            if (model.webgl) {
                drawBoxWebGL({
                    webgl: model.webgl,
                    ctx: model.ctx,
                    el: layer,
                    matrix: model.matrix,
                    points: pts,
                    glVAO: model.glVAO,
                    locPos: model.locPos
                });
                drawHandlesWebGL({
                    webgl: model.webgl,
                    ctx: model.ctx,
                    el: layer,
                    matrix: layer.matrix,
                    locPos: model.locPos,
                    points: pts,
                    size: 10
                });
            } else {
                drawBox2D(model.ctx, pts);
                drawCornerHandles(model.ctx, pts, 10);
            }

            return true; // render() vorher beenden
        }
    }

    return false;
}

// ---------------------- 2D Helper ---------------------- //
function drawBox2D(ctx, pts) {
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

/**
 * Zeichnet ein Auswahlrechteck in WebGL
 * @param {*} model
 */
function drawBoxWebGL(model) {
    if (!model.webgl || !model.program) return;

    if (model.locPos < 0) return;

    // Transform setzen
    applyTransformMatrix({
        webgl: model.webgl,
        ctx: model.ctx,
        matrix: model.matrix,
        program: model.program,
        el: model.el
    });

    const color = new Float32Array([30 / 255, 144 / 255, 1, 0.95]);
    const u_color = model.ctx.getUniformLocation(model.program, 'u_color');
    if (u_color) model.ctx.uniform4fv(u_color, color);

    const w = model.el.width;
    const h = model.el.height;

    const verts = new Float32Array([
        model.points[0].x / w, model.points[0].y / h,
        model.points[1].x / w, model.points[1].y / h,
        model.points[2].x / w, model.points[2].y / h,
        model.points[0].x / w, model.points[0].y / h,
        model.points[2].x / w, model.points[2].y / h,
        model.points[3].x / w, model.points[3].y / h
    ]);

    // --- Buffer und VAO binden ---
    const buf = model.ctx.createBuffer();
    model.ctx.bindVertexArray(model.glVAO);
    model.ctx.bindBuffer(model.ctx.ARRAY_BUFFER, buf);
    model.ctx.bufferData(model.ctx.ARRAY_BUFFER, verts, model.ctx.STATIC_DRAW);
    model.ctx.enableVertexAttribArray(model.locPos);
    model.ctx.vertexAttribPointer(model.locPos, 2, model.ctx.FLOAT, false, 0, 0);

    // Draw
    model.ctx.drawArrays(model.ctx.TRIANGLES, 0, 6);

    // Cleanup
    model.ctx.bindVertexArray(null);
    model.ctx.deleteBuffer(buf);
}


/**
 * Zeichnet die Eckpunkte (Handles) in WebGL
 * @param {*} model
 */
function drawHandlesWebGL(model) {
    if (!model.webgl || !model.program) return;

    if (model.locPos < 0) return;

    // Transform setzen
    applyTransformMatrix({
        webgl: true,
        ctx: model.ctx,
        program: model.program,
        el: model.el,
        matrix: model.matrix
    });

    const color = new Float32Array([1, 1, 1, 0.95]);
    const u_color = model.ctx.getUniformLocation(model.program, 'u_color');
    if (u_color) model.ctx.uniform4fv(u_color, color);

    const w = model.el.width;
    const h = model.el.height;

    // VAO binden
    model.ctx.bindVertexArray(model.glVAO);

    for (const c of model.points) {
        const half = model.size / 2;
        const x0 = (c.x - half) / w;
        const y0 = (c.y - half) / h;
        const x1 = (c.x + half) / w;
        const y1 = (c.y + half) / h;

        const verts = new Float32Array([
            x0, y0, x1, y0, x0, y1,
            x1, y0, x1, y1, x0, y1
        ]);

        // Buffer erstellen und binden
        const buf = model.ctx.createBuffer();
        model.ctx.bindBuffer(model.ctx.ARRAY_BUFFER, buf);
        model.ctx.bufferData(model.ctx.ARRAY_BUFFER, verts, model.ctx.STATIC_DRAW);

        // Attribut konfigurieren
        model.ctx.enableVertexAttribArray(model.locPos);
        model.ctx.vertexAttribPointer(model.locPos, 2, model.ctx.FLOAT, false, 0, 0);

        // Draw
        model.ctx.drawArrays(model.ctx.TRIANGLES, 0, 6);

        // Buffer löschen
        model.ctx.deleteBuffer(buf);
    }

    // VAO wieder unbinden
    model.ctx.bindVertexArray(null);
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