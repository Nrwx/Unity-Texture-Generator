// src/models/layer/3D/core/buffer/model.js

export class Buffer {
    constructor(gl, options = {}) {
        if (!gl) {
            throw new Error("Buffer requires a WebGL context.");
        }

        this.gl = gl;
        this.label = options.label || "buffer";

        this.vao = null;
        this.vbo = null;
        this.ibo = null;

        this.vertexCount = 0;
        this.indexCount = 0;
        this.indexType = gl.UNSIGNED_SHORT;
        this.stride = Number(options.stride || 0);

        this.usage = options.usage || gl.STATIC_DRAW;
        this.attributes = Array.isArray(options.attributes)
            ? options.attributes
            : [];

        this.destroyed = false;

        this.vao = gl.createVertexArray?.() || null;
        this.vbo = gl.createBuffer();
        this.ibo = options.indexed === false ? null : gl.createBuffer();
    }

    static materialMesh(gl, mesh, options = {}) {
        const stride = Number(mesh?.stride || 11) * 4;

        const buffer = new Buffer(gl, {
            label: options.label || mesh?.id || "material-mesh",
            stride,
            indexed: true,
            usage: options.usage || gl.STATIC_DRAW,
            attributes: [
                { location: 0, size: 3, offset: 0 },
                { location: 1, size: 3, offset: 3 * 4 },
                { location: 2, size: 2, offset: 6 * 4 },
                { location: 3, size: 3, offset: 8 * 4 },
            ],
        });

        buffer.upload({
            vertices: mesh.vertices,
            indices: mesh.indices,
            indexType: mesh.indexType,
        });

        return buffer;
    }

    static positions(gl, positions, options = {}) {
        const buffer = new Buffer(gl, {
            label: options.label || "position-buffer",
            stride: 3 * 4,
            indexed: false,
            usage: options.usage || gl.STATIC_DRAW,
            attributes: [
                { location: 0, size: 3, offset: 0 },
            ],
        });

        buffer.upload({
            vertices: positions,
        });

        return buffer;
    }

    upload({ vertices, indices = null, indexType = "" } = {}) {
        if (this.destroyed) {
            return this;
        }

        const gl = this.gl;
        const vertexArray = this.toFloat32Array(vertices);

        if (!vertexArray.length) {
            this.vertexCount = 0;
            this.indexCount = 0;
            return this;
        }

        this.vertexCount = this.stride > 0
            ? vertexArray.byteLength / this.stride
            : 0;

        gl.bindVertexArray?.(this.vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertexArray, this.usage);

        this.enableAttributes();

        if (this.ibo && indices) {
            const indexArray = this.toIndexArray(indices, indexType);
            this.indexCount = indexArray.length;
            this.indexType = indexArray instanceof Uint32Array
                ? gl.UNSIGNED_INT
                : gl.UNSIGNED_SHORT;

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, this.usage);
        } else {
            this.indexCount = 0;
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }

        gl.bindVertexArray?.(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        if (!this.vao) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }

        return this;
    }

    updateVertices(vertices, usage = this.gl.DYNAMIC_DRAW) {
        if (this.destroyed || !this.vbo) {
            return this;
        }

        const gl = this.gl;
        const vertexArray = this.toFloat32Array(vertices);

        this.vertexCount = this.stride > 0
            ? vertexArray.byteLength / this.stride
            : 0;

        this.usage = usage;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertexArray, usage);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        return this;
    }

    enableAttributes() {
        const gl = this.gl;

        for (const attribute of this.attributes) {
            const location = Number(attribute.location);

            if (!Number.isInteger(location) || location < 0) {
                continue;
            }

            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(
                location,
                Number(attribute.size || 1),
                attribute.type || gl.FLOAT,
                attribute.normalized === true,
                Number(attribute.stride || this.stride || 0),
                Number(attribute.offset || 0)
            );

            if (attribute.divisor && gl.vertexAttribDivisor) {
                gl.vertexAttribDivisor(location, Number(attribute.divisor));
            }
        }
    }

    bind() {
        if (this.destroyed) {
            return;
        }

        const gl = this.gl;

        if (this.vao && gl.bindVertexArray) {
            gl.bindVertexArray(this.vao);
            return;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);

        if (this.ibo) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
        }

        this.enableAttributes();
    }

    unbind() {
        const gl = this.gl;

        if (gl.bindVertexArray) {
            gl.bindVertexArray(null);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    draw(mode = this.gl.TRIANGLES) {
        if (this.destroyed) {
            return;
        }

        const gl = this.gl;

        this.bind();

        if (this.ibo && this.indexCount > 0) {
            gl.drawElements(mode, this.indexCount, this.indexType, 0);
        } else if (this.vertexCount > 0) {
            gl.drawArrays(mode, 0, this.vertexCount);
        }
    }

    drawElements(mode = this.gl.TRIANGLES, count = this.indexCount, offset = 0) {
        if (this.destroyed || !this.ibo || this.indexCount <= 0) {
            return;
        }

        const gl = this.gl;

        this.bind();
        gl.drawElements(mode, count, this.indexType, offset);
    }

    drawArrays(mode = this.gl.TRIANGLES, count = this.vertexCount, first = 0) {
        if (this.destroyed || this.vertexCount <= 0) {
            return;
        }

        const gl = this.gl;

        this.bind();
        gl.drawArrays(mode, first, count);
    }

    destroy() {
        if (this.destroyed) {
            return;
        }

        const gl = this.gl;

        if (this.vao && gl.deleteVertexArray) {
            gl.deleteVertexArray(this.vao);
        }

        if (this.vbo) {
            gl.deleteBuffer(this.vbo);
        }

        if (this.ibo) {
            gl.deleteBuffer(this.ibo);
        }

        this.vao = null;
        this.vbo = null;
        this.ibo = null;

        this.vertexCount = 0;
        this.indexCount = 0;
        this.destroyed = true;
    }

    toFloat32Array(value) {
        if (value instanceof Float32Array) {
            return value;
        }

        if (Array.isArray(value)) {
            return new Float32Array(value);
        }

        if (value && typeof value === "object") {
            return new Float32Array(
                Object.keys(value)
                    .sort((a, b) => Number(a) - Number(b))
                    .map(key => Number(value[key]) || 0)
            );
        }

        return new Float32Array();
    }

    toIndexArray(value, indexType = "") {
        if (value instanceof Uint16Array || value instanceof Uint32Array) {
            return value;
        }

        const array = Array.isArray(value)
            ? value
            : value && typeof value === "object"
                ? Object.keys(value)
                    .sort((a, b) => Number(a) - Number(b))
                    .map(key => value[key])
                : [];

        const maxIndex = array.reduce(
            (max, item) => Math.max(max, Math.trunc(Number(item) || 0)),
            0
        );

        const useUint32 = indexType === "uint32" || maxIndex > 65535;
        const TargetArray = useUint32 ? Uint32Array : Uint16Array;

        return new TargetArray(
            array.map(item => Math.max(0, Math.trunc(Number(item) || 0)))
        );
    }
}