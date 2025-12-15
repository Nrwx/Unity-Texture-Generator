import { FileLoader } from "@/models/canvas/core/load/model";
import { FileCache } from "@/models/canvas/core/cache/model";
import { ShaderBuilder } from "@/models/canvas/core/shader/model";
import { BlendModeLoader } from "@/models/canvas/core/shader/blend/model";
import { Scene } from "@/models/canvas/core/scene/model";
import { Renderer } from "@/models/canvas/core/renderer/model";
import { EventHub } from "@/models/canvas/core/events/model";
import { ParticleSystem } from "@/models/canvas/core/particle/model";
import { ParticleLoader } from "@/models/canvas/core/shader/particle/model";
import { ProgramBuilder } from "@/models/canvas/core/program/model";
import { MeshLoader } from "@/models/canvas/core/shader/mesh/model";
import { MeshSystem } from "@/models/canvas/core/mesh/model";

const ENGINE = {
    modes: ["world", "editor", "video", "bild"]
}


export class CanvasEngine {

    constructor(model) {
        // ---------------------------
        // Model Payload
        // ---------------------------
        this.wrapper = model.wrapper;
        this.canvas = model.canvas;
        this.path = model.path;
        this.ctx = model.ctx;

        // ---------------------------
        // Empfohlene Standard-Konfiguration
        // ---------------------------
        this.config = {
            // ---------------------------
            // Engine States
            // ---------------------------
            active: false,      // Engine State
            register: false,    // Engine Register State

            // ---------------------------
            // Rendering Einstellungen World/Editor/Video/Bild
            // ---------------------------
            mode: 'world',      // Render Klassen Modus (world, video, bild, editor)
            world: '2d',        // Scene Mode (2d, 3d)
            webgl: false,       // WebGl Integrität

            camera : {
                position: { x: 0, y: 0, z: 1 },
                target: { x: 0, y: 0, z: 0 },
                zoom: 1,
                fov: 60,
                near: 0.1,
                far: 1000
            },

            loop: false,        // Game Loop

            frames: 0,          // Anzahl der Render Vorgänge
            quality: 70,        // Qualität der Einzelnen Frames
            startTime: 0,       // Video Start-Zeit
            emdTime: 100,       // Video Endzeit
            sampleFactor: 2,    // Supersampling für saubere Auflösung
            useDepth: true,     // Depth Buffer aktivieren
            alpha: true,        // Transparenz
            outputPath: null    // Render Output Pfad
        };


        // ---------------------------
        // Szenen-Konfiguration
        // ---------------------------
        this.session = null;
        this.scene = {
            base: model.base ?? [],
            layers: model.layers ?? [],
            viewport: model.viewport,
            tileSize: model.tileSize ?? 256,
            background: model.background ?? null
        };

        // ---------------------------
        // Scene Systeme
        // ---------------------------
        this.particle = null;
        this.mesh = null;

        // ---------------------------
        // Events
        // ---------------------------
        this.events = null;
        this.listener = [];

        // ---------------------------
        // Render Engine
        // ---------------------------
        this.renderer = null;

        // ---------------------------
        // Core Loader & Cache
        // ---------------------------
        this.loader = new FileLoader(this.path);
        this.cache  = new FileCache(this.loader);

        this.shaderBuilder = new ShaderBuilder(this.ctx, this.cache, this.path);
        this.programBuilder = new ProgramBuilder(this.ctx, this.shaderBuilder);
        this.blendLoader   = new BlendModeLoader(this.cache, this.path);
        this.meshLoader   = new MeshLoader(this.cache, this.path);
        this.particleLoader = new ParticleLoader(this.cache, this.path);

        // ---------------------------
        // Shader / VAO
        // ---------------------------
        this.program   = null;
        this.locations = {};
        this.vao = null;
        this.meshVAO = null;
        this.particleVAO = null;

        this.vbo = null;

        // ---------------------------
        // Anti-Aliasing / Supersampling
        // ---------------------------
        this.msaaFBO   = null;
        this.msaaColor = null;
        this.msaaDepth = null;
    }

