export class ProgramBuilder {
    /**
     * @param {WebGL2RenderingContext | WebGLRenderingContext} ctx
     * @param {ShaderBuilder} shaderBuilder
     */
    constructor(ctx, shaderBuilder) {
        this.ctx = ctx;
        this.shaderBuilder = shaderBuilder;
        this.modules = new Map();
        this.activeProgram = null;
        this.composedProgram = null;
    }

    // =============================
    // Modul registrieren
    // =============================
    register(name, { vertFile, fragFile, prepend = "" }) {
        if (this.modules.has(name)) {
            console.warn(`[ProgramBuilder] Modul "${name}" existiert bereits.`);
            return;
        }
        this.modules.set(name, { vertFile, fragFile, prepend });
    }

    get(name) {
        return this.modules.get(name) ?? Array.from(this.modules.values());
    }

    // =============================
    // Finales Shaderprogramm bauen (composition)
    // =============================
    async build(name = "composedProgram") {
        if (this.composedProgram) return this.composedProgram;

        if (this.modules.size === 0) {
            throw new Error("[ProgramBuilder] Keine Module registriert.");
        }

        // Alle Module zusammenfügen
        let finalVert = "";
        let finalFrag = "";

        for (const mod of this.modules.values()) {
            // Vertex-Shader: falls vorhanden, einfach anhängen
            if (mod.vertFile) {
                const vertSrc = await this.shaderBuilder.loadFile(mod.vertFile);
                const vertPreprocessed = await this.shaderBuilder.preprocess(vertSrc);
                finalVert += vertPreprocessed + "\n";
            }

            // Fragment-Shader
            if (mod.fragFile) {
                const fragSrc = await this.shaderBuilder.loadFile(mod.fragFile);
                const fragPreprocessed = await this.shaderBuilder.preprocess(fragSrc);
                finalFrag += (mod.prepend ? mod.prepend + "\n" : "") + fragPreprocessed + "\n";
            }
        }

        this.composedProgram = this.shaderBuilder.createProgram(finalVert, finalFrag);
        return this.composedProgram;
    }

    // =============================
    // Programm aktivieren
    // =============================
    use() {
        if (!this.composedProgram) throw new Error("[ProgramBuilder] Kein Programm gebaut.");
        if (this.activeProgram !== this.composedProgram) {
            this.ctx.useProgram(this.composedProgram);
            this.activeProgram = this.composedProgram;
        }
    }

    // =============================
    // Reset / Clear
    // =============================
    clear() {
        if (this.composedProgram) {
            this.ctx.deleteProgram(this.composedProgram);
            this.composedProgram = null;
        }
        this.activeProgram = null;
        this.modules.clear();
    }
}
