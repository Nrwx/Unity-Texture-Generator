export class PickingFramebuffer {
    constructor(gl) {
        this.gl = gl;
        this.framebuffer = null;
        this.color = null;
        this.depth = null;
        this.width = 0;
        this.height = 0;
    }

    ensure(width, height) {
        const gl = this.gl;
        const w = Math.max(1, Math.trunc(width));
        const h = Math.max(1, Math.trunc(height));

        if (this.framebuffer && this.width === w && this.height === h) {
            return this;
        }

        this.destroy();
        this.width = w;
        this.height = h;
        this.framebuffer = gl.createFramebuffer();
        this.color = gl.createTexture();
        this.depth = gl.createRenderbuffer();

        gl.bindTexture(gl.TEXTURE_2D, this.color);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.color, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        return this;
    }

    bind(width, height) {
        this.ensure(width, height);
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, this.width, this.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    read(x, y) {
        const gl = this.gl;
        const pixel = new Uint8Array(4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.readPixels(
            Math.max(0, Math.min(this.width - 1, Math.trunc(x))),
            Math.max(0, Math.min(this.height - 1, Math.trunc(this.height - y))),
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixel
        );
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return pixel;
    }

    destroy() {
        const gl = this.gl;
        if (this.color) gl.deleteTexture(this.color);
        if (this.depth) gl.deleteRenderbuffer(this.depth);
        if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
        this.color = null;
        this.depth = null;
        this.framebuffer = null;
    }

    static encodeId(id) {
        const value = Math.max(0, Math.trunc(Number(id) || 0));
        return [
            value & 255,
            (value >> 8) & 255,
            (value >> 16) & 255,
            (value >> 24) & 255,
        ];
    }

    static decodeId(pixel) {
        return (pixel[0] | (pixel[1] << 8) | (pixel[2] << 16) | (pixel[3] << 24)) >>> 0;
    }
}
