import { Output } from "@/models/canvas/core/output/model";

export class Renderer {
    constructor(engine) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this.canvas = engine.canvas;
        this.config = engine.config;
        this.scene = engine.session;
        this.msaaFBO = engine.msaaFBO;
        this.useDepth = this.config.useDepth;
        this.outputEngine = null;
        this.lastTime = performance.now();
    }

    // ============================================================
    // Render Entry Point
    // ============================================================
    render(preview = false) {
        if (!this.scene) return;

        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // Scene zuerst updaten
        this.scene.update(deltaTime);

        // Export Modi
        if (["bild", "video"].includes(this.config.mode)) {
            if (!this.outputEngine) {
                this.outputEngine = new Output(this, (progress, frame) => {
                    if (preview) this._renderPreview(frame, progress);
                });
            }
            this.outputEngine.start(preview);
            return;
        }

        // Standard Render
        this._renderWorldOrEditor();
    }

    // ============================================================
    // World / Editor Render
    // ============================================================
    _renderWorldOrEditor() {
        this.use();

        if (this.config.sampleFactor > 1 && this.msaaFBO) {
            this.ctx.bindFramebuffer(this.ctx.FRAMEBUFFER, this.msaaFBO);
            this._clear();
            this.scene.draw();

            this.ctx.bindFramebuffer(this.ctx.READ_FRAMEBUFFER, this.msaaFBO);
            this.ctx.bindFramebuffer(this.ctx.DRAW_FRAMEBUFFER, null);
            this.ctx.blitFramebuffer(
                0, 0, this.canvas.width, this.canvas.height,
                0, 0, this.canvas.width, this.canvas.height,
                this.ctx.COLOR_BUFFER_BIT,
                this.ctx.LINEAR
            );
            this.ctx.bindFramebuffer(this.ctx.FRAMEBUFFER, null);
        } else {
            this.ctx.bindFramebuffer(this.ctx.FRAMEBUFFER, null);
            this.ctx.viewport(0, 0, this.canvas.width, this.canvas.height);
            this._clear();
            this.scene.draw();
        }
    }

    // ============================================================
    // Preview (Export only, low cost)
    // ============================================================
    _renderPreview(frame, progress) {
        if (!frame) return;

        const scale = 0.25;
        const w = this.canvas.width * scale;
        const h = this.canvas.height * scale;

        this.ctx.clearColor(0, 0, 0, 1);
        this.ctx.clear(this.ctx.COLOR_BUFFER_BIT);

        this.ctx.drawImage(frame, 0, 0, w, h, 0, 0, this.canvas.width, this.canvas.height);
        console.log(`Export ${progress.toFixed(1)}%`);
    }

    // ============================================================
    // Clear
    // ============================================================
    _clear() {
        this.ctx.clearColor(0, 0, 0, this.config.alpha ? 0 : 1);
        this.ctx.clear(this.ctx.COLOR_BUFFER_BIT | (this.useDepth ? this.ctx.DEPTH_BUFFER_BIT : 0));
    }

    // ============================================================
    // Shader / VAO
    // ============================================================
    use() {
        this.ctx.useProgram(this.engine.program);
        this.ctx.bindVertexArray(this.engine.vao);
    }

    // ============================================================
    // Game Loop starten
    // ============================================================
    startLoop() {
        if (!this.config.loop) return;

        const tick = () => {
            if (!this.config.loop) return;

            this.render(false);

            requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    }
}