    // ============================================================
    // Integrity Check – Constructor First, Rule Based
    // ============================================================
    _integrity() {
        if (!this.ctx) {
            throw new Error("[CanvasEngine] Kein Rendering Context übergeben.");
        }

        const isGL = this.ctx instanceof WebGLRenderingContext || this.ctx instanceof WebGL2RenderingContext;
        const is2D = this.ctx instanceof CanvasRenderingContext2D;

        this.webgl = isGL;

        if (!isGL && !is2D) {
            throw new Error("[CanvasEngine] Ungültiger Rendering Context.");
        }

        if (!ENGINE.modes.includes(this.config.mode)) {
            console.warn(
                `[CanvasEngine] Ungültiger mode "${this.config.mode}", fallback auf "world".`
            );
            this.config.mode = "world";
        }

        switch (this.config.mode) {
            case "bild":
                this.config.world = "2d";
                break;

            case "video":
                if (!isGL) {
                    throw new Error(
                        "[CanvasEngine] Video-Mode erfordert WebGL Context."
                    );
                }
                this.config.world ??= "2d";
                break;

            case "editor":
                this.config.world ??= "2d";
                if (this.config.world === "3d" && !isGL) {
                    console.warn(
                        "[CanvasEngine] Editor 3D ohne WebGL nicht möglich, fallback auf 2D."
                    );
                    this.config.world = "2d";
                }
                break;

            case "world":
            default:
                if (!isGL) {
                    throw new Error(
                        "[CanvasEngine] World-Mode erfordert WebGL Context."
                    );
                }
                this.config.world = "3d";
                break;
        }

        if (is2D) {
            this.config.world = "2d";
        }

    }



    // ============================================================
    // Initialisierung
    // ============================================================
    async init() {
        await this._integrity();
        await this._build();
        this._fetchLocations();
        this._setupQuadBuffer();
        this._setupVAO();
        this._setupAntiAliasing();
        this._resize();

        await this._start();

        this.renderer = new Renderer({
            ctx: this.ctx,
            canvas: this.canvas,
            program: this.program,
            vao: this.vao,
            msaaFBO: this.msaaFBO,
            scene: this.session,
            config: {
                mode: this.config.mode,
                useDepth: this.config.useDepth,
                sampleFactor: this.config.sampleFactor,
                alpha: this.config.alpha,
                loop: this.config.loop,

            }
        });

        return this;
    }

    // ============================================================
    // Event Register
    // ============================================================
    async _events(unregister = false) {

        // =============================
        // UNREGISTER
        // =============================
        if (unregister) {
            this.listener.forEach(h => this.events.unregister(h));
            this.listener.length = 0;
            return;
        }

        // =============================
        // REGISTER
        // =============================
        this.listener.push(this.events.register(this, "resize", e => this._resize(e.resize), 'all', 9999));
        if (this.session.orbit) {
            this.listener.push(this.events.register(this.session.orbit, "pointerdown", this.session.orbit.pointerdown, this.config.mode, 1000));
            this.listener.push(this.events.register(this.session.orbit, "pointermove", this.session.orbit.pointermove, this.config.mode, 1000));
            this.listener.push(this.events.register(this.session.orbit, "pointerup", this.session.orbit.pointerup, this.config.mode, 1000));
            this.listener.push(this.events.register(this.session.orbit, "wheel", this.session.orbit.wheel, this.config.mode, 1000));
        }
    }

    // ============================================================
    // Programm Build-Register
    // ============================================================
    async _build() {
        const blendModule    = await this.blendLoader.make();
        const meshModule = await this.meshLoader.make();
        const particleModule = await this.particleLoader.make();

        this.program = await this.programBuilder.build({
            modules: [blendModule, meshModule, particleModule],
            vertFile: await this.shaderBuilder.loadFile("shader/vertex.glsl"),
            fragFile: await this.shaderBuilder.loadFile("shader/fragment.glsl")
        });

        this.ctx.useProgram(this.program);
    }

