export class Animation {
    /**
     * @param {string} name
     * @param {Array} keyframes - Array von { time, boneTransforms }
     * @param {string} interpolationMode - 'linear' | 'spline'
     */
    constructor(name, keyframes = [], interpolationMode = 'linear') {
        this.name = name;
        this.keyframes = keyframes;
        this.duration = keyframes.length > 0 ? keyframes[keyframes.length - 1].time : 0;
        this.interpolationMode = interpolationMode;
    }

    getBoneMatricesAt(time) {
        if (!this.keyframes.length) return [];

        // Clamp time
        if (time <= this.keyframes[0].time) return this.keyframes[0].boneTransforms;
        if (time >= this.keyframes[this.keyframes.length - 1].time)
            return this.keyframes[this.keyframes.length - 1].boneTransforms;

        // Suche nach prev/next Keyframes
        let prev = this.keyframes[0];
        let next = this.keyframes[this.keyframes.length - 1];
        for (let i = 1; i < this.keyframes.length; i++) {
            if (this.keyframes[i].time >= time) {
                prev = this.keyframes[i - 1];
                next = this.keyframes[i];
                break;
            }
        }

        // Interpolationsfaktor
        const t = (time - prev.time) / Math.max(0.000001, (next.time - prev.time));

        // Linear oder Spline Interpolation
        if (this.interpolationMode === 'linear') {
            return prev.boneTransforms.map((prevMat, i) => {
                const nextMat = next.boneTransforms[i];
                const mat = new Float32Array(16);
                for (let j = 0; j < 16; j++) {
                    mat[j] = prevMat[j] * (1 - t) + nextMat[j] * t;
                }
                return mat;
            });
        } else if (this.interpolationMode === 'spline') {
            // Catmull-Rom Spline interpolation zwischen vier Punkten
            const getFrame = (idx) => {
                if (idx < 0) return this.keyframes[0].boneTransforms;
                if (idx >= this.keyframes.length) return this.keyframes[this.keyframes.length - 1].boneTransforms;
                return this.keyframes[idx].boneTransforms;
            };
            const prevIdx = this.keyframes.indexOf(prev);
            const nextIdx = this.keyframes.indexOf(next);
            const p0 = getFrame(prevIdx - 1);
            const p1 = prev;
            const p2 = next;
            const p3 = getFrame(nextIdx + 1);

            return p1.boneTransforms.map((_, i) => {
                const mat = new Float32Array(16);
                for (let j = 0; j < 16; j++) {
                    const v0 = p0[j], v1 = p1[j], v2 = p2[j], v3 = p3[j];
                    const t2 = t * t;
                    const t3 = t2 * t;
                    mat[j] = 0.5 * (
                        (2 * v1) +
                        (-v0 + v2) * t +
                        (2*v0 - 5*v1 + 4*v2 - v3) * t2 +
                        (-v0 + 3*v1 - 3*v2 + v3) * t3
                    );
                }
                return mat;
            });
        } else {
            // Fallback linear
            return prev.boneTransforms.map((prevMat, i) => {
                const nextMat = next.boneTransforms[i];
                const mat = new Float32Array(16);
                for (let j = 0; j < 16; j++) {
                    mat[j] = prevMat[j] * (1 - t) + nextMat[j] * t;
                }
                return mat;
            });
        }
    }
}

