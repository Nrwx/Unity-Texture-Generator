import { AnimationSystem } from "@/models/canvas/core/animation/model";
import { MeshInstanceBuffer } from "@/models/canvas/core/mesh/instance/model";
import { MeshFactory } from "@/models/canvas/core/mesh/build/model";
import { extractScaleFromMat4, invertMatrix4 } from "@/utils/matrix";


/**
 * MeshSystem
 * - ctx: WebGL context
 * - program: shader program
 * - vao: parent meshVAO (optional; system will re-bind attributes to it)
 * - locations: optional locations object from engine (preferred)
 * - uniforms: optional uniforms object from engine
 */
export class MeshSystem {
    constructor({ ctx, program, vao = null, locations = null, uniforms = null, world = "3d", webgl = true, maxInstances = 20000 }) {
        this.gl = ctx;
        this.program = program;
        this.vao = vao;
        this.locations = locations;
        this.uniforms = uniforms;
        this.world = world;
        this.webgl = webgl;

        this.meshVBO = null;
        this.meshEBO = null;

        this.animation = new AnimationSystem();
        this.meshes = [];
        this.instanceBuffer = new MeshInstanceBuffer(this.gl, maxInstances);

        this.lastTime = performance.now();
        this.time = 0;
    }

    init() {
        if (!this.program) throw new Error("[MeshSystem] Kein Shader-Programm.");
        if (!this.locations) this._fetchLocationsFromProgram();
        if (!this.uniforms && this.locations) this.uniforms = this.locations.uniforms;
        if (!this.meshVBO) this.meshVBO = this.gl.createBuffer();
        if (!this.meshEBO) this.meshEBO = this.gl.createBuffer();
        return this;
    }

    _fetchLocationsFromProgram() {
        const gl = this.gl;
        const p = this.program;
        this.locations = {
            mesh: {
                aPos: gl.getAttribLocation(p, "aPos"),
                aUV: gl.getAttribLocation(p, "aUV"),
                aNormal: gl.getAttribLocation(p, "aNormal"),
                aTangent: gl.getAttribLocation(p, "aTangent"),
                iModelMatrix0: gl.getAttribLocation(p, "iModelMatrix") + 0,
                iModelMatrix1: gl.getAttribLocation(p, "iModelMatrix") + 1,
                iModelMatrix2: gl.getAttribLocation(p, "iModelMatrix") + 2,
                iModelMatrix3: gl.getAttribLocation(p, "iModelMatrix") + 3,
                iUVTransform: gl.getAttribLocation(p, "iUVTransform"),
                iTexIndex: gl.getAttribLocation(p, "iTexIndex"),
                iColor: gl.getAttribLocation(p, "iColor")
            },
            uniforms: {
                uViewProj: gl.getUniformLocation(p, "uViewProj"),
                uBones: gl.getUniformLocation(p, "uBones"),
                uDiffuse: gl.getUniformLocation(p, "uDiffuse"),
                uNormal: gl.getUniformLocation(p, "uNormal"),
                uSpecular: gl.getUniformLocation(p, "uSpecular"),
                uRoughness: gl.getUniformLocation(p, "uRoughness"),
                uMetallic: gl.getUniformLocation(p, "uMetallic"),
                uAO: gl.getUniformLocation(p, "uAmbientOcclusion"),
                uLight: gl.getUniformLocation(p, "uLight"),
                uVertexColor: gl.getUniformLocation(p, "uVertexColor"),
                uAlphaThreshold: gl.getUniformLocation(p, "uAlphaThreshold"),
                uBlendMode: gl.getUniformLocation(p, "uBlendMode"),
                uEntityMatrix: gl.getUniformLocation(p, "uEntityMatrix"),
                uTex: gl.getUniformLocation(p, "uTex"),
                uTime: gl.getUniformLocation(p, "uTime")
            }
        };
        this.uniforms = this.locations.uniforms;
    }

    addMesh(meshOrOpts) {
        let mesh;
        if (meshOrOpts.entity) {
            mesh = meshOrOpts;
        } else if (meshOrOpts.model) {
            mesh = MeshFactory.create(meshOrOpts);
        } else {
            throw new Error("MeshSystem.addMesh: Entweder 'entity' oder 'model' muss angegeben werden.");
        }

        mesh.system = this;
        mesh.world = this.world;
        mesh.webgl = this.webgl;

        // Animation für Mesh initialisieren, falls vorhanden
        if (mesh.entity.hasAnimation) {
            const animInstance = this.animation.add(mesh.entity, mesh.entity.animations);
            mesh.animationInstanceId = mesh.entity.id; // ID zur Animation verknüpfen
        }

        this.meshes.push(mesh);
        return mesh;
    }

    removeMeshById(meshId) {
        this.meshes = this.meshes.filter(m => m.entity.id !== meshId);
    }

