// ============================================================
// MeshLoader - Shader-Modul Loader für MeshSystem
// ============================================================
export class MeshLoader {
    /**
     * @param {FileCache} cache
     * @param {string} basePath
     */
    constructor(cache, basePath) {
        this.cache = cache;
        this.basePath = basePath.replace(/\/+$/, "") + "/shader/mesh/";
    }

    // ----------------------------
    // Einzeldatei laden
    // ----------------------------
    async loadFile(url) {
        if (!this.cache) throw new Error("MeshLoader: Kein Cache vorhanden.");
        return await this.cache.load(this.basePath + url);
    }

    // ----------------------------
    // Alle Modul-Dateien für MeshSystem laden
    // ----------------------------
    async loadModules() {
        const files = [
            "mesh.glsl",          // Basis Mesh-Logik (Instancing, ModelMatrix)
            "material.glsl",      // Materialberechnungen (diffuse, specular)
            "textureTransform.glsl", // UV-Transformationen / Animation
            "skeletal.glsl",      // Bone Transform / Skinning
            "lighting.glsl",      // Phong / PBR Lichtmodell
            "alphaMask.glsl",     // optional Masken/Alpha-Test
            "vertexColor.glsl"    // optional vertex colors
        ];

        const sources = await Promise.all(
            files.map(f => this.loadFile(f).catch(() => ""))
        );

        return sources.join("\n\n");
    }

    // ----------------------------
    // Modul für ProgramBuilder vorbereiten
    // ----------------------------
    async make() {
        const vertFile = `${this.basePath}vertex.glsl`;
        const fragFile = `${this.basePath}fragment.glsl`;

        const modules = await this.loadModules();

        return {
            vertFile,
            fragFile,
            prepend: modules
        };
    }
}
