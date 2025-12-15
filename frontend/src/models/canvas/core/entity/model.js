import { Texture } from "@/models/canvas/core/texture/model";
import { Collision } from "@/models/canvas/core/collision/layer/model";
import { Geometry } from "@/models/canvas/core/geometry/model";
import { Physics } from "@/models/canvas/core/physics/layer/model";
import { Material } from "@/models/canvas/core/material/model";
import { bustUrl } from "@/utils/burstUrl";
import {
    deg2rad,
    matrix2dAffineTo4x4,
    matrixMultiply
} from "@/utils/matrix";

export class Entity {

    static TYPES = {
        MESH: "mesh",
        OBJECT: "object",
        TREE: "tree",
        EFFECT: "effect",
        TEXTURE: "texture"
    };

    constructor(model, props = {}) {
        this.ctx = model.ctx;
        this.cache = model.cache;
        this.blendLoader = model.blendLoader;

        this.id = props.id ?? crypto.randomUUID();
        this.type = props.type ?? Entity.TYPES.OBJECT;

        this.uniforms = {};
        this.textures = new Map();
        this.force = { props: true, matrix: true, texture: true };
        this.bounds = { x: 0, y: 0, w: 0, h: 0 };
        this.collision = new Collision(this);

        // Props immer sichtbar
        this.props = { ...props };

        // Type-spezifische Defaults
        this._setupTypeDefaults();
    }

    _setupTypeDefaults() {
        // Gemeinsame Defaults
        this.props = {
            x: this.props.x ?? 0,
            y: this.props.y ?? 0,
            z: this.props.z ?? 0,
            width: this.props.width ?? 1,
            height: this.props.height ?? 1,
            scaleX: this.props.scaleX ?? 1,
            scaleY: this.props.scaleY ?? 1,
            scaleZ: this.props.scaleZ ?? 1,
            rotate: this.props.rotate ?? 0,
            rotateX: this.props.rotateX ?? 0,
            rotateY: this.props.rotateY ?? 0,
            rotateZ: this.props.rotateZ ?? 0,
            world: this.props.world ?? "3d",
            webgl: this.props.webgl ?? true,
            active: this.props.active ?? false,
            url: this.props.url ?? null,
            opacity: this.props.opacity ?? 1,
            hidden: this.props.hidden ?? false,
            blendMode: this.props.blendMode ?? "normal",
            textureMode: this.props.textureMode ?? "diffuse",
            matrix: new Float32Array(16),
            ...this.props
        };

        // Type-spezifische Defaults
        switch (this.type) {
            case Entity.TYPES.MESH: {
                // Aktiv default ON
                this.props.active = this.props.active ?? true;

                // Skeletal Animation
                this.props.bones = Array.isArray(this.props.bones) ? this.props.bones : [];
                this.props.animations = this.props.animations ?? [];

                // --- hasAnimation Flag ---
                this.props.hasAnimation = this.props.bones.length > 0 && this.props.animations.length > 0;

                // --- Keyframes vorbereiten ---
                const boneCount = this.props.bones.length;
                this.props.animations.forEach(anim => {
                    anim.keyframes.forEach(kf => {
                        if (!kf.boneTransforms) {
                            kf.boneTransforms = Array(boneCount).fill(0).map(() => {
                                const mat = new Float32Array(16);
                                for (let i = 0; i < 16; i++) mat[i] = i % 5 === 0 ? 1 : 0; // Identity Matrix
                                return mat;
                            });
                        }
                    });
                });

                // Physics
                this.props.physics = this.props.physics
                    ? new Physics(this.props.physics)
                    : new Physics({ mass: 1, friction: 0.5 });

                // Geometry
                this.props.geometry = this.props.geometry ?? Geometry.createDefaultCube();

                // Geometry settings for MeshSystem
                this.props.geometry.settings ??= {
                    doubleSided: false,
                    cullFace: "back",
                    depthTest: true,
                    billboard: false
                };

                // Auto tangents for normal mapping
                if (this.props.geometry.computeTangents && !this.props.geometry.tangents) {
                    this.props.geometry.computeTangents();
                }

                // Material
                this.material = this.props.material
                    ? new Material(this.props.material)
                    : new Material();
                break;
            }

            case Entity.TYPES.OBJECT:
                this.props.static = this.props.static ?? true;
                break;

            case Entity.TYPES.TREE:
                this.props.layer = this.props.layer ?? "vegetation";
                this.props.wind = this.props.wind ?? { sway: 0.2 };
                break;

            case Entity.TYPES.EFFECT:
                this.props.effectRefs = this.props.effectRefs ?? [];
                this.props.blendMode = this.props.blendMode ?? "additive";
                break;

            case Entity.TYPES.TEXTURE:
                this.props.shape = this.props.shape ?? "quad"; // quad | circle | polygon
                this.props.textureMode = this.props.textureMode ?? "diffuse";
                break;
        }
    }

    // =========================================================================
    // INIT
    // =========================================================================
    init() {
        this._initMatrix();
        this._initTexture();
        this.updateBounds();

        this.force.props = false;
        this.force.matrix = false;
        this.force.texture = false;

        return this;
    }

    _initMatrix() {
        this.updateMatrix();
    }

    /**
     * _initTexture:
     * - creates default diffuse slot for TEXTURE type
     * - does NOT overwrite other pre-set slots
     */
    _initTexture() {
        if (this.type === Entity.TYPES.TEXTURE || this.props.textureMode) {
            if (!this.textures.has("diffuse")) {
                const tex = new Texture(this.ctx, this.props.textureMode, this.cache);
                tex.create();
                tex.ready = false;
                this.textures.set("diffuse", tex);

                if (this.props.url) {
                    tex.update(bustUrl(this.props.url)).then(() => {
                        tex.ready = true;
                        // sync to material slot if exists
                        if (this.material && 'diffuse' in this.material) this.material.diffuse = tex;
                    });
                } else {
                    tex.ready = true;
                    if (this.material && 'diffuse' in this.material) this.material.diffuse = tex;
                }
            } else {
                // if already present, ensure material sync
                const existing = this.textures.get("diffuse");
                if (this.material && 'diffuse' in this.material) this.material.diffuse = existing;
            }
        }
    }

    // =========================================================================
    // UPDATE
    // =========================================================================
    async update(next = {}) {
        let matrixChanged = false;
        let textureChanged = false;

        for (const key of Object.keys(next)) {
            if (key === "url" && next.url !== this.props.url) textureChanged = true;
            if ([
                "x","y","z",
                "scaleX","scaleY","scaleZ",
                "rotate","rotateX","rotateY","rotateZ",
                "width","height"
            ].includes(key)) matrixChanged = true;

            this.props[key] = next[key];
        }

        if (textureChanged) this._updateTexture();
        if (matrixChanged) this.updateMatrix();

        this.updateBounds();

        this.force.props = true;
    }

    // ====================== TEXTURE / MATERIAL Helpers ======================
    _setTexture(slot, textureInstance) {
        // assign texture instance to entity slot
        this.textures.set(slot, textureInstance);

        // if entity has a material and slot exists on material, sync
        if (this.material && slot in this.material) {
            this.material[slot] = textureInstance;
        }
    }

    /**
     * Update a single slot texture from url (keeps material sync).
     */
    async updateTexture(slot = "diffuse", url = null) {
        let tex = this.textures.get(slot);
        if (!tex) {
            // create new Texture instance for the slot
            tex = new Texture(this.ctx, slot, this.cache);
            tex.create();
            this.textures.set(slot, tex);
        }
        tex.ready = false;
        if (url) {
            // update props.url only for diffuse convenience - non-diffuse slots may have own urls in future
            if (slot === "diffuse") this.props.url = url;
        }
        await tex.update(bustUrl(url ?? this.props.url));
        tex.ready = true;
        this.force.texture = true;

        // material sync
        if (this.material && slot in this.material) {
            this.material[slot] = tex;
        }

        // after update, try to rebuild texture array automatically (safe attempt)
        if (this._autoArraySlots) {
            try { this.buildTextureArray(this._autoArraySlots); } catch(e){ /* ignore */ }
        }
    }