    update(dt) {
        const now = performance.now();
        dt = (now - this.lastTime) * 0.001;
        this.lastTime = now;
        this.time += dt;

        // Update aller Meshes
        for (let i = this.meshes.length - 1; i >= 0; i--) {
            const mesh = this.meshes[i];
            if (!mesh.entity.active) {
                this.meshes.splice(i, 1);
                continue;
            }

            // Animation updaten
            if (mesh.animationInstanceId) {
                const animInst = this.animation.getInstance(mesh.animationInstanceId);
                if (animInst) animInst.update(dt);
            }

            mesh.update(dt);
        }
    }

    /**
     * Upload Geometry (positions, normals, uvs, tangents, indices) to GPU
     */
    _uploadGeometry(geometry) {
        const gl = this.gl;

        const verts = geometry.vertices || new Float32Array();
        const uvs = geometry.uvs || new Float32Array();
        const normals = geometry.normals || new Float32Array();
        const tangents = geometry.tangents || null;
        const indices = geometry.indices || null;

        const vertexCount = verts.length / 3;
        const hasTangents = tangents && tangents.length === vertexCount * 4;
        const strideFloats = hasTangents ? 12 : 8; // pos+uv+normal[+tangent]
        const interleaved = new Float32Array(vertexCount * strideFloats);

        for (let i = 0; i < vertexCount; i++) {
            const ip = i * 3;
            const iu = i * 2;
            const io = i * strideFloats;

            interleaved[io + 0] = verts[ip + 0];
            interleaved[io + 1] = verts[ip + 1];
            interleaved[io + 2] = verts[ip + 2];

            interleaved[io + 3] = uvs[iu + 0] ?? 0;
            interleaved[io + 4] = uvs[iu + 1] ?? 0;

            interleaved[io + 5] = normals[ip + 0] ?? 0;
            interleaved[io + 6] = normals[ip + 1] ?? 0;
            interleaved[io + 7] = normals[ip + 2] ?? 1;

            if (hasTangents) {
                const it = i * 4;
                interleaved[io + 8]  = tangents[it + 0];
                interleaved[io + 9]  = tangents[it + 1];
                interleaved[io + 10] = tangents[it + 2];
                interleaved[io + 11] = tangents[it + 3];
            }
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVBO);
        gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);

