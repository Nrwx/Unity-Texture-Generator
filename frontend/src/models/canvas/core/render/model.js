import {loadImage} from "@/models/canvas/core/load/model";
import {blendModeMap} from "@/models/canvas/blend/model";
import {
    applyTransformMatrix,
    applyViewTransform, clearCanvas,
    isGLContext,
    sortFilter
} from "@/models/canvas/core/utils/model";
import {drawBackground} from "@/models/canvas/background/model";
import {updateSegmentGridData} from "@/models/canvas/core/layout/model";
import {renderSelection, showGrid} from "@/models/canvas/ui/model";
import {matrixMultiply} from "@/utils/matrix";
import {createTextureForObject, uploadImageToTexture} from "@/models/canvas/core/texture/model";
import {bustUrl} from "@/utils/burstUrl";

/**
 * Draws a single layer with 4x4 WebGL matrix support
 * @param {object} model - {webgl, ctx, program, layer, locPos, locUV, locView, locOpacity}
 */
export const drawLayer = async (model) => {
    try {
        const lw = model.layer.width;
        const lh = model.layer.height;

        // --- WebGL ---
        if (model.webgl && model.program && model.locPos != null && model.locOpacity != null) {
            model.ctx.bindBuffer(model.ctx.ARRAY_BUFFER, model.glQuadBuffer);

            // Position
            model.ctx.enableVertexAttribArray(model.locPos);
            model.ctx.vertexAttribPointer(model.locPos, 2, model.ctx.FLOAT, false, 16, 0);

            // UV
            model.ctx.enableVertexAttribArray(model.locUV);
            model.ctx.vertexAttribPointer(model.locUV, 2, model.ctx.FLOAT, false, 16, 8);

            // --- Upload opacity ---
            model.ctx.uniform1f(model.locOpacity, model.layer.opacity ?? 1.0);

            // --- Upload layer matrix ---
            if (model.locView && model.layer.matrix instanceof Float32Array) {
                applyTransformMatrix({
                    webgl: model.webgl,
                    program: model.program,
                    ctx: model.ctx,
                    el: model.layer,
                    matrix: model.layer.matrix
                });
            }

            if (!model?.layer?._tex || model?.layer?._tex?._gl !== model?.ctx) {
                createTextureForObject({ctx: model.ctx, el: model.layer});
            }

            if ((model.layer._update) || (!model.layer._texture && model.layer.url)) {
                try {
                    let url = model?.layer?.url;

                    if (model?.layer?._update) {
                        url = bustUrl(model?.layer?.url)
                    }

                    console.log(url, 'THIS IS URL')
                    // MUSS ASYNC
                    const img = await loadImage(url);
                    if (img && img?.complete) {
                        model.layer._img = img;
                        model.layer._resolvedUrl = url;
                    }
                    if (model?.layer?._img?.complete && model?.layer?._tex) {
                        // MUSS ASYNC
                        await uploadImageToTexture({ctx: model.ctx, el: model.layer, payload: img});
                        console.log('THIS IS UPLOAD TEXTURE')
                    }
                } catch (e) {
                    console.warn('drawLayer: texture upload failed', e);
                }
            }

            // --- Draw quad ---
            model.ctx.activeTexture(model.ctx.TEXTURE0);
            model.ctx.bindTexture(model.ctx.TEXTURE_2D, model.layer._tex);
            model.ctx.uniform1i(model.locTex, 0);

            const bm = (model.layer.blend_mode || 'source-over').toLowerCase();
            switch (bm) {
                case 'add':
                case 'lighter':
                    model.ctx.blendFunc(model.ctx.SRC_ALPHA, model.ctx.ONE);
                    break;
                case 'multiply':
                    model.ctx.blendFuncSeparate(model.ctx.DST_COLOR, model.ctx.ONE_MINUS_SRC_ALPHA, model.ctx.ONE, model.ctx.ONE_MINUS_SRC_ALPHA);
                    break;
                case 'screen':
                    model.ctx.blendFuncSeparate(model.ctx.ONE_MINUS_DST_COLOR, model.ctx.ONE, model.ctx.ONE, model.ctx.ONE_MINUS_SRC_ALPHA);
                    break;
                default:
                    // source-over
                    model.ctx.blendFuncSeparate(model.ctx.SRC_ALPHA, model.ctx.ONE_MINUS_SRC_ALPHA, model.ctx.ONE, model.ctx.ONE_MINUS_SRC_ALPHA);
            }

            model.ctx.drawArrays(model.ctx.TRIANGLES, 0, 6);
            console.log('THIS IS END DRAW')
        }

        // --- 2D Canvas fallback ---
        else if (!isGLContext(model.ctx)) {
            model.ctx.save();

            applyTransformMatrix({
                webgl: model.webgl,
                ctx: model.ctx,
                el: model.layer,
                matrix: model.layer.matrix
            });

            model.ctx.globalAlpha = model.layer.opacity ?? 1.0;
            model.ctx.globalCompositeOperation = blendModeMap(model.layer.blend_mode) || 'source-over';

            if (model.layer.color) {
                model.ctx.fillStyle = model.layer.color;
                model.ctx.fillRect(0, 0, lw, lh);
            }

            if (model.layer.url) {
                if (model.layer._img && model.layer._img.complete) {
                    model.ctx.drawImage(model.layer._img, 0, 0, lw, lh);
                } else {
                    try {
                        const img = model.layer.url ? await loadImage(model.layer.url) : null;
                        if (img) model.layer._img = img;
                        if (img && img?.complete) model.ctx.drawImage(img, 0, 0, lw, lh);
                    } catch (e) {
                        console.warn('drawLayer: loadImage failed', e);
                    }
                }
            }

            model.ctx.restore();
        }

    } catch (e) {
        console.warn('drawLayer: failed', e);
    }
};


