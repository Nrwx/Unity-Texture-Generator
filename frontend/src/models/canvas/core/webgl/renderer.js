/* canvas/webgl/renderer.js
   WebGLRenderer - primary GPU renderer for the canvas pipeline.
   - WebGL2 (fallback to WebGL1)
   - TileManager with texSubImage2D incremental updates
   - Layer rasterize helper (OffscreenCanvas fallback)
   - BrushWorker Blob (OffscreenCanvas -> ImageBitmap)
   - scheduleUpload API for main thread to push ImageBitmap/canvas -> tile
*/

import {getDpr} from "@/models/canvas/core/utils/model";


function compileShader(gl, type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const err = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('Shader compile error: ' + err);
    }
    return shader;
}

function createProgram(gl, vsSrc, fsSrc) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const err = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error('Program link error: ' + err);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return program;
}

// --- Shader Templates ---
function getDefaultShaders(isWebGL2) {
    if (isWebGL2) {
        return {
            vs: `#version 300 es
precision highp float;
in vec2 a_pos;
in vec2 a_uv;
uniform mat3 u_view;
out vec2 v_uv;
void main() {
    gl_Position = vec4(a_pos*2.0-1.0,0.0,1.0);
    v_uv = a_uv;
}`,
            fs: `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_opacity;
out vec4 outColor;
void main() {
    vec4 s = texture(u_tex, v_uv);
    outColor = vec4(s.rgb, s.a*u_opacity);
}`
        };
    } else {
        return {
            vs: `
attribute vec2 a_pos;
attribute vec2 a_uv;
uniform mat3 u_view;
varying vec2 v_uv;
void main() {
    gl_Position = vec4(a_pos*2.0-1.0,0.0,1.0);
    v_uv = a_uv;
}`,
            fs: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_opacity;
varying vec2 v_uv;
void main() {
    vec4 s = texture2D(u_tex, v_uv);
    gl_FragColor = vec4(s.rgb, s.a*u_opacity);
}`
        };
    }
}

// --- TileManager ---
class TileManager {
    constructor(gl, tile=512) {
        this.gl = gl;
        this.tile = tile;
        this.tiles = new Map();
    }

    _key(segId, r, c) { return `${segId}:${r}:${c}`; }

    ensureTile(segId, r, c, w=this.tile, h=this.tile) {
        const key = this._key(segId, r, c);
        if (!this.tiles.has(key)) {
            const gl = this.gl;
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.bindTexture(gl.TEXTURE_2D, null);
            this.tiles.set(key, { tex, w, h, segId, row: r, col: c, uploaded:false, worldX:0, worldY:0, pixelW:w, pixelH:h });
        }
        return this.tiles.get(key);
    }

    getTile(segId, r, c) { return this.tiles.get(this._key(segId, r, c)); }

    deleteTile(segId, r, c) {
        const key = this._key(segId, r, c);
        const tile = this.tiles.get(key);
        if (tile) {
            this.gl.deleteTexture(tile.tex);
            this.tiles.delete(key);
        }
    }

    async uploadToTile(segId, r, c, x, y, source) {
        const tile = this.ensureTile(segId, r, c);
        const gl = this.gl;
        if (!gl) return;
        gl.bindTexture(gl.TEXTURE_2D, tile.tex);
        try {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, source);
            tile.uploaded = true;
        } catch(e) {
            console.warn("tile upload failed", e);
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
}

// --- Helper ---
async function createBitmap(src) {
    if (typeof createImageBitmap !== 'undefined') {
        try { return await createImageBitmap(src); } catch(e) {
            console.log(e)}
    }
    return src;
}

// --- WebGLRenderer ---
export class WebGLRenderer {
    constructor(model) {
        this.canvas = model?.canvas;
        this.tile = model?.glTile || 512;
        this._pending = [];
        this._viewMat = null;
        this.valid = false;
        this.gl = null;
        this.program = null;
        this.tileManager = null;
        this.quadBuf = null;
        this.loc = null;

        // start async init but don't block constructor
        this._initPromise = this._asyncInit(model?.ctx);
    }

    async _asyncInit(ctx) {
        this.gl = ctx;

        if (!this.gl) {
            console.warn("WebGL not available, fallback to 2D.");
            this.valid = false;
            this.tileManager = null;
            this.program = null;
            return;
        }

        this.valid = true;

        // Wähle die passenden Shader abhängig von WebGL2
        const shaders = getDefaultShaders(this.gl instanceof WebGL2RenderingContext);

        try {
            this.program = createProgram(this.gl, shaders.vs, shaders.fs);
            this.tileManager = new TileManager(this.gl, this.tile);
            this._initGLState();
        } catch (e) {
            console.warn("WebGL program creation failed, fallback to 2D.", e);
            this.valid = false;
            this.tileManager = null;
            this.program = null;
        }
    }

    isValid() { return !!this.valid && !!this.gl; }

    async initFromModel(model) {
        if (this._initPromise) await this._initPromise;
        if (!this.valid || !this.gl) return;
        const dpr = getDpr();
        let w = model.viewport?.width || this.canvas.clientWidth;
        let h = model.viewport?.height || this.canvas.clientHeight;
        w = Math.max(1, Math.floor(w*dpr));
        h = Math.max(1, Math.floor(h*dpr));
        this.canvas.width = w;
        this.canvas.height = h;
        this.gl.viewport(0,0,this.gl.drawingBufferWidth,this.gl.drawingBufferHeight);
    }

    _initGLState() {
        const gl = this.gl;
        gl.useProgram(this.program);

        this.quadBuf = gl.createBuffer();
        const verts = new Float32Array([
            0,0, 0,0,
            1,0, 1,0,
            0,1, 0,1,
            1,0, 1,0,
            1,1, 1,1,
            0,1, 0,1
        ]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        this.loc = {
            a_pos: gl.getAttribLocation(this.program, 'a_pos'),
            a_uv: gl.getAttribLocation(this.program, 'a_uv'),
            u_tex: gl.getUniformLocation(this.program, 'u_tex'),
            u_opacity: gl.getUniformLocation(this.program, 'u_opacity'),
            u_view: gl.getUniformLocation(this.program, 'u_view')
        };
    }

    scheduleUpload(segId, row, col, x, y, source, meta={}) {
        if (!this.valid) return;
        const tile = this.tileManager.ensureTile(segId,row,col);
        if (meta.worldX!==undefined) tile.worldX = meta.worldX;
        if (meta.worldY!==undefined) tile.worldY = meta.worldY;
        if (meta.pixelW!==undefined) tile.pixelW = meta.pixelW;
        if (meta.pixelH!==undefined) tile.pixelH = meta.pixelH;
        this._pending.push({segId,row,col,x,y,source});
    }

    async _processPending() {
        if (!this.valid) return;
        while(this._pending.length) {
            const job = this._pending.shift();
            await this.tileManager.uploadToTile(job.segId, job.row, job.col, job.x, job.y, job.source);
        }
    }

    async render(model) {
        if (!this.valid) return;
        this._viewMat = model.matrix && model.matrixToViewMatrix
            ? model.matrixToViewMatrix(model.matrix)
            : new Float32Array([1,0,0, 0,1,0, 0,0,1]);

        await this._processPending();

        const gl = this.gl;
        gl.viewport(0,0,gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(this.program);

        if (this.loc.u_view) gl.uniformMatrix3fv(this.loc.u_view,false,this._viewMat);

        for(const tile of this.tileManager.tiles.values()) {
            if (!tile.uploaded) continue;
            gl.bindBuffer(gl.ARRAY_BUFFER,this.quadBuf);
            gl.enableVertexAttribArray(this.loc.a_pos);
            gl.vertexAttribPointer(this.loc.a_pos,2,gl.FLOAT,false,16,0);
            gl.enableVertexAttribArray(this.loc.a_uv);
            gl.vertexAttribPointer(this.loc.a_uv,2,gl.FLOAT,false,16,8);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D,tile.tex);
            gl.uniform1i(this.loc.u_tex,0);
            gl.uniform1f(this.loc.u_opacity,1.0);
            gl.drawArrays(gl.TRIANGLES,0,6);
            gl.bindTexture(gl.TEXTURE_2D,null);
        }
    }

    async rasterizeLayerAndSchedule(layer, segment) {
        const w = Math.max(1, Math.ceil(layer.width||1));
        const h = Math.max(1, Math.ceil(layer.height||1));
        let off = (typeof OffscreenCanvas!=='undefined') ? new OffscreenCanvas(w,h) : (()=>{ const c=document.createElement('canvas'); c.width=w;c.height=h; return c; })();
        const ctx = off.getContext('2d');

        if(layer.color) ctx.fillStyle=layer.color, ctx.fillRect(0,0,w,h);
        if(layer._img && layer._img.complete) ctx.drawImage(layer._img,0,0,w,h);

        const cols=Math.ceil(w/this.tile), rows=Math.ceil(h/this.tile);
        for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
            const sx=c*this.tile, sy=r*this.tile;
            const sw=Math.min(this.tile,w-sx), sh=Math.min(this.tile,h-sy);
            let small = (typeof OffscreenCanvas!=='undefined') ? new OffscreenCanvas(sw,sh) : (()=>{const c=document.createElement('canvas'); c.width=sw;c.height=sh; return c;})();
            small.getContext('2d').drawImage(off,sx,sy,sw,sh,0,0,sw,sh);
            const segId=segment.id||'seg';
            const meta={worldX:(segment.matrix?.x||0)+sx, worldY:(segment.matrix?.y||0)+sy, pixelW:sw, pixelH:sh};
            createBitmap(small).then(bmp=>this.scheduleUpload(segId,r,c,0,0,bmp,meta)).catch(e=>console.warn('bitmap create failed',e));
        }
    }

    destroy() {
        if(!this.valid) return;
        for(const tile of this.tileManager.tiles.values()) this.gl.deleteTexture(tile.tex);
        if(this.program) this.gl.deleteProgram(this.program);
        if(this.quadBuf) this.gl.deleteBuffer(this.quadBuf);
    }
}

// --- Brush worker Blob ---
export const BrushWorkerBlob = (()=>{
    const code=`
self.onmessage = async (e) => {
  const { id, points, brush } = e.data;
  const size = brush.size || 128;
  const off = new OffscreenCanvas(size, size);
  const ctx = off.getContext('2d');
  ctx.clearRect(0,0,size,size);
  ctx.fillStyle = brush.color || 'rgba(0,0,0,1)';
  for (let p of points) {
    ctx.beginPath();
    ctx.arc(p.x,p.y,brush.size/2,0,Math.PI*2);
    ctx.fill();
  }
  const bmp = off.transferToImageBitmap();
  self.postMessage({ id,imageBitmap:bmp }, [bmp]);
};`;
    return URL.createObjectURL(new Blob([code],{type:'application/javascript'}));
})();