    // ============================================================
    // Quad-Buffer erstellen
    // ============================================================
    _setupQuadBuffer() {
        if (!this.vbo) {
            const vertex = new Float32Array([
                -1,  1, 0, 0,
                1,  1, 1, 0,
                -1, -1, 0, 1,

                1,  1, 1, 0,
                1, -1, 1, 1,
                -1, -1, 0, 1
            ]);

            this.vbo = this.ctx.createBuffer();
            this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, this.vbo);
            this.ctx.bufferData(this.ctx.ARRAY_BUFFER, vertex, this.ctx.STATIC_DRAW);
        }
    }

    // ============================================================
    // Shader Locations holen (Partikel + Mesh getrennt)
    // ============================================================
    _fetchLocations() {
        this.locations = {
            // =====================================
            // DEFAULT
            // =====================================
            default: {
                aPos: this.ctx.getAttribLocation(this.program, "aPos"),
                aUV:  this.ctx.getAttribLocation(this.program, "aUV"),
            },

            // =====================================
            // PARTICLE
            // =====================================
            particle: {
                aPos:     this.ctx.getAttribLocation(this.program, "aPos"),
                aUV:      this.ctx.getAttribLocation(this.program, "aUV"),
                iPos:     this.ctx.getAttribLocation(this.program, "iPos"),
                iSize:    this.ctx.getAttribLocation(this.program, "iSize"),
                iColor:   this.ctx.getAttribLocation(this.program, "iColor"),
                iOpacity: this.ctx.getAttribLocation(this.program, "iOpacity"),
                iLife:    this.ctx.getAttribLocation(this.program, "iLife"),
            },

            // =====================================
            // MESH
            // =====================================
            mesh: {
                aPos: this.ctx.getAttribLocation(this.program, "aPos"),
                aUV:  this.ctx.getAttribLocation(this.program, "aUV"),
                aNormal: this.ctx.getAttribLocation(this.program, "aNormal"),
                aTangent: this.ctx.getAttribLocation(this.program, "aTangent"),

                iModelMatrix0: this.ctx.getAttribLocation(this.program, "iModelMatrix") + 0,
                iModelMatrix1: this.ctx.getAttribLocation(this.program, "iModelMatrix") + 1,
                iModelMatrix2: this.ctx.getAttribLocation(this.program, "iModelMatrix") + 2,
                iModelMatrix3: this.ctx.getAttribLocation(this.program, "iModelMatrix") + 3,

                iUVTransform: this.ctx.getAttribLocation(this.program, "iUVTransform"),
                iColor: this.ctx.getAttribLocation(this.program, "iColor"),
                iTexIndex: this.ctx.getAttribLocation(this.program, "iTexIndex"),

                aBoneWeights: this.ctx.getAttribLocation(this.program, "aBoneWeights"),
                aBoneIndices: this.ctx.getAttribLocation(this.program, "aBoneIndices"),
            },

            // =====================================
            // UNIFORMS
            // =====================================
            uniforms: {
                uViewProj: this.ctx.getUniformLocation(this.program, "uViewProj"),
                uBones: this.ctx.getUniformLocation(this.program, "uBones"),
                uDiffuse: this.ctx.getUniformLocation(this.program, "uDiffuse"),
                uNormal: this.ctx.getUniformLocation(this.program, "uNormal"),
                uSpecular: this.ctx.getUniformLocation(this.program, "uSpecular"),
                uRoughness: this.ctx.getUniformLocation(this.program, "uRoughness"),
                uMetallic: this.ctx.getUniformLocation(this.program, "uMetallic"),
                uAO: this.ctx.getUniformLocation(this.program, "uAmbientOcclusion"),
                uLight: this.ctx.getUniformLocation(this.program, "uLight"),
                uVertexColor: this.ctx.getUniformLocation(this.program, "uVertexColor"),
                uAlphaThreshold: this.ctx.getUniformLocation(this.program, "uAlphaThreshold"),
                uBlendMode: this.ctx.getUniformLocation(this.program, "uBlendMode"),
                uEntityMatrix: this.ctx.getUniformLocation(this.program, "uEntityMatrix"),
                uTex: this.ctx.getUniformLocation(this.program, "uTex"),
                uTime: this.ctx.getUniformLocation(this.program, "uTime"),
            }
        };
    }



    // ============================================================
    // VAO einrichten (default → particle → mesh ...)
    // ============================================================
    _setupVAO() {
        // =========================================================
        // DEFAULT VAO (ALTE REFERENZ – NUR QUAD)
        // =========================================================
        if (!this.vao) {
            this.vao = this.ctx.createVertexArray();
            this.ctx.bindVertexArray(this.vao);

            // Quad Buffer
            this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, this.vbo);

            this.ctx.enableVertexAttribArray(this.locations.default.aPos);
            this.ctx.vertexAttribPointer(
                this.locations.default.aPos,
                2, this.ctx.FLOAT, false, 16, 0
            );

            this.ctx.enableVertexAttribArray(this.locations.default.aUV);
            this.ctx.vertexAttribPointer(
                this.locations.default.aUV,
                2, this.ctx.FLOAT, false, 16, 8
            );

            this.ctx.bindVertexArray(null);
        }

        // =========================================================
        // PARTICLE VAO
        // =========================================================
        this.particleVAO = this.ctx.createVertexArray();
        this.ctx.bindVertexArray(this.particleVAO);

        // Quad Buffer
        this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, this.vbo);

        this.ctx.enableVertexAttribArray(this.locations.particle.aPos);
        this.ctx.vertexAttribPointer(
            this.locations.particle.aPos,
            2, this.ctx.FLOAT, false, 16, 0
        );

        this.ctx.enableVertexAttribArray(this.locations.particle.aUV);
        this.ctx.vertexAttribPointer(
            this.locations.particle.aUV,
            2, this.ctx.FLOAT, false, 16, 8
        );

        // Instanced Particle Buffer
        if (!this.instanceBuffer) {
            this.instanceBuffer = this.ctx.createBuffer();
        }
        this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, this.instanceBuffer);

        const particleStride = 10 * 4;

        this.ctx.enableVertexAttribArray(this.locations.particle.iPos);
        this.ctx.vertexAttribPointer(
            this.locations.particle.iPos,
            3, this.ctx.FLOAT, false, particleStride, 0
        );
        this.ctx.vertexAttribDivisor(this.locations.particle.iPos, 1);

        this.ctx.enableVertexAttribArray(this.locations.particle.iSize);
        this.ctx.vertexAttribPointer(
            this.locations.particle.iSize,
            1, this.ctx.FLOAT, false, particleStride, 12
        );
        this.ctx.vertexAttribDivisor(this.locations.particle.iSize, 1);

        this.ctx.enableVertexAttribArray(this.locations.particle.iColor);
        this.ctx.vertexAttribPointer(
            this.locations.particle.iColor,
            4, this.ctx.FLOAT, false, particleStride, 16
        );
        this.ctx.vertexAttribDivisor(this.locations.particle.iColor, 1);

        this.ctx.enableVertexAttribArray(this.locations.particle.iOpacity);
        this.ctx.vertexAttribPointer(
            this.locations.particle.iOpacity,
            1, this.ctx.FLOAT, false, particleStride, 32
        );
        this.ctx.vertexAttribDivisor(this.locations.particle.iOpacity, 1);

        this.ctx.enableVertexAttribArray(this.locations.particle.iLife);
        this.ctx.vertexAttribPointer(
            this.locations.particle.iLife,
            1, this.ctx.FLOAT, false, particleStride, 36
        );
        this.ctx.vertexAttribDivisor(this.locations.particle.iLife, 1);

        this.ctx.bindVertexArray(null);

        // =========================================================
        // MESH VAO (INSTANCING + SKINNING)
        // =========================================================
        this.meshVAO = this.ctx.createVertexArray();

        if (!this.meshVBO) {
            this.meshVBO = this.ctx.createBuffer();
        }

        this.ctx.bindVertexArray(this.meshVAO);
        this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, this.meshVBO);

        // Vertex Attributes (interleaved: pos(3), normal(3), uv(2), tangent(4) = 12 floats = 48 bytes)
        const stride = 12 * 4;

        this.ctx.enableVertexAttribArray(this.locations.mesh.aPos);
        this.ctx.vertexAttribPointer(this.locations.mesh.aPos, 3, this.ctx.FLOAT, false, stride, 0);

        this.ctx.enableVertexAttribArray(this.locations.mesh.aNormal);
        this.ctx.vertexAttribPointer(this.locations.mesh.aNormal, 3, this.ctx.FLOAT, false, stride, 3 * 4);

        this.ctx.enableVertexAttribArray(this.locations.mesh.aUV);
        this.ctx.vertexAttribPointer(this.locations.mesh.aUV, 2, this.ctx.FLOAT, false, stride, 6 * 4);

        this.ctx.enableVertexAttribArray(this.locations.mesh.aTangent);
        this.ctx.vertexAttribPointer(this.locations.mesh.aTangent, 4, this.ctx.FLOAT, false, stride, 8 * 4);

        // Instanced attributes
        const modelMatrixStride = 16 * 4; // mat4 = 16 floats
        for (let i = 0; i < 4; i++) {
            const loc = this.locations.mesh[`iModelMatrix${i}`];
            this.ctx.enableVertexAttribArray(loc);
            this.ctx.vertexAttribPointer(loc, 4, this.ctx.FLOAT, false, modelMatrixStride, i * 16);
            this.ctx.vertexAttribDivisor(loc, 1);
        }

        // iUVTransform (vec4)
        this.ctx.enableVertexAttribArray(this.locations.mesh.iUVTransform);
        this.ctx.vertexAttribPointer(this.locations.mesh.iUVTransform, 4, this.ctx.FLOAT, false, 0, 0);
        this.ctx.vertexAttribDivisor(this.locations.mesh.iUVTransform, 1);

        // iColor (vec4)
        this.ctx.enableVertexAttribArray(this.locations.mesh.iColor);
        this.ctx.vertexAttribPointer(this.locations.mesh.iColor, 4, this.ctx.FLOAT, false, 0, 0);
        this.ctx.vertexAttribDivisor(this.locations.mesh.iColor, 1);

        // iTexIndex (float)
        this.ctx.enableVertexAttribArray(this.locations.mesh.iTexIndex);
        this.ctx.vertexAttribPointer(this.locations.mesh.iTexIndex, 1, this.ctx.FLOAT, false, 0, 0);
        this.ctx.vertexAttribDivisor(this.locations.mesh.iTexIndex, 1);

        // Skeletal
        this.ctx.enableVertexAttribArray(this.locations.mesh.aBoneWeights);
        this.ctx.vertexAttribPointer(this.locations.mesh.aBoneWeights, 4, this.ctx.FLOAT, false, 0, 0);

        this.ctx.enableVertexAttribArray(this.locations.mesh.aBoneIndices);
        this.ctx.vertexAttribIPointer(this.locations.mesh.aBoneIndices, 4, this.ctx.INT, 0, 0);

        this.ctx.bindVertexArray(null);
    }



    // ============================================================
    // Anti-Aliasing / Supersampling Setup
    // ============================================================
    _setupAntiAliasing() {
        if (this.config.sampleFactor <= 1) return;

        const width  = this.canvas.width * this.config.sampleFactor;
        const height = this.canvas.height * this.config.sampleFactor;

        if (this.msaaFBO) {
            this.ctx.deleteFramebuffer(this.msaaFBO);
            this.ctx.deleteRenderbuffer(this.msaaColor);
            if (this.msaaDepth) this.ctx.deleteRenderbuffer(this.msaaDepth);
        }

        this.msaaFBO = this.ctx.createFramebuffer();
        this.ctx.bindFramebuffer(this.ctx.FRAMEBUFFER, this.msaaFBO);

        this.msaaColor = this.ctx.createRenderbuffer();
        this.ctx.bindRenderbuffer(this.ctx.RENDERBUFFER, this.msaaColor);
        this.ctx.renderbufferStorageMultisample(this.ctx.RENDERBUFFER, 4, this.ctx.RGBA8, width, height);
        this.ctx.framebufferRenderbuffer(this.ctx.FRAMEBUFFER, this.ctx.COLOR_ATTACHMENT0, this.ctx.RENDERBUFFER, this.msaaColor);

        if (this.config.useDepth) {
            this.msaaDepth = this.ctx.createRenderbuffer();
            this.ctx.bindRenderbuffer(this.ctx.RENDERBUFFER, this.msaaDepth);
            this.ctx.renderbufferStorageMultisample(this.ctx.RENDERBUFFER, 4, this.ctx.DEPTH_COMPONENT24, width, height);
            this.ctx.framebufferRenderbuffer(this.ctx.FRAMEBUFFER, this.ctx.DEPTH_ATTACHMENT, this.ctx.RENDERBUFFER, this.msaaDepth);
        }

        this.ctx.bindFramebuffer(this.ctx.FRAMEBUFFER, null);
    }

