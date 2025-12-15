export class BlendModeLoader {

    /**
     * @param {FileCache} cache
     * @param {string} basePath
     */
    constructor(cache, basePath) {
        this.cache = cache;
        this.basePath = basePath.replace(/\/+$/, "") + "/shader/blend/";
    }

    // =============================
    // Datei laden über Cache
    // =============================
    async loadFile(url) {
        if (!this.cache) throw new Error("BlendModeLoader: Kein Cache vorhanden.");
        return await this.cache.load(this.basePath + "mode/" + url);
    }

    // =============================
    // Blend-Funktionen laden
    // =============================
    async loadModes() {
        const files = [
            "normal.glsl",
            "multiply.glsl",
            "overlay.glsl",
            "softlight.glsl",
            "hardlight.glsl",
            "color_dodge.glsl",
            "color_burn.glsl",
            "linear_burn.glsl",
            "linear_dodge.glsl",
            "vivid_light.glsl",
            "linear_light.glsl",
            "difference.glsl",
            "divide.glsl",
            "subtract.glsl",
            "hue.glsl",
            "saturation.glsl",
            "color.glsl",
            "luminosity.glsl"
        ];

        const sources = await Promise.all(
            files.map(f => this.loadFile(f))
        );

        return sources.join("\n\n");
    }

    // =============================
    // Dispatcher generieren
    // =============================
    buildDispatcher() {
        return /* glsl */`
vec4 blendMode(vec4 base, vec4 blend, int mode) {
    vec3 b = base.rgb;
    vec3 s = blend.rgb;
    vec3 r;
    switch(mode) {
        case 0: r=blendNormal(b,s); break;
        case 1: r=blendMultiply(b,s); break;
        case 2: r=blendOverlay(b,s); break;
        case 3: r=blendSoftLight(b,s); break;
        case 4: r=blendHardLight(b,s); break;
        case 5: r=blendColorDodge(b,s); break;
        case 6: r=blendColorBurn(b,s); break;
        case 7: r=blendLinearBurn(b,s); break;
        case 8: r=blendLinearDodge(b,s); break;
        case 9: r=blendVividLight(b,s); break;
        case 10: r=blendLinearLight(b,s); break;
        case 11: r=blendDifference(b,s); break;
        case 12: r=blendDivide(b,s); break;
        case 13: r=blendSubtract(b,s); break;
        case 14: r=setHue(b,s); break;
        case 15: r=setSaturation(b,s); break;
        case 16: r=setColor(b,s); break;
        case 17: r=setLuminosity(b,s); break;
    }
    float a = blend.a + base.a*(1.0-blend.a);
    r = (r*blend.a + b*base.a*(1.0-blend.a))/max(a,0.00001);
    return vec4(r,a);
}
`;
    }

    // =============================
    // Modul für ProgramBuilder vorbereiten
    // =============================
    async make() {
        const vertFile = `${this.basePath}vertex.glsl`;
        const fragCoreFile = `${this.basePath}fragment.glsl`;

        const blendFuncs = await this.loadModes();
        const dispatcher = this.buildDispatcher();
        const prepend = `${blendFuncs}\n${dispatcher}`;

        return { vertFile, fragFile: fragCoreFile, prepend };
    }
}