/**
 * Main canvas render function
 * @param {object} model - canvas model object
 */
export const render = (model) => {

    clearCanvas({ctx: model.ctx, canvas: model.canvas});

    applyViewTransform({
        webgl: model.webgl,
        program: model.program,
        ctx: model.ctx,
        canvas: model.canvas,
        wrapper: model.wrapper,
        viewport: model.viewport,
        matrix: model.matrix,
        background: model.background,
        locView: model.locView
    });

    updateSegmentGridData({
        webgl: model.webgl,
        ctx: model.ctx,
        segments: model.segments,
        layout: model.layout
    });

    // -------------------
    // Global Base Layers
    // -------------------
    if (model.base.length) {
        for (const base of sortFilter(model.base)) {
            drawLayer({
                webgl: model.webgl,
                canvas: model.canvas,
                ctx: model.ctx,
                layer: base,
                program: model.program,
                locPos: model.locPos,
                locOpacity: model.locOpacity,
                locUV: model.locUV,
                locTex: model.locTex,
                glVAO: model.glVAO,
                glQuadBuffer: model.glQuadBuffer
            });
        }
    }
    // -------------------
    // Global Layers
    // -------------------
    if (model.layers.length) {
        for (const layer of sortFilter(model.layers)) {
            drawLayer({
                webgl: model.webgl,
                canvas: model.canvas,
                ctx: model.ctx,
                layer: layer,
                program: model.program,
                locPos: model.locPos,
                locOpacity: model.locOpacity,
                locUV: model.locUV,
                locTex: model.locTex,
                glVAO: model.glVAO,
                glQuadBuffer: model.glQuadBuffer
            });
        }
    }

    // -------------------
    // Segments
    // -------------------
    if (model.segments.length) {
        const segArray = model?._fullscreen
            ? model.segments.filter(s => s.id === model._fullscreen)
            : sortFilter(model.segments);

        for (const seg of segArray) {
            const sx = model.webgl ? seg.matrix[12] : seg.matrix.x;
            const sy = model.webgl ? seg.matrix[13] : seg.matrix.y;
            const sw = seg.width;
            const sh = seg.height;
            if (!isGLContext(model.ctx)) {
                model.ctx.save();
                model.ctx.globalAlpha = seg.opacity ?? 1;
            }
            applyTransformMatrix({
                webgl: model.webgl,
                ctx: model.ctx,
                program: model.program,
                el: seg,
                matrix: seg.matrix
            });

            // Segment background
            if (seg.background) {
                drawBackground({
                    webgl: model.webgl,
                    ctx: model.ctx,
                    canvas: model.canvas,
                    background: seg.background,
                    matrix: {x: sx, y: sy, w: sw, h: sh}
                });
            }

            // Segment Layers
            const segLayers = seg.layers ? sortFilter(seg.layers) : [];
            for (const layer of segLayers) {
                layer.matrix = matrixMultiply(seg.matrix, layer.matrix);

                drawLayer({
                    webgl: model.webgl,
                    canvas: model.canvas,
                    ctx: model.ctx,
                    layer,
                    program: model.program,
                    locPos: model.locPos,
                    locOpacity: model.locOpacity,
                    locUV: model.locUV,
                    locTex: model.locTex,
                    glVAO: model.glVAO,
                    glQuadBuffer: model.glQuadBuffer
                });
            }

            if (!isGLContext(model.ctx)) {
                model.ctx.restore();
            }
        }

        if (!isGLContext(model.ctx)) {
            model.ctx.restore();
        }

        // -------------------
        // Grid
        // -------------------
        showGrid({
            webgl: model.webgl,
            ctx: model.ctx,
            canvas: model.canvas,
            matrix: model.matrix,
            showGrid: model.showGrid,
            layout: model.layout
        });
    }

    if (model.selectedLayer || model.selectedSegmentId) {
        // -------------------
        // Selection
        // -------------------
        renderSelection({
            webgl: model.webgl,
            ctx: model.ctx,
            canvas: model.canvas,
            base: model.base,
            layers: model.layers,
            segments: model.segments,
            selectedLayer: model.selectedLayer,
            selectedSegmentId: model.selectedSegmentId,
            program: model.program,
            locPos: model.locPos,
            glVAO: model.glVAO,
            matrix: model.matrix,
            layout: model.layout
        });

        if (!isGLContext(model.ctx)) {
            model.ctx.globalCompositeOperation = "source-over";
            model.ctx.globalAlpha = 1;
        }
    }
    console.log(model)
}

/**
 * Render a temporary canvas with a given width, height, and render function
 * @param {number} width
 * @param {number} height
 * @param {(ctx: CanvasRenderingContext2D)=>void} renderFn
 * @returns {{canvas:HTMLCanvasElement, dataUrl:string}}
 */
export const renderToTempCanvas = (width, height, renderFn) => {
    const w = Math.max(1, Math.ceil(width));
    const h = Math.max(1, Math.ceil(height));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if(!ctx) throw new Error('Canvas-Context konnte nicht erstellt werden');
    renderFn(ctx);
    return { canvas, dataUrl: canvas.toDataURL() };
};