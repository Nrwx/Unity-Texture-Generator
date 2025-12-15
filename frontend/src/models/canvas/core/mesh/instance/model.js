// MeshInstanceBuffer
export class MeshInstanceBuffer {
    constructor(gl, maxCount = 20000) {
        this.gl = gl;
        this.maxCount = Math.max(1, maxCount);
        this.buffer = gl.createBuffer();
        this.data = new Float32Array(this.maxCount * 16); // mat4 per instance
        this.count = 0;
    }

    reset() {
        this.count = 0;
    }

    pushMatrix(mat16) {
        if (this.count >= this.maxCount) return;
        const off = this.count * 16;
        for (let i = 0; i < 16; i++) this.data[off + i] = mat16[i];
        this.count++;
    }

    upload() {
        if (this.count === 0) return;
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.count * 16), gl.DYNAMIC_DRAW);
    }
}
