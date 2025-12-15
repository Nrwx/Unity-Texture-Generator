import { isGLContext } from "@/models/canvas/core/utils/model";

/**
 * Draw background for 2D canvas or WebGL
 * @param {object} model - canvas model { ctx, canvas, webgl, background }
 */
export const  drawBackground = (model) => {
    try {
        if (!model?.ctx || !model?.canvas) return;

        const bgColor = model.background ?? "transparent";
        const size = 10;
        const w = model.matrix?.w ?? model.canvas.width | 0;
        const h = model.matrix?.h ?? model.canvas.height | 0;


        // ---------------------------------------------------------
        //  WEBGL MODE — fully isolated background rendering
        // ---------------------------------------------------------
        if (model.webgl) {

            // --- SIMPLE COLOR BACKGROUNDS ---
            if (bgColor !== "checker" && bgColor !== "grid") {
                if (bgColor === "transparent") {
                    model.ctx.clearColor(0, 0, 0, 0);
                } else {
                    const tmp = document.createElement("div");
                    tmp.style.color = bgColor;
                    document.body.appendChild(tmp);
                    const rgb = getComputedStyle(tmp).color.match(/\d+/g).map(Number);
                    document.body.removeChild(tmp);

                    model.ctx.clearColor(
                        (rgb[0] || 0) / 255,
                        (rgb[1] || 0) / 255,
                        (rgb[2] || 0) / 255,
                        1
                    );
                }
                model.ctx.clear(model.ctx.COLOR_BUFFER_BIT);
                return;
            }

            // --- CHECKER / GRID BACKGROUND ---
            const oldProgram = model.ctx.getParameter(model.ctx.CURRENT_PROGRAM);
            const oldVAO = model.ctx.getParameter(model.ctx.VERTEX_ARRAY_BINDING);

            if (!model.glBgProgram) {
                const bgVS = `
                    attribute vec2 a_pos;
                    void main() {
                        gl_Position = vec4(a_pos, 0.0, 1.0);
                    }
                `;

                const bgFS = `
                    precision highp float;
                    uniform vec2 u_res;
                    uniform int u_mode; // 0=checker,1=grid
                    void main() {
                        vec2 uv = gl_FragCoord.xy;
                        float size = 10.0;
                        float cx = floor(uv.x / size);
                        float cy = floor(uv.y / size);
                        float v = mod(cx + cy, 2.0);
                        if (u_mode == 0) {
                            gl_FragColor = (v < 0.5)
                                ? vec4(0.93, 0.93, 0.93, 1.0)
                                : vec4(0.80, 0.80, 0.80, 1.0);
                        } else {
                            gl_FragColor = (v < 0.5)
                                ? vec4(0.8, 0.8, 0.8, 0.15)
                                : vec4(0.0, 0.0, 0.0, 0.0);
                        }
                    }
                `;

                const compile = (type, source) => {
                    const s = model.ctx.createShader(type);
                    model.ctx.shaderSource(s, source);
                    model.ctx.compileShader(s);
                    if (!model.ctx.getShaderParameter(s, model.ctx.COMPILE_STATUS)) {
                        console.error("BG Shader compile error:", model.ctx.getShaderInfoLog(s));
                        model.ctx.deleteShader(s);
                        return null;
                    }
                    return s;
                };

                const vs = compile(model.ctx.VERTEX_SHADER, bgVS);
                const fs = compile(model.ctx.FRAGMENT_SHADER, bgFS);
                if (!vs || !fs) return;

                const prog = model.ctx.createProgram();
                model.ctx.attachShader(prog, vs);
                model.ctx.attachShader(prog, fs);
                model.ctx.linkProgram(prog);

                if (!model.ctx.getProgramParameter(prog, model.ctx.LINK_STATUS)) {
                    console.error("BG Program link error:", model.ctx.getProgramInfoLog(prog));
                    return;
                }

                model.glBgProgram = prog;
                model.glBg_res = model.ctx.getUniformLocation(prog, "u_res");
                model.glBg_mode = model.ctx.getUniformLocation(prog, "u_mode");

                // Fullscreen quad VAO + VBO
                const vao = model.ctx.createVertexArray();
                model.ctx.bindVertexArray(vao);

                const quad = new Float32Array([
                    -1, -1,  1, -1,  -1,  1,
                    -1,  1,  1, -1,   1,  1
                ]);

                const buf = model.ctx.createBuffer();
                model.ctx.bindBuffer(model.ctx.ARRAY_BUFFER, buf);
                model.ctx.bufferData(model.ctx.ARRAY_BUFFER, quad, model.ctx.STATIC_DRAW);

                const a_pos = model.ctx.getAttribLocation(prog, "a_pos");
                model.ctx.enableVertexAttribArray(a_pos);
                model.ctx.vertexAttribPointer(a_pos, 2, model.ctx.FLOAT, false, 0, 0);

                model.glBgVAO = vao;
                model.ctx.bindVertexArray(null);
            }

            // Draw background
            model.ctx.useProgram(model.glBgProgram);
            model.ctx.bindVertexArray(model.glBgVAO);

            model.ctx.enable(model.ctx.SCISSOR_TEST);
            model.ctx.scissor(
                Math.floor(model.matrix?.x),
                Math.floor(model.canvas.height - (model.matrix?.y + h)),
                Math.floor(w),
                Math.floor(h)
            );

            if (model.glBg_res) model.ctx.uniform2f(model.glBg_res, w, h);
            if (model.glBg_mode) model.ctx.uniform1i(
                model.glBg_mode,
                bgColor === "checker" ? 0 : 1
            );

            model.ctx.drawArrays(model.ctx.TRIANGLES, 0, 6);

            model.ctx.disable(model.ctx.SCISSOR_TEST);
            model.ctx.bindVertexArray(oldVAO);
            model.ctx.useProgram(oldProgram);


        } else if (!isGLContext(model.ctx)) {
            // -----------------------------
            // 2D CANVAS BACKGROUND
            // -----------------------------
            if (bgColor !== "transparent" && bgColor !== "checker" && bgColor !== "grid") {
                model.ctx.save();
                model.ctx.fillStyle = bgColor;
                model.ctx.fillRect(0, 0, w, h);
                model.ctx.restore();
            } else if (bgColor === "checker") {
                model.ctx.save();
                for (let y = 0; y < h; y += size) {
                    for (let x = 0; x < w; x += size) {
                        model.ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? "#eee" : "#ccc";
                        model.ctx.fillRect(x, y, size, size);
                    }
                }
                model.ctx.restore();
            } else if (bgColor === "grid") {
                model.ctx.save();
                model.ctx.fillStyle = "rgba(200,200,200,0.2)";
                for (let y = 0; y < h; y += size) {
                    for (let x = 0; x < w; x += size) {
                        if ((x / size + y / size) % 2 === 0) model.ctx.fillRect(x, y, size, size);
                    }
                }
                model.ctx.restore();
            }
        }
    } catch (e) {
        console.warn("Fehler beim Setzen des Hintergrunds;", e);
    }
};