// ============================================================
// Engine starten / erstellen
// ============================================================
    async _start() {
        // ---------------------------
        // Particle System initialisieren
        // ---------------------------
        this.particle = new ParticleSystem({
            ctx: this.ctx,
            vao: this.particleVAO,
            program: this.program,
            uniforms: {
                uViewProj:  this.locations.uniforms.uViewProj,
                uEntityMatrix: this.locations.uniforms.uEntityMatrix,
                uTex:      this.locations.uniforms.uTex
            },
            world: this.config.world,
            webgl: this.webgl
        }).init();

        // ---------------------------
        // Mesh System initialisieren
        // ---------------------------
        this.mesh = new MeshSystem({
            ctx: this.ctx,
            vao: this.meshVAO,
            program: this.program,
            locations: this.locations,
            world: this.config.world,
            webgl: this.webgl
        }).init();

        // ---------------------------
        // Scene initialisieren
        // ---------------------------
        this.session = new Scene({
            ctx: this.ctx,
            cache: this.cache,
            program: this.program,
            camera: this.config.camera,
            blendLoader: this.blendLoader,
            mesh: this.mesh,
            base: this.scene.base,
            layers: this.scene.layers,
            viewport: this.scene.viewport,
            tileSize: this.scene.tileSize,
            background: this.scene.background,
            mode: this.config.mode,
            world: this.config.world
        });

        this.session.init();

        // =============================
        // Event Hub initialisieren
        // =============================
        this.events = new EventHub({
            canvas: this.canvas,
            scene: this.session,
            camera: this.session.camera,
            mode: this.config.mode
        });

        // Events registrieren (resize, orbit)
        await this._events(false);
    }


    // ============================================================
    // Engine aktualisieren
    // ============================================================
    async _update(model) {
        if (!this.session) return;

        // update only changed parts
        Object.assign(this.scene, model);

        await this._start();
    }

    // ============================================================
    // Engine herunterfahren Scene / World schließen
    // ============================================================
    async _shutdown() {
        if (!this.session) return;
        await this._events(true);
        this.scene = null;
    }


    // ============================================================
    // Auto-Resize Canvas & Viewport
    // ============================================================
    _resize(size = null) {
        const width  = size?.width  ?? this.canvas.clientWidth;
        const height = size?.height ?? this.canvas.clientHeight;

        this.canvas.width  = width * this.config.sampleFactor;
        this.canvas.height = height * this.config.sampleFactor;

        this.ctx.viewport(0, 0, this.canvas.width, this.canvas.height);

        this._setupAntiAliasing();

        if (this.renderer) {
            this.renderer.msaaFBO = this.msaaFBO;
        }
    }

    // ============================================================
    // Engine aktivieren
    // ============================================================
    use() {
        this.ctx.useProgram(this.program);
        this.ctx.bindVertexArray(this.vao);
    }

    // ============================================================
    // Render-Pass mit MSAA / Supersampling
    // ============================================================
    render(preview = false) {
        if (!this.renderer) return;
        this.renderer.render(preview);
    }
}
