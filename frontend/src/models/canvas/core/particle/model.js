import { InstanceBuffer } from "@/models/canvas/core/particle/instance/model";

export class ParticleSystem {
    constructor({ ctx, vao, program, uniforms, world, webgl }) {
        this.ctx = ctx;
        this.vao = vao;             // particleVAO
        this.program = program;
        this.uniforms = uniforms;   // uniforms aus CanvasEngine
        this.world = world;
        this.webgl = webgl;

        this.particles = [];
        this.emitters = [];
        this.batch = new InstanceBuffer(ctx, 20000);

        this.lastTime = performance.now();
        this.time = 0;
    }

    init() {
        if (!this.program) throw new Error("[ParticleSystem] Kein Shader-Programm.");
        if (!this.uniforms) throw new Error("[ParticleSystem] Uniforms fehlen.");
        return this;
    }

    addEmitter(emitter) {
        emitter.system = this;
        emitter.world = this.world;
        emitter.webgl = this.webgl;
        this.emitters.push(emitter);
        return emitter;
    }

    update() {
        const now = performance.now();
        const dt = (now - this.lastTime) * 0.001;
        this.lastTime = now;
        this.time += dt;

        this.batch.reset();

        for (const e of this.emitters) e.spawn(dt, this.particles);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(dt);
            if (!p.alive) this.particles.splice(i, 1);
            else this.batch.push(p);
        }

        this.batch.upload();
    }

    draw(viewProjMatrix) {
        if (!this.program || this.batch.count === 0) return;

        const gl = this.ctx;
        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);

        gl.enable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);

        // Uniforms
        gl.uniformMatrix4fv(this.uniforms.uViewProj, false, viewProjMatrix);
        gl.uniformMatrix4fv(this.uniforms.uEntityMatrix, false, this.emitters[0]?.entity?.props.matrix);

        // Texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.emitters[0]?.entity?.textures?.get("diffuse")?.texture ?? null);
        gl.uniform1i(this.uniforms.uTex, 0);

        // Draw Instanced (6 Vertices für Quad)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.batch.count);

        gl.bindVertexArray(null);
    }
}
