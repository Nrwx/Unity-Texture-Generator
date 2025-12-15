// texture/model.js
export class Texture {
    static COMMON = {
        premultiplyAlpha: false,
        minFilter: 'LINEAR',
        magFilter: 'LINEAR'
    };

    static WRAP = {
        CLAMP: { wrapS: 'CLAMP_TO_EDGE', wrapT: 'CLAMP_TO_EDGE' },
        REPEAT: { wrapS: 'REPEAT', wrapT: 'REPEAT' }
    };

    static TYPES = {
        COLOR: { type: 'color', ...Texture.COMMON },
        DATA: { type: 'data', ...Texture.COMMON }
    };

    static DEFAULT_PIXELS = {
        transparent: [0, 0, 0, 0],
        white: [255, 255, 255, 255],
        black: [0, 0, 0, 255],
        midGray: [128, 128, 128, 255],
        normal: [128, 128, 255, 255]
    };

    static TEXTURE_MAP = {
        transparent: { ...Texture.TYPES.COLOR, ...Texture.WRAP.CLAMP, defaultPixel: Texture.DEFAULT_PIXELS.transparent },
        diffuse:     { ...Texture.TYPES.COLOR, ...Texture.WRAP.REPEAT, defaultPixel: Texture.DEFAULT_PIXELS.white },
        light:       { ...Texture.TYPES.COLOR, ...Texture.WRAP.CLAMP, defaultPixel: Texture.DEFAULT_PIXELS.black },
        normal:      { ...Texture.TYPES.DATA,  ...Texture.WRAP.REPEAT, defaultPixel: Texture.DEFAULT_PIXELS.normal },
        bump:        { ...Texture.TYPES.DATA,  ...Texture.WRAP.REPEAT, defaultPixel: Texture.DEFAULT_PIXELS.midGray },
        specular:    { ...Texture.TYPES.DATA,  ...Texture.WRAP.CLAMP, defaultPixel: Texture.DEFAULT_PIXELS.black },
        roughness:   { ...Texture.TYPES.DATA,  ...Texture.WRAP.CLAMP, defaultPixel: Texture.DEFAULT_PIXELS.midGray },
        metallic:    { ...Texture.TYPES.DATA,  ...Texture.WRAP.CLAMP, defaultPixel: Texture.DEFAULT_PIXELS.black },
        ambientOcclusion: { ...Texture.TYPES.DATA, ...Texture.WRAP.CLAMP, defaultPixel: Texture.DEFAULT_PIXELS.white }
    };

    static idCounter = 0;

    /**
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
     * @param {string} modeKey
     * @param {FileCache|null} cache
     */
    constructor(gl, modeKey = 'transparent', cache = null) {
        this.gl = gl;
        this.cache = cache;
        this.id = ++Texture.idCounter;
        this.texture = null;
        this._payload = null; // store image / bitmap used for later array creation

        const mode = Texture.TEXTURE_MAP[modeKey] || Texture.TEXTURE_MAP.transparent;
        this.mode = { ...mode, key: modeKey };
    }

    /** create default 1x1 texture */
    create() {
        const gl = this.gl;
        if (this.texture) gl.deleteTexture(this.texture);
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl[this.mode.wrapS]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl[this.mode.wrapT]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl[this.mode.minFilter]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl[this.mode.magFilter]);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.mode.premultiplyAlpha);

        const px = new Uint8Array(this.mode.defaultPixel);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);

        return this.texture;
    }

    /**
     * Upload eines Bildes / Canvas / Video / ImageBitmap oder URL (über Cache)
     * Speichert zusätzlich das Payload (Image/Bitmap/Canvas) in this._payload
     */
    async update(source) {
        const gl = this.gl;
        if (!this.texture) throw new Error('Texture not created yet.');
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        let payload = source;
        if (typeof source === 'string' && this.cache) {
            payload = await this.cache.load(source);
        }

        // accept HTMLImageElement, HTMLCanvasElement, ImageBitmap, Video etc.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, payload);

        // store payload for later composition (array creation)
        this._payload = payload;
        return this.texture;
    }

    delete() {
        if (!this.texture) return;
        this.gl.deleteTexture(this.texture);
        this.texture = null;
        this._payload = null;
    }

    getPayload() {
        // returns the stored image/bitmap/canvas if any
        return this._payload;
    }

    // ------------------------
    // Texture2DArray helper (WebGL2)
    // images: array of HTMLImageElement|ImageBitmap|HTMLCanvasElement (one per layer)
    // returns {texture, width, height, layers} or null if not possible
    static createTexture2DArray(gl, images = [], options = {}) {
        if (!(gl instanceof WebGL2RenderingContext)) {
            console.warn('createTexture2DArray: WebGL2 required.');
            return null;
        }
        if (!images || images.length === 0) return null;

        // ensure all images are available
        const first = images[0];
        let width = first.width, height = first.height;
        for (let i = 1; i < images.length; i++) {
            if (images[i].width !== width || images[i].height !== height) {
                console.warn('createTexture2DArray: layer sizes differ -> fallback to individual textures.');
                return null;
            }
        }

        const layers = images.length;
        // create array texture
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);

        const wrapS = options.wrapS ? options.wrapS : gl.CLAMP_TO_EDGE;
        const wrapT = options.wrapT ? options.wrapT : gl.CLAMP_TO_EDGE;
        const minFilter = options.minFilter ? options.minFilter : gl.LINEAR;
        const magFilter = options.magFilter ? options.magFilter : gl.LINEAR;

        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, wrapS);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, wrapT);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, minFilter);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, magFilter);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, options.premultiplyAlpha ? 1 : 0);

        // allocate storage
        // prefer texStorage3D if available for immutable storage
        if (gl.texStorage3D) {
            gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, width, height, layers);
            // upload each layer via texSubImage3D
            for (let i = 0; i < layers; i++) {
                gl.texSubImage3D(
                    gl.TEXTURE_2D_ARRAY,
                    0,
                    0, 0, i,
                    width, height, 1,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    images[i]
                );
            }
        } else {
            // fallback: use texImage3D (still WebGL2)
            gl.texImage3D(
                gl.TEXTURE_2D_ARRAY,
                0,
                gl.RGBA,
                width,
                height,
                layers,
                0,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                null
            );
            for (let i = 0; i < layers; i++) {
                gl.texSubImage3D(
                    gl.TEXTURE_2D_ARRAY,
                    0,
                    0, 0, i,
                    width, height, 1,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    images[i]
                );
            }
        }

        // unbind
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        return { texture: tex, width, height, layers };
    }

    // Convenience: build 2DArray from array of Texture instances (must have payloads of same size)
    static buildArrayFromTextures(gl, textureInstances = [], options = {}) {
        const images = [];
        for (const t of textureInstances) {
            if (!t || !t.getPayload()) {
                console.warn('buildArrayFromTextures: missing payload for a texture -> aborting array build.');
                return null;
            }
            images.push(t.getPayload());
        }
        return Texture.createTexture2DArray(gl, images, options);
    }
}
