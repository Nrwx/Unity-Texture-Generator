export class ParticleLoader {

    /**
     * @param {FileCache} cache
     * @param {string} basePath
     */
    constructor(cache, basePath) {
        this.cache = cache;
        this.basePath = basePath.replace(/\/+$/, "") + "/shader/particle/";
    }

    // =============================
    // Datei laden über Cache
    // =============================
    async loadFile(url) {
        if (!this.cache) throw new Error("ParticleLoader: Kein Cache vorhanden.");
        return await this.cache.load(this.basePath + 'mode/' + url);
    }

    // =============================
    // Particle-Modus-Dateien laden
    // =============================
    async loadModes() {
        const files = [
            "particle.glsl",    // Basis-Particle-Logik
            "forces.glsl",      // Kräfte wie Wind, Schwerkraft
            "emitter.glsl",     // Partikel-Emitter
            "rotation.glsl",    // Rotation pro Partikel
            "gravity.glsl",     // Gravitation
            "sizeFade.glsl",    // Größen-Fading
            "colorFade.glsl",    // Farb-Fading
            "velocityDecay.glsl",
            "turbulence.glsl.glsl",
            "attractor.glsl",
            "alphaFade.glsl",
            "velocityRotation.glsl",
            "sizeOscillation.glsl"
        ];

        const sources = await Promise.all(
            files.map(f => this.loadFile(f).catch(() => ""))
        );

        return sources.join("\n\n");
    }

    // =============================
    // Modul für ProgramBuilder vorbereiten
    // =============================
    async make() {
        const vertFile = `${this.basePath}vertex.glsl`;
        const fragFile = `${this.basePath}fragment.glsl`;

        const modes = await this.loadModes();

        return {
            vertFile,
            fragFile,
            prepend: modes
        };
    }
}