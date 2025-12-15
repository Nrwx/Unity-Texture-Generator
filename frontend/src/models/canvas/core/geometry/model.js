/**
 * Geometry Class für Game Engine Meshes
 * - Primitives: Cube, Plane, Sphere, Cylinder (mit Caps)
 * - Settings: billboard, clipFace, invertNormals, doubleSided, frontFace, cullFace, flipUV, generateNormals, generateTangents, center
 * - Utilities: computeNormals(), computeTangents(), toBuffer(), getBoundingBox(), getBoundingSphere(), clone(), applySettings(), applyMatrix4()
 */
export class Geometry {
    constructor({vertices = null, normals = null, uvs = null, indices = null, settings = {}} = {}) {
        this.vertices = vertices ? new Float32Array(vertices) : new Float32Array(0);
        this.normals = normals ? new Float32Array(normals) : new Float32Array(0);
        this.uvs = uvs ? new Float32Array(uvs) : new Float32Array(0);

        const vertCount = this.vertices.length / 3;
        if (indices) {
            this.indices = (vertCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices));
        } else {
            this.indices = null;
        }

        this.settings = {
            billboard: false,
            clipFace: false,
            invertNormals: false,
            doubleSided: false,
            frontFace: "ccw",
            cullFace: "back",
            flipUV: false,
            center: false,
            generateNormals: false,
            generateTangents: false,
            meta: null,
            ...settings
        };

        this.tangents = null;
        this.bounds = null;

        this._applySettingsInternal();
    }

    // ----------------------
    // Primitives
    // ----------------------
    static createDefaultCube(settings = {}) {
        const vertices = new Float32Array([
            -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
            -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5
        ]);
        const normals = new Float32Array([
            0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
            0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1
        ]);
        const uvs = new Float32Array([
            0, 0, 1, 0, 1, 1, 0, 1,
            0, 0, 1, 0, 1, 1, 0, 1
        ]);
        const indices = new Uint16Array([
            0, 1, 2, 2, 3, 0,
            4, 5, 6, 6, 7, 4,
            0, 1, 5, 5, 4, 0,
            2, 3, 7, 7, 6, 2,
            0, 3, 7, 7, 4, 0,
            1, 2, 6, 6, 5, 1
        ]);
        return new Geometry({vertices, normals, uvs, indices, settings});
    }

    static createPlane(width = 1, height = 1, segX = 1, segY = 1, settings = {}) {
        const vertices = [], normals = [], uvs = [], indices = [];
        for (let y = 0; y <= segY; y++) {
            for (let x = 0; x <= segX; x++) {
                const u = x / segX, v = y / segY;
                vertices.push((u - 0.5) * width, (v - 0.5) * height, 0);
                normals.push(0, 0, 1);
                uvs.push(u, 1 - v);
            }
        }
        for (let y = 0; y < segY; y++) {
            for (let x = 0; x < segX; x++) {
                const i0 = y * (segX + 1) + x, i1 = i0 + 1, i2 = i0 + (segX + 1), i3 = i2 + 1;
                indices.push(i0, i2, i1, i1, i2, i3);
            }
        }
        return new Geometry({
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            uvs: new Float32Array(uvs),
            indices: (vertices.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)),
            settings
        });
    }

    static createSphere(radius = 0.5, segW = 16, segH = 12, settings = {}) {
        const vertices = [], normals = [], uvs = [], indices = [];
        for (let y = 0; y <= segH; y++) {
            const v = y / segH;
            const theta = v * Math.PI;
            const sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);
            for (let x = 0; x <= segW; x++) {
                const u = x / segW;
                const phi = u * 2 * Math.PI;
                const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
                const vx = cosPhi * sinTheta, vy = cosTheta, vz = sinPhi * sinTheta;
                vertices.push(vx * radius, vy * radius, vz * radius);
                normals.push(vx, vy, vz);
                uvs.push(u, 1 - v);
            }
        }
        for (let y = 0; y < segH; y++) {
            for (let x = 0; x < segW; x++) {
                const i0 = y * (segW + 1) + x, i1 = i0 + 1, i2 = i0 + (segW + 1), i3 = i2 + 1;
                indices.push(i0, i2, i1, i1, i2, i3);
            }
        }
        return new Geometry({
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            uvs: new Float32Array(uvs),
            indices: (vertices.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)),
            settings
        });
    }

    static createCylinder(radiusTop = 0.5, radiusBottom = 0.5, height = 1, radialSeg = 16, heightSeg = 1, settings = {}) {
        const vertices = [], normals = [], uvs = [], indices = [];
        const halfH = height / 2;
        for (let y = 0; y <= heightSeg; y++) {
            const v = y / heightSeg;
            const py = v * height - halfH;
            const radius = radiusBottom + (radiusTop - radiusBottom) * v;
            for (let x = 0; x <= radialSeg; x++) {
                const u = x / radialSeg, theta = u * 2 * Math.PI;
                const sinT = Math.sin(theta), cosT = Math.cos(theta);
                vertices.push(radius * cosT, py, radius * sinT);
                normals.push(cosT, 0, sinT);
                uvs.push(u, 1 - v);
            }
        }
        for (let y = 0; y < heightSeg; y++) {
            for (let x = 0; x < radialSeg; x++) {
                const i0 = y * (radialSeg + 1) + x, i1 = i0 + 1, i2 = i0 + (radialSeg + 1), i3 = i2 + 1;
                indices.push(i0, i2, i1, i1, i2, i3);
            }
        }
        const topCenter = vertices.length / 3;
        vertices.push(0, halfH, 0);
        normals.push(0, 1, 0);
        uvs.push(0.5, 0.5);
        const offsetTop = heightSeg * (radialSeg + 1);
        for (let i = 0; i < radialSeg; i++) {
            const a = offsetTop + i, b = offsetTop + ((i + 1) % radialSeg);
            indices.push(topCenter, b, a);
        }
        const bottomCenter = vertices.length / 3;
        vertices.push(0, -halfH, 0);
        normals.push(0, -1, 0);
        uvs.push(0.5, 0.5);
        for (let i = 0; i < radialSeg; i++) {
            const a = i, b = (i + 1) % radialSeg;
            indices.push(bottomCenter, a, b);
        }
        return new Geometry({
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            uvs: new Float32Array(uvs),
            indices: (vertices.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)),
            settings
        });
    }

    // ----------------------
    // Transformations & Center
    // ----------------------
    scale(sx = 1, sy = 1, sz = 1) {
        const v = this.vertices;
        for (let i = 0; i < v.length; i += 3) {
            v[i] *= sx;
            v[i + 1] *= sy;
            v[i + 2] *= sz
        }
        this._updateBounds();
    }

    translate(tx = 0, ty = 0, tz = 0) {
        const v = this.vertices;
        for (let i = 0; i < v.length; i += 3) {
            v[i] += tx;
            v[i + 1] += ty;
            v[i + 2] += tz
        }
        this._updateBounds();
    }

    rotateX(rad) {
        this._rotate(rad, "x");
    }

    rotateY(rad) {
        this._rotate(rad, "y");
    }

    rotateZ(rad) {
        this._rotate(rad, "z");
    }

    _rotate(rad, axis) {
        const c = Math.cos(rad), s = Math.sin(rad);
        const v = this.vertices, n = this.normals;
        for (let i = 0; i < v.length; i += 3) {
            let x = v[i], y = v[i + 1], z = v[i + 2];
            if (axis === "x") {
                v[i + 1] = y * c - z * s;
                v[i + 2] = y * s + z * c
            } else if (axis === "y") {
                v[i] = x * c + z * s;
                v[i + 2] = -x * s + z * c
            } else {
                v[i] = x * c - y * s;
                v[i + 1] = x * s + y * c
            }
            if (n.length) {
                let nx = n[i], ny = n[i + 1], nz = n[i + 2];
                if (axis === "x") {
                    n[i + 1] = ny * c - nz * s;
                    n[i + 2] = ny * s + nz * c
                } else if (axis === "y") {
                    n[i] = nx * c + nz * s;
                    n[i + 2] = -nx * s + nz * c
                } else {
                    n[i] = nx * c - ny * s;
                    n[i + 1] = nx * s + ny * c
                }
            }
        }
        this._updateBounds();
    }

    center() {
        const bb = this.getBoundingBox();
        this.translate(-(bb.min[0] + bb.max[0]) * 0.5, -(bb.min[1] + bb.max[1]) * 0.5, -(bb.min[2] + bb.max[2]) * 0.5);
    }

    // ----------------------
    // Normals & Tangents
    // ----------------------
    computeNormals() {
        this.normals = new Float32Array(this.vertices.length);
        this._ensureIndices();
        const idx = this.indices, v = this.vertices, n = this.normals;
        for (let i = 0; i < idx.length; i += 3) {
            const ia = idx[i], ib = idx[i + 1], ic = idx[i + 2];
            const ax = v[ia * 3], ay = v[ia * 3 + 1], az = v[ia * 3 + 2];
            const bx = v[ib * 3], by = v[ib * 3 + 1], bz = v[ib * 3 + 2];
            const cx = v[ic * 3], cy = v[ic * 3 + 1], cz = v[ic * 3 + 2];
            const nx = (by - ay) * (cz - cy) - (bz - az) * (cy - ay),
                ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - cz), nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
            for (const j of [ia, ib, ic]) {
                n[j * 3] += nx;
                n[j * 3 + 1] += ny;
                n[j * 3 + 2] += nz
            }
        }
        for (let i = 0; i < n.length; i += 3) {
            const nx = n[i], ny = n[i + 1], nz = n[i + 2], l = Math.hypot(nx, ny, nz) || 1;
            n[i] = nx / l;
            n[i + 1] = ny / l;
            n[i + 2] = nz / l
        }
        if (this.settings.invertNormals) this._invertNormals();
    }

    computeTangents() {
        if (!this.uvs || !this.uvs.length) return;
        this._ensureIndices();
        const nVerts = this.vertices.length / 3;
        const tan1 = new Float32Array(nVerts * 3), tan2 = new Float32Array(nVerts * 3);
        this.tangents = new Float32Array(nVerts * 4);
        const idx = this.indices, v = this.vertices, uv = this.uvs, n = this.normals;
        for (let i = 0; i < idx.length; i += 3) {
            const i1 = idx[i], i2 = idx[i + 1], i3 = idx[i + 2];
            const x1 = v[i2 * 3] - v[i1 * 3], y1 = v[i2 * 3 + 1] - v[i1 * 3 + 1], z1 = v[i2 * 3 + 2] - v[i1 * 3 + 2];
            const x2 = v[i3 * 3] - v[i1 * 3], y2 = v[i3 * 3 + 1] - v[i1 * 3 + 1], z2 = v[i3 * 3 + 2] - v[i1 * 3 + 2];
            const s1 = uv[i2 * 2] - uv[i1 * 2], t1 = uv[i2 * 2 + 1] - uv[i1 * 2 + 1], s2 = uv[i3 * 2] - uv[i1 * 2],
                t2 = uv[i3 * 2 + 1] - uv[i1 * 2 + 1];
            const r = (s1 * t2 - s2 * t1) || 1, invR = 1 / r;
            const tx = (t2 * x1 - t1 * x2) * invR, ty = (t2 * y1 - t1 * y2) * invR, tz = (t2 * z1 - t1 * z2) * invR;
            const bx = (s1 * x2 - s2 * x1) * invR, by = (s1 * y2 - s2 * y1) * invR, bz = (s1 * z2 - s2 * z1) * invR;
            for (const j of [i1, i2, i3]) {
                tan1[j * 3] += tx;
                tan1[j * 3 + 1] += ty;
                tan1[j * 3 + 2] += tz;
                tan2[j * 3] += bx;
                tan2[j * 3 + 1] += by;
                tan2[j * 3 + 2] += bz
            }
        }
        for (let i = 0; i < nVerts; i++) {
            let nx = n[i * 3], ny = n[i * 3 + 1], nz = n[i * 3 + 2];
            let tx = tan1[i * 3], ty = tan1[i * 3 + 1], tz = tan1[i * 3 + 2];
            let dot = nx * tx + ny * ty + nz * tz;
            tx -= nx * dot;
            ty -= ny * dot;
            tz -= nz * dot;
            const len = Math.hypot(tx, ty, tz) || 1;
            tx /= len;
            ty /= len;
            tz /= len;
            const bx = tan2[i * 3], by = tan2[i * 3 + 1], bz = tan2[i * 3 + 2];
            const crossX = ny * tz - nz * ty, crossY = nz * tx - nx * tz, crossZ = nx * ty - ny * tx;
            const hand = (crossX * bx + crossY * by + crossZ * bz) < 0 ? -1 : 1;
            this.tangents[i * 4] = tx;
            this.tangents[i * 4 + 1] = ty;
            this.tangents[i * 4 + 2] = tz;
            this.tangents[i * 4 + 3] = hand;
        }
    }

    // ----------------------
    // Helpers
    // ----------------------
    _invertNormals() {
        for (let i = 0; i < this.normals.length; i++) this.normals[i] *= -1;
        if (!this.indices) return;
        const idx = this.indices;
        for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    }

    makeDoubleSided() {
        const vertCount = this.vertices.length / 3;
        const v2 = new Float32Array(this.vertices.length * 2);
        v2.set(this.vertices);
        v2.set(this.vertices, this.vertices.length);
        const n2 = new Float32Array(this.normals.length * 2);
        n2.set(this.normals);
        for (let i = 0; i < this.normals.length; i++) n2[i + this.normals.length] = -this.normals[i];
        const u2 = new Float32Array(this.uvs.length * 2);
        u2.set(this.uvs);
        u2.set(this.uvs, this.uvs.length);
        this.vertices = v2;
        this.normals = n2;
        this.uvs = u2;
        const idxOld = this.indices;
        const idxType = idxOld instanceof Uint32Array ? Uint32Array : Uint16Array;
        const idx2 = new idxType(idxOld.length * 2);
        idx2.set(idxOld);
        for (let i = 0; i < idxOld.length; i += 3) {
            idx2[idxOld.length + i] = idxOld[i] + vertCount;
            idx2[idxOld.length + i + 1] = idxOld[i + 2] + vertCount;
            idx2[idxOld.length + i + 2] = idxOld[i + 1] + vertCount;
        }
        this.indices = idx2;
        this._updateBounds();
    }

    // ----------------------
    // Bounding
    // ----------------------
    _updateBounds() {
        this.bounds = this.getBoundingBox();
    }

    getBoundingBox() {
        const v = this.vertices;
        if (!v.length) return {min: [0, 0, 0], max: [0, 0, 0]};
        let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (let i = 0; i < v.length; i += 3) {
            const x = v[i], y = v[i + 1], z = v[i + 2];
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            maxZ = Math.max(maxZ, z);
        }
        return {min: [minX, minY, minZ], max: [maxX, maxY, maxZ]};
    }

    // ----------------------
    // Settings
    // ----------------------
    applySettings() {
        this._applySettingsInternal();
    }

    _applySettingsInternal() {
        if (this.settings.flipUV) for (let i = 1; i < this.uvs.length; i += 2) this.uvs[i] = 1 - this.uvs[i];
        if (this.settings.center) this.center();
        if (this.settings.generateNormals) this.computeNormals();
        if (this.settings.invertNormals) this._invertNormals();
        if (this.settings.doubleSided) this.makeDoubleSided();
        if (this.settings.generateTangents) this.computeTangents();
        this._updateBounds();
    }

    // ----------------------
    // Utilities
    // ----------------------
    clone() {
        return new Geometry({
            vertices: this.vertices.slice(),
            normals: this.normals.slice(),
            uvs: this.uvs.slice(),
            indices: this.indices.slice(),
            settings: {...this.settings}
        });
    }

    toBuffer() {
        return {
            positions: this.vertices,
            normals: this.normals,
            uvs: this.uvs,
            indices: this.indices,
            tangents: this.tangents
        };
    }

    getVertexCount() {
        return this.vertices.length / 3;
    }

    getIndexCount() {
        return this.indices.length;
    }

    getTriangleCount() {
        return this.indices.length / 3;
    }

    // ----------------------
    // Private
    // ----------------------
    _ensureIndices() {
        if (!this.indices) {
            const vertCount = this.vertices.length / 3;
            this.indices = vertCount > 65535 ? new Uint32Array(vertCount) : new Uint16Array(vertCount);
            for (let i = 0; i < vertCount; i++) this.indices[i] = i;
        }
    }
}

