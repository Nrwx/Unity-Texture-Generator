// ============================================================
// InstanceBuffer (instanced attributes)
// ============================================================
export class InstanceBuffer {
    constructor(gl, maxCount = 10000) {
        this.gl = gl;
        this.maxCount = maxCount;

        // 12 floats pro Particle, inkl. RotationSpeed + SizeOsc
        this.data = new Float32Array(maxCount * 12);
        this.count = 0;

        this.buffer = gl.createBuffer();
    }

    reset() { this.count = 0; }

    push(particle) {
        if (this.count >= this.maxCount) return;
        const offset = this.count * 12;

        this.data[offset+0] = particle.x;
        this.data[offset+1] = particle.y;
        this.data[offset+2] = particle.z;

        this.data[offset+3] = particle.size;

        this.data[offset+4] = particle.color[0];
        this.data[offset+5] = particle.color[1];
        this.data[offset+6] = particle.color[2];
        this.data[offset+7] = particle.color[3];

        this.data[offset+8] = particle.opacity;
        this.data[offset+9] = particle.lifeRatio;

        this.data[offset+10] = particle.rotationSpeed;
        this.data[offset+11] = particle.sizeOsc.freq;

        this.count++;
    }

    upload() {
        if (this.count === 0) return;
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.count*12), gl.DYNAMIC_DRAW);
    }
}