    // Build a texture composition array from entity texture slots.
    // slots: array of slot names in desired order, e.g. ['diffuse','normal','roughness']
    // options: { unit:0, wrapS, wrapT, minFilter, magFilter, premultiplyAlpha }
    // returns { texture, width, height, layers } on success (WebGL2) or null on failure
    buildTextureArray(slots = ['diffuse'], options = {}) {
        // cache requested slots for auto-rebuild on updates
        this._autoArraySlots = slots;

        // collect Texture instances that have payloads
        const texInstances = [];
        for (let s of slots) {
            const t = this.textures.get(s);
            if (!t) {
                // if missing, try to create default placeholder
                const placeholder = new Texture(this.ctx, s, this.cache);
                placeholder.create();
                placeholder.ready = true;
                placeholder._payload = null; // no payload -> will fail array creation and fallback will be used
                this.textures.set(s, placeholder);
                texInstances.push(placeholder);
            } else {
                texInstances.push(t);
            }
        }

        // if WebGL2 and all payloads present and same size -> build 2D array
        const gl = this.ctx;
        if (!(gl instanceof WebGL2RenderingContext)) {
            // can't build array; attach nothing but return null
            this.material.diffuseArray = null;
            return null;
        }

        const payloads = texInstances.map(t => t.getPayload());
        // all payload present?
        const allPresent = payloads.every(p => p !== null && p !== undefined);
        if (!allPresent) {
            // try later once all images loaded
            this.material.diffuseArray = null;
            return null;
        }

        // check sizes
        const width = payloads[0].width, height = payloads[0].height;
        const sameSize = payloads.every(p => p.width === width && p.height === height);
        if (!sameSize) {
            // resize each payload to common size (we'll pick first's size)
            const resized = payloads.map(p => {
                if (p.width === width && p.height === height) return p;
                // draw to canvas scaled
                const c = document.createElement('canvas');
                c.width = width; c.height = height;
                const cx = c.getContext('2d');
                cx.drawImage(p, 0, 0, width, height);
                return c;
            });
            // replace payloads with resized canvases
            for (let i = 0; i < texInstances.length; i++) texInstances[i]._payload = resized[i];
        }

        // now build texture array via Texture.buildArrayFromTextures
        const arr = Texture.buildArrayFromTextures(gl, texInstances, options);
        if (!arr) {
            this.material.diffuseArray = null;
            return null;
        }

        // attach to material for binding convenience
        this.material.diffuseArray = arr;
        return arr;
    }

    // internal update on texture changes (legacy)
    _updateTexture() {
        const tex = this.textures.get("diffuse");
        if (!tex) return;
        tex.ready = false;
        tex.update(bustUrl(this.props.url)).then(() => {
            tex.ready = true;
            if (this.material && 'diffuse' in this.material) this.material.diffuse = tex;
        });
        this.force.texture = true;
    }
    // =========================================================================
    // MATRIX
    // =========================================================================
    updateMatrix() {
        if (this.props.world === "2d") this._updateMatrix2D();
        else this._updateMatrix3D();
        this.force.matrix = false;
    }

    _updateMatrix2D() {
        const { x, y, scaleX, scaleY, rotate } = this.props;
        let mat = matrix2dAffineTo4x4({ a: scaleX, d: scaleY, x, y });

        if (rotate !== 0) {
            const r = deg2rad(rotate);
            const c = Math.cos(r);
            const s = Math.sin(r);
            const Rz = new Float32Array([
                c, s, 0, 0,
                -s, c, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);
            mat = matrixMultiply(Rz, mat, true);
        }

        this.props.matrix = mat;
    }

    _updateMatrix3D() {
        const { x, y, z, scaleX, scaleY, scaleZ, rotateX, rotateY, rotateZ } = this.props;

        let mat = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
        const S = new Float32Array([scaleX,0,0,0, 0,scaleY,0,0, 0,0,scaleZ,0, 0,0,0,1]);
        mat = matrixMultiply(mat, S, true);

        if (rotateX) {
            const r = deg2rad(rotateX), c = Math.cos(r), s = Math.sin(r);
            mat = matrixMultiply(mat, new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]), true);
        }
        if (rotateY) {
            const r = deg2rad(rotateY), c = Math.cos(r), s = Math.sin(r);
            mat = matrixMultiply(mat, new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]), true);
        }
        if (rotateZ) {
            const r = deg2rad(rotateZ), c = Math.cos(r), s = Math.sin(r);
            mat = matrixMultiply(mat, new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]), true);
        }

        this.props.matrix = mat;
    }

    // =========================================================================
    // BOUNDS
    // =========================================================================
    updateBounds() {
        this.bounds.w = this.props.width;
        this.bounds.h = this.props.height;
    }

    hitTest(x, y) {
        return this.collision.hitTest(x, y);
    }

    // =========================================================================
    // DRAW
    // =========================================================================
    draw() {
        if (this.props.hidden) return;
        const texObj = this.textures.get("diffuse");
        if (!texObj?.ready) return;

        const tex = texObj.texture;
        if (!tex) return;

        const { uOpacity, uBlendMode, uMatrix, uTex } = this.uniforms;
        if (!uOpacity || !uBlendMode || !uMatrix || !uTex) return;

        this.ctx.uniform1f(uOpacity, this.props.opacity);
        const blendId = this.blendLoader?.buildDispatcher?.()[this.props.blendMode] ?? 0;
        this.ctx.uniform1i(uBlendMode, blendId);

        this.ctx.uniformMatrix4fv(uMatrix, false, this.props.matrix);
        this.ctx.activeTexture(this.ctx.TEXTURE0);
        this.ctx.bindTexture(this.ctx.TEXTURE_2D, tex);
        this.ctx.uniform1i(uTex, 0);

        this.ctx.bindVertexArray(this.ctx.glVAO);
        this.ctx.drawArrays(this.ctx.TRIANGLES, 0, 6);
    }
}
