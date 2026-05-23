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
        this.instanceVbo = null;

        this.vertexCount = 0;
        this.indexCount = 0;
        this.instanceCount = 0;
        this.instanceCapacity = 0;
        this.indexType = gl.UNSIGNED_SHORT;
        this.stride = Number(options.stride || 0);
        this.instanceStride = Number(options.instanceStride || 0);
        this.vertexByteLength = 0;
        this.indexByteLength = 0;
        this.instanceByteLength = 0;
        this.instanceAllocatedByteLength = 0;

        this.usage = options.usage || gl.STATIC_DRAW;
        this.instanceUsage = options.instanceUsage || gl.DYNAMIC_DRAW;
        this.attributes = Array.isArray(options.attributes)
            ? options.attributes
            : [];
        this.instanceAttributes = Array.isArray(options.instanceAttributes)
            ? options.instanceAttributes
            : [];

        this.destroyed = false;

        this.vao = gl.createVertexArray?.() || null;
        this.vbo = gl.createBuffer();
        this.ibo = options.indexed === false ? null : gl.createBuffer();

        if (this.instanceStride > 0 || this.instanceAttributes.length > 0) {
            this.instanceVbo = gl.createBuffer();
        }
    }

    static materialMesh(gl, mesh, options = {}) {
        const stride = Number(mesh?.stride || 11) * 4;

        const buffer = new Buffer(gl, {
            label: options.label || mesh?.id || "material-mesh",
            stride,
            indexed: true,
            usage: options.usage || gl.STATIC_DRAW,
            instanceStride: Number(options.instanceStride || 0),
            instanceAttributes: options.instanceAttributes,
            instanceUsage: options.instanceUsage,
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
            stride: Number(options.stride || 3 * 4),
            indexed: false,
            usage: options.usage || gl.STATIC_DRAW,
            instanceStride: Number(options.instanceStride || 0),
            instanceAttributes: options.instanceAttributes,
            instanceUsage: options.instanceUsage,
            attributes: Array.isArray(options.attributes)
                ? options.attributes
                : [
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
            this.vertexByteLength = 0;
            this.indexByteLength = 0;
            return this;
        }

        this.vertexCount = this.stride > 0
            ? vertexArray.byteLength / this.stride
            : 0;
        this.vertexByteLength = vertexArray.byteLength;

        gl.bindVertexArray?.(this.vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertexArray, this.usage);

        this.enableAttributes();

        if (this.instanceVbo && this.instanceAttributes.length) {
            this.enableInstanceAttributes();
        }

        if (this.ibo && indices) {
            const indexArray = this.toIndexArray(indices, indexType);
            this.indexCount = indexArray.length;
            this.indexByteLength = indexArray.byteLength;
            this.indexType = indexArray instanceof Uint32Array
                ? gl.UNSIGNED_INT
                : gl.UNSIGNED_SHORT;

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, this.usage);
        } else {
            this.indexCount = 0;
            this.indexByteLength = 0;
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

        if (this.vertexByteLength === vertexArray.byteLength) {
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertexArray);
        } else {
            gl.bufferData(gl.ARRAY_BUFFER, vertexArray, usage);
            this.vertexByteLength = vertexArray.byteLength;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        return this;
    }

    createInstanceBuffer({ stride = this.instanceStride, attributes = this.instanceAttributes, capacity = 1, usage = this.gl.DYNAMIC_DRAW } = {}) {
        if (this.destroyed) {
            return this;
        }

        const gl = this.gl;
        this.instanceStride = Number(stride || 0);
        this.instanceAttributes = Array.isArray(attributes) ? attributes : [];
        this.instanceUsage = usage;

        if (!this.instanceVbo) {
            this.instanceVbo = gl.createBuffer();
        }

        const resolvedCapacity = Math.max(1, Math.trunc(Number(capacity || 1)));
        const byteLength = Math.max(0, resolvedCapacity * this.instanceStride);

        gl.bindVertexArray?.(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVbo);
        gl.bufferData(gl.ARRAY_BUFFER, byteLength, usage);
        this.instanceAllocatedByteLength = byteLength;
        this.instanceCapacity = resolvedCapacity;
        this.instanceByteLength = 0;
        this.enableInstanceAttributes();
        gl.bindVertexArray?.(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        return this;
    }

    ensureInstanceCapacity(count = 1, usage = this.instanceUsage) {
        const resolvedCount = Math.max(1, Math.trunc(Number(count || 1)));

        if (!this.instanceVbo || !this.instanceStride) {
            return this;
        }

        if (resolvedCount <= this.instanceCapacity && this.instanceAllocatedByteLength > 0) {
            return this;
        }

        let capacity = Math.max(1, this.instanceCapacity || 1);
        while (capacity < resolvedCount) {
            capacity *= 2;
        }

        return this.createInstanceBuffer({
            stride: this.instanceStride,
            attributes: this.instanceAttributes,
            capacity,
            usage,
        });
    }

    updateInstances(instances, count = null, usage = this.instanceUsage) {
        if (this.destroyed) {
            return this;
        }

        const gl = this.gl;
        const instanceArray = this.toFloat32Array(instances);

        if (!this.instanceVbo) {
            this.instanceVbo = gl.createBuffer();
        }

        const resolvedCount = count === null || count === undefined
            ? (this.instanceStride > 0 ? Math.floor(instanceArray.byteLength / this.instanceStride) : 0)
            : Math.max(0, Math.trunc(Number(count) || 0));

        this.instanceCount = resolvedCount;
        this.instanceByteLength = instanceArray.byteLength;
        this.instanceUsage = usage;

        if (!instanceArray.length || !resolvedCount) {
            return this;
        }

        this.ensureInstanceCapacity(resolvedCount, usage);

        gl.bindVertexArray?.(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVbo);

        if (this.instanceAllocatedByteLength >= instanceArray.byteLength) {
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceArray);
        } else {
            gl.bufferData(gl.ARRAY_BUFFER, instanceArray, usage);
            this.instanceAllocatedByteLength = instanceArray.byteLength;
            this.instanceCapacity = this.instanceStride > 0
                ? Math.floor(instanceArray.byteLength / this.instanceStride)
                : resolvedCount;
        }

        this.enableInstanceAttributes();
        gl.bindVertexArray?.(null);
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

            if (gl.vertexAttribDivisor) {
                gl.vertexAttribDivisor(location, Number(attribute.divisor || 0));
            }
        }
    }

    enableInstanceAttributes() {
        const gl = this.gl;

        if (!this.instanceVbo || !this.instanceAttributes.length) {
            return;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVbo);

        for (const attribute of this.instanceAttributes) {
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
                Number(attribute.stride || this.instanceStride || 0),
                Number(attribute.offset || 0)
            );

            if (gl.vertexAttribDivisor) {
                gl.vertexAttribDivisor(location, Number(attribute.divisor || 1));
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
        this.enableInstanceAttributes();
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

    drawElementsInstanced(mode = this.gl.TRIANGLES, count = this.indexCount, offset = 0, instanceCount = this.instanceCount || 1) {
        if (this.destroyed || !this.ibo || this.indexCount <= 0 || instanceCount <= 0 || !this.gl.drawElementsInstanced) {
            return;
        }

        const gl = this.gl;

        this.bind();
        gl.drawElementsInstanced(mode, count, this.indexType, offset, instanceCount);
    }

    drawArraysInstanced(mode = this.gl.TRIANGLES, count = this.vertexCount, first = 0, instanceCount = this.instanceCount || 1) {
        if (this.destroyed || this.vertexCount <= 0 || instanceCount <= 0 || !this.gl.drawArraysInstanced) {
            return;
        }

        const gl = this.gl;

        this.bind();
        gl.drawArraysInstanced(mode, first, count, instanceCount);
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

        if (this.instanceVbo) {
            gl.deleteBuffer(this.instanceVbo);
        }

        this.vao = null;
        this.vbo = null;
        this.ibo = null;
        this.instanceVbo = null;

        this.vertexCount = 0;
        this.indexCount = 0;
        this.instanceCount = 0;
        this.instanceCapacity = 0;
        this.vertexByteLength = 0;
        this.indexByteLength = 0;
        this.instanceByteLength = 0;
        this.instanceAllocatedByteLength = 0;
        this.destroyed = true;
    }

    toFloat32Array(value) {
        if (value instanceof Float32Array) {
            return value;
        }

        if (ArrayBuffer.isView(value)) {
            return new Float32Array(value);
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
            : ArrayBuffer.isView(value)
                ? Array.from(value)
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
