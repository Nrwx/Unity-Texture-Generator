export class ShaderBuilder {
    constructor(gl, cache, basePath = "") {
        this.gl = gl;
        this.cache = cache;
        this.basePath = basePath.replace(/\/+$/, "") + "/shader/";
    }

    async loadFile(url) {
        if (!this.cache) throw new Error("ShaderBuilder: Kein Cache vorhanden.");
        return await this.cache.load(url);
    }

    async preprocess(src, basePath = this.basePath) {
        const includeRE = /#include\s+"(.+?)"/g;
        let out = src;
        let match;
        while ((match = includeRE.exec(src)) !== null) {
            const fileSrc = await this.loadFile(basePath + match[1]);
            const processed = await this.preprocess(fileSrc, basePath);
            out = out.replace(match[0], processed);
        }
        return out;
    }

    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error("Shader compilation failed:\n" + gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    createProgram(vsSource, fsSource) {
        const gl = this.gl;
        const vs = this.createShader(gl.VERTEX_SHADER, vsSource);
        const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource);

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error("Program linking failed:\n" + gl.getProgramInfoLog(program));
        }

        return program;
    }

    /**
     * Baut Shader-Programm aus Vertex + Fragment, optional Prepend
     */
    async buildProgram(vertexSrc, fragmentSrc, prepend = "") {
        const finalVS = await this.preprocess(vertexSrc);
        let finalFS = await this.preprocess(fragmentSrc);

        if (prepend) finalFS = prepend + "\n" + finalFS;

        return this.createProgram(finalVS, finalFS);
    }
}
