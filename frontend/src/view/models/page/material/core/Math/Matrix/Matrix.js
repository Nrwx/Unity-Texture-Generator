import {Vector} from "@/view/models/page/material/core/Math/Vector/Vector";

export class Matrix {
    constructor(values = null) {
        this.data = new Float32Array(16);

        if (values) {
            this.from(values);
        } else {
            this.identity();
        }
    }

    static identity() {
        return new Matrix();
    }

    static from(value) {
        return value instanceof Matrix ? value.clone() : new Matrix(value);
    }

    static fromQuaternion(q) {
        const length = Math.hypot(q.x, q.y, q.z, q.w) || 1;

        const x = q.x / length;
        const y = q.y / length;
        const z = q.z / length;
        const w = q.w / length;

        const x2 = x + x;
        const y2 = y + y;
        const z2 = z + z;

        const xx = x * x2;
        const xy = x * y2;
        const xz = x * z2;

        const yy = y * y2;
        const yz = y * z2;
        const zz = z * z2;

        const wx = w * x2;
        const wy = w * y2;
        const wz = w * z2;

        return new Matrix([
            1 - (yy + zz), xy + wz,       xz - wy,       0,
            xy - wz,       1 - (xx + zz), yz + wx,       0,
            xz + wy,       yz - wx,       1 - (xx + yy), 0,
            0,             0,             0,             1,
        ]);
    }

    static translation(x = 0, y = 0, z = 0) {
        const matrix = Matrix.identity();

        matrix.data[12] = x;
        matrix.data[13] = y;
        matrix.data[14] = z;

        return matrix;
    }

    static scale(x = 1, y = 1, z = 1) {
        const matrix = Matrix.identity();

        matrix.data[0] = x;
        matrix.data[5] = y;
        matrix.data[10] = z;

        return matrix;
    }

    static compose(position = [0, 0, 0], rotation = null, scale = [1, 1, 1]) {
        const p = Vector.from(position);
        const s = Vector.from(scale, [1, 1, 1]);

        const matrix = rotation
            ? Matrix.fromQuaternion(rotation)
            : Matrix.identity();

        matrix.multiply(Matrix.scale(s.x, s.y, s.z));

        matrix.data[12] = p.x;
        matrix.data[13] = p.y;
        matrix.data[14] = p.z;

        return matrix;
    }

    static perspective(fov, aspect, near, far) {
        const f = 1 / Math.tan(fov / 2);
        const nf = 1 / (near - far);

        return new Matrix([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) * nf, -1,
            0, 0, 2 * far * near * nf, 0,
        ]);
    }

    static orthographic(left, right, bottom, top, near, far) {
        const lr = 1 / (left - right);
        const bt = 1 / (bottom - top);
        const nf = 1 / (near - far);

        return new Matrix([
            -2 * lr, 0, 0, 0,
            0, -2 * bt, 0, 0,
            0, 0, 2 * nf, 0,
            (left + right) * lr,
            (top + bottom) * bt,
            (far + near) * nf,
            1,
        ]);
    }

    static lookAt(eye, center, up = [0, 1, 0]) {
        const e = Vector.from(eye);
        const c = Vector.from(center);
        const u = Vector.from(up, [0, 1, 0]).normalize([0, 1, 0]);

        const z = Vector.sub(e, c).normalize([0, 0, 1]);
        const x = u.crossed(z).normalize([1, 0, 0]);
        const y = z.crossed(x).normalize([0, 1, 0]);

        return new Matrix([
            x.x, y.x, z.x, 0,
            x.y, y.y, z.y, 0,
            x.z, y.z, z.z, 0,
            -x.dot(e), -y.dot(e), -z.dot(e), 1,
        ]);
    }

    identity() {
        this.data.set([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ]);

        return this;
    }

    clone() {
        return new Matrix(this.data);
    }

    from(value) {
        const source = value instanceof Matrix ? value.data : value;

        if (!source || source.length !== 16) {
            throw new Error("[Matrix.from] Expected Matrix or array with length 16.");
        }

        this.data.set(source);

        return this;
    }

    multiply(value) {
        const a = this.data;
        const b = value instanceof Matrix ? value.data : value;

        if (!b || b.length !== 16) {
            throw new Error("[Matrix.multiply] Expected Matrix or array with length 16.");
        }

        const out = new Float32Array(16);

        for (let column = 0; column < 4; column += 1) {
            for (let row = 0; row < 4; row += 1) {
                out[column * 4 + row] =
                    a[0 * 4 + row] * b[column * 4 + 0] +
                    a[1 * 4 + row] * b[column * 4 + 1] +
                    a[2 * 4 + row] * b[column * 4 + 2] +
                    a[3 * 4 + row] * b[column * 4 + 3];
            }
        }

        this.data.set(out);

        return this;
    }

    multiplied(value) {
        return this.clone().multiply(value);
    }

    invert() {
        const m = this.data;
        const out = new Float32Array(16);

        const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
        const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
        const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
        const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

        const b00 = a00 * a11 - a01 * a10;
        const b01 = a00 * a12 - a02 * a10;
        const b02 = a00 * a13 - a03 * a10;
        const b03 = a01 * a12 - a02 * a11;
        const b04 = a01 * a13 - a03 * a11;
        const b05 = a02 * a13 - a03 * a12;
        const b06 = a20 * a31 - a21 * a30;
        const b07 = a20 * a32 - a22 * a30;
        const b08 = a20 * a33 - a23 * a30;
        const b09 = a21 * a32 - a22 * a31;
        const b10 = a21 * a33 - a23 * a31;
        const b11 = a22 * a33 - a23 * a32;

        const det =
            b00 * b11 -
            b01 * b10 +
            b02 * b09 +
            b03 * b08 -
            b04 * b07 +
            b05 * b06;

        if (!det) {
            throw new Error("[Matrix.invert] Matrix is singular.");
        }

        const invDet = 1 / det;

        out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * invDet;
        out[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * invDet;
        out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * invDet;
        out[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * invDet;
        out[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * invDet;
        out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * invDet;
        out[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * invDet;
        out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * invDet;
        out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * invDet;
        out[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * invDet;
        out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * invDet;
        out[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * invDet;
        out[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * invDet;
        out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * invDet;
        out[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * invDet;
        out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * invDet;

        this.data.set(out);

        return this;
    }

    inverted() {
        return this.clone().invert();
    }

    transformPoint(value, w = 1) {
        const v = Vector.from(value);
        const m = this.data;

        const x = v.x;
        const y = v.y;
        const z = v.z;

        return {
            x: m[0] * x + m[4] * y + m[8] * z + m[12] * w,
            y: m[1] * x + m[5] * y + m[9] * z + m[13] * w,
            z: m[2] * x + m[6] * y + m[10] * z + m[14] * w,
            w: m[3] * x + m[7] * y + m[11] * z + m[15] * w,
        };
    }

    transformDirection(value) {
        const v = Vector.from(value);
        const m = this.data;

        return new Vector(
            m[0] * v.x + m[4] * v.y + m[8] * v.z,
            m[1] * v.x + m[5] * v.y + m[9] * v.z,
            m[2] * v.x + m[6] * v.y + m[10] * v.z,
        );
    }

    normalMatrix3() {
        const inv = this.clone().invert().data;

        return new Float32Array([
            inv[0], inv[4], inv[8],
            inv[1], inv[5], inv[9],
            inv[2], inv[6], inv[10],
        ]);
    }

    toArray() {
        return new Float32Array(this.data);
    }
}