        // indices
        let indexCount = 0;
        let indexType = null;
        if (indices && indices.length) {
            const idxBuf = (indices instanceof Uint32Array || Math.max(...indices) > 65535)
                ? new Uint32Array(indices)
                : new Uint16Array(indices);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshEBO);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxBuf, gl.STATIC_DRAW);
            indexCount = idxBuf.length;
            indexType = idxBuf instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
        } else {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }

        // VAO attributes
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVBO);

        const locs = this.locations?.mesh ?? {};
        const strideBytes = strideFloats * 4;

        if (typeof locs.aPos === "number" && locs.aPos >= 0) {
            gl.enableVertexAttribArray(locs.aPos);
            gl.vertexAttribPointer(locs.aPos, 3, gl.FLOAT, false, strideBytes, 0);
        }
        if (typeof locs.aUV === "number" && locs.aUV >= 0) {
            gl.enableVertexAttribArray(locs.aUV);
            gl.vertexAttribPointer(locs.aUV, 2, gl.FLOAT, false, strideBytes, 3 * 4);
        }
        if (typeof locs.aNormal === "number" && locs.aNormal >= 0) {
            gl.enableVertexAttribArray(locs.aNormal);
            gl.vertexAttribPointer(locs.aNormal, 3, gl.FLOAT, false, strideBytes, 5 * 4);
        }
        if (hasTangents && typeof locs.aTangent === "number" && locs.aTangent >= 0) {
            gl.enableVertexAttribArray(locs.aTangent);
            gl.vertexAttribPointer(locs.aTangent, 4, gl.FLOAT, false, strideBytes, 8 * 4);
        }

        gl.bindVertexArray(null);
        return { vertexCount, indexCount, indexType };
    }

    _makeGroups() {
        const groups = new Map();
        for (const mesh of this.meshes) {
            if (!mesh.entity.active) continue;
            const geom = mesh.entity.props.geometry;
            const mat = mesh.material || {};
            const diffTex = mat.diffuse?.texture ?? (mesh.entity.textures?.get("diffuse")?.texture ?? null);
            const flags = geom?.settings ?? {};
            const key = JSON.stringify({
                geomId: geom,
                texId: diffTex,
                doubleSided: !!flags.doubleSided,
                cullFace: flags.cullFace ?? "back",
                depthTest: flags.depthTest ?? true
            });
            if (!groups.has(key)) groups.set(key, { meshes: [], geom });
            groups.get(key).meshes.push(mesh);
        }
        return Array.from(groups.values());
    }

    draw(viewProjMatrix, viewMatrix = null) {
        const gl = this.gl;
        if (!this.program || !this.meshes || this.meshes.length === 0) return;

        gl.useProgram(this.program);
        if (this.uniforms?.uViewProj) gl.uniformMatrix4fv(this.uniforms.uViewProj, false, viewProjMatrix);

        const groups = this._makeGroups();

        for (const grp of groups) {
            const meshes = grp.meshes;
            if (!meshes.length) continue;

            const repGeom = grp.geom;
            const repMesh = meshes[0];
            const flags = repGeom?.settings ?? {};

            if (flags.depthTest === false) gl.disable(gl.DEPTH_TEST); else gl.enable(gl.DEPTH_TEST);
            if (flags.doubleSided) gl.disable(gl.CULL_FACE);
            else {
                if (flags.cullFace === "none") gl.disable(gl.CULL_FACE);
                else { gl.enable(gl.CULL_FACE); gl.cullFace(flags.cullFace === "front" ? gl.FRONT : gl.BACK); }
            }

            const { vertexCount, indexCount, indexType } = this._uploadGeometry(repGeom);

            const locsForBind = { ...this.uniforms };
            if (!locsForBind.uDiffuse && locsForBind.uTex) locsForBind.uDiffuse = locsForBind.uTex;

            const material = repMesh.material ?? repMesh.entity.material;
            if (material && typeof material.bind === "function") material.bind(gl, locsForBind);
            else if (locsForBind.uDiffuse) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, null);
                gl.uniform1i(locsForBind.uDiffuse, 0);
            }

            this.instanceBuffer.reset();

            for (const mesh of meshes) {
                // --- Animation-Binding vor Matrix-Berechnung ---
                if (mesh.animationInstanceId) {
                    const animInst = this.animation.getInstance(mesh.animationInstanceId);
                    if (animInst) animInst.bindToShader(gl, this.uniforms);
                }

                const mat = this._computeModelMatrixForMesh(mesh, viewMatrix);
                this.instanceBuffer.pushMatrix(mat);
            }

            this.instanceBuffer.upload();

            gl.bindVertexArray(this.vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer.buffer);

            const lm = this.locations?.mesh;
            const locM0 = lm?.iModelMatrix0 ?? -1;
            const locM1 = lm?.iModelMatrix1 ?? -1;
            const locM2 = lm?.iModelMatrix2 ?? -1;
            const locM3 = lm?.iModelMatrix3 ?? -1;
            const matStride = 16 * 4;

            if (locM0 >= 0) { gl.enableVertexAttribArray(locM0); gl.vertexAttribPointer(locM0, 4, gl.FLOAT, false, matStride, 0); gl.vertexAttribDivisor(locM0, 1); }
            if (locM1 >= 0) { gl.enableVertexAttribArray(locM1); gl.vertexAttribPointer(locM1, 4, gl.FLOAT, false, matStride, 4*4); gl.vertexAttribDivisor(locM1, 1); }
            if (locM2 >= 0) { gl.enableVertexAttribArray(locM2); gl.vertexAttribPointer(locM2, 4, gl.FLOAT, false, matStride, 8*4); gl.vertexAttribDivisor(locM2, 1); }
            if (locM3 >= 0) { gl.enableVertexAttribArray(locM3); gl.vertexAttribPointer(locM3, 4, gl.FLOAT, false, matStride, 12*4); gl.vertexAttribDivisor(locM3, 1); }

            gl.enable(gl.BLEND);
            if (indexCount > 0) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshEBO);
                gl.drawElementsInstanced(gl.TRIANGLES, indexCount, indexType, 0, this.instanceBuffer.count);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            } else {
                gl.drawArraysInstanced(gl.TRIANGLES, 0, vertexCount, this.instanceBuffer.count);
            }

            if (locM0 >= 0) gl.vertexAttribDivisor(locM0, 0);
            if (locM1 >= 0) gl.vertexAttribDivisor(locM1, 0);
            if (locM2 >= 0) gl.vertexAttribDivisor(locM2, 0);
            if (locM3 >= 0) gl.vertexAttribDivisor(locM3, 0);

            gl.bindVertexArray(null);
        }
    }


    _computeModelMatrixForMesh(mesh, viewMatrix) {
        const mat = mesh.matrix || mesh.entity.props.matrix || new Float32Array(16);
        const geom = mesh.entity.props?.geometry;
        const settings = geom?.settings ?? {};
        if (!settings.billboard || !viewMatrix) return mat;

        const invView = invertMatrix4(viewMatrix);
        if (!invView) return mat;
        const out = new Float32Array(16);
        out.set(mat);

        out[12] = mat[12]; out[13] = mat[13]; out[14] = mat[14];

        const scale = extractScaleFromMat4(mat);
        out[0] = invView[0]*scale[0]; out[1] = invView[1]*scale[0]; out[2] = invView[2]*scale[0];
        out[4] = invView[4]*scale[1]; out[5] = invView[5]*scale[1]; out[6] = invView[6]*scale[1];
        out[8] = invView[8]*scale[2]; out[9] = invView[9]*scale[2]; out[10]= invView[10]*scale[2];

        return out;
    }
}
