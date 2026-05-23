import {Vector} from "@/view/models/page/material/core/Math/Vector/Vector";
import {Matrix} from "@/view/models/page/material/core/Math/Matrix/Matrix";
import {isFiniteNumber} from "@/utils/math";

export class Quaternion {
    constructor(x = 0, y = 0, z = 0, w = 1) {
        if (x instanceof Quaternion) {
            return this.copy(x);
        }

        if (Array.isArray(x) || ArrayBuffer.isView(x)) {
            return this.set(x[0], x[1], x[2], x[3]);
        }

        if (x && typeof x === "object") {
            return this.set(x.x, x.y, x.z, x.w);
        }

        this.set(x, y, z, w);
    }

    static identity() {
        return new Quaternion(0, 0, 0, 1);
    }

    static from(value) {
        return value instanceof Quaternion
            ? value.clone()
            : new Quaternion(value);
    }

    static fromAxisAngle(axis, angle = 0) {
        const v = Vector.normalize(axis, [0, 1, 0]);
        const half = angle * 0.5;
        const s = Math.sin(half);

        return new Quaternion(
            v.x * s,
            v.y * s,
            v.z * s,
            Math.cos(half),
        ).normalize();
    }

    static fromEuler(x = 0, y = 0, z = 0, order = "YXZ") {
        if (x && typeof x === "object") {
            order = x.order ?? order;
            z = x.z ?? 0;
            y = x.y ?? 0;
            x = x.x ?? 0;
        }

        const cx = Math.cos(x * 0.5);
        const sx = Math.sin(x * 0.5);
        const cy = Math.cos(y * 0.5);
        const sy = Math.sin(y * 0.5);
        const cz = Math.cos(z * 0.5);
        const sz = Math.sin(z * 0.5);

        let qx;
        let qy;
        let qz;
        let qw;

        switch (String(order).toUpperCase()) {
            case "XYZ":
                qx = sx * cy * cz + cx * sy * sz;
                qy = cx * sy * cz - sx * cy * sz;
                qz = cx * cy * sz + sx * sy * cz;
                qw = cx * cy * cz - sx * sy * sz;
                break;

            case "ZYX":
                qx = sx * cy * cz - cx * sy * sz;
                qy = cx * sy * cz + sx * cy * sz;
                qz = cx * cy * sz - sx * sy * cz;
                qw = cx * cy * cz + sx * sy * sz;
                break;

            case "YXZ":
            default:
                qx = sx * cy * cz + cx * sy * sz;
                qy = cx * sy * cz - sx * cy * sz;
                qz = cx * cy * sz - sx * sy * cz;
                qw = cx * cy * cz + sx * sy * sz;
                break;
        }

        return new Quaternion(qx, qy, qz, qw).normalize();
    }

    static lookRotation(forward, up = [0, 1, 0]) {
        const z = Vector.from(forward).normalize([0, 0, -1]).negate();
        const x = Vector.cross(up, z).normalize([1, 0, 0]);
        const y = z.clone().cross(x).normalize([0, 1, 0]);

        return Quaternion.fromBasis(x, y, z);
    }

    static fromBasis(xAxis, yAxis, zAxis) {
        const x = Vector.from(xAxis);
        const y = Vector.from(yAxis);
        const z = Vector.from(zAxis);

        const m00 = x.x;
        const m01 = y.x;
        const m02 = z.x;

        const m10 = x.y;
        const m11 = y.y;
        const m12 = z.y;

        const m20 = x.z;
        const m21 = y.z;
        const m22 = z.z;

        const trace = m00 + m11 + m22;

        let xq;
        let yq;
        let zq;
        let wq;

        if (trace > 0) {
            const s = Math.sqrt(trace + 1) * 2;
            wq = 0.25 * s;
            xq = (m21 - m12) / s;
            yq = (m02 - m20) / s;
            zq = (m10 - m01) / s;
        } else if (m00 > m11 && m00 > m22) {
            const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
            wq = (m21 - m12) / s;
            xq = 0.25 * s;
            yq = (m01 + m10) / s;
            zq = (m02 + m20) / s;
        } else if (m11 > m22) {
            const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
            wq = (m02 - m20) / s;
            xq = (m01 + m10) / s;
            yq = 0.25 * s;
            zq = (m12 + m21) / s;
        } else {
            const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
            wq = (m10 - m01) / s;
            xq = (m02 + m20) / s;
            yq = (m12 + m21) / s;
            zq = 0.25 * s;
        }

        return new Quaternion(xq, yq, zq, wq).normalize();
    }

    clone() {
        return new Quaternion(this);
    }

    copy(value) {
        const q = value instanceof Quaternion ? value : new Quaternion(value);

        this.x = Quaternion.number(q.x);
        this.y = Quaternion.number(q.y);
        this.z = Quaternion.number(q.z);
        this.w = Quaternion.number(q.w, 1);

        return this;
    }

    update(value) {
        return this.copy(value);
    }

    set(x = 0, y = 0, z = 0, w = 1) {
        this.x = Quaternion.number(x);
        this.y = Quaternion.number(y);
        this.z = Quaternion.number(z);
        this.w = Quaternion.number(w, 1);

        return this;
    }

    static number(value, fallback = 0) {
        const number = Number(value);
        return isFiniteNumber(number) ? number : fallback;
    }

    lengthSq() {
        return (
            this.x * this.x +
            this.y * this.y +
            this.z * this.z +
            this.w * this.w
        );
    }

    length() {
        return Math.sqrt(this.lengthSq());
    }

    normalize() {
        const length = this.length() || 1;

        this.x /= length;
        this.y /= length;
        this.z /= length;
        this.w /= length;

        return this;
    }

    invert() {
        const lengthSq = this.lengthSq() || 1;

        this.x = -this.x / lengthSq;
        this.y = -this.y / lengthSq;
        this.z = -this.z / lengthSq;
        this.w = this.w / lengthSq;

        return this;
    }

    inversed() {
        return this.clone().invert();
    }

    multiply(value) {
        const q = Quaternion.from(value);

        const ax = this.x;
        const ay = this.y;
        const az = this.z;
        const aw = this.w;

        const bx = q.x;
        const by = q.y;
        const bz = q.z;
        const bw = q.w;

        this.x = aw * bx + ax * bw + ay * bz - az * by;
        this.y = aw * by - ax * bz + ay * bw + az * bx;
        this.z = aw * bz + ax * by - ay * bx + az * bw;
        this.w = aw * bw - ax * bx - ay * by - az * bz;

        return this;
    }

    multiplied(value) {
        return this.clone().multiply(value);
    }

    slerp(value, amount = 0) {
        const q = Quaternion.from(value);
        const t = Math.min(Math.max(Quaternion.number(amount), 0), 1);

        let bx = q.x;
        let by = q.y;
        let bz = q.z;
        let bw = q.w;

        let dot =
            this.x * bx +
            this.y * by +
            this.z * bz +
            this.w * bw;

        if (dot < 0) {
            dot = -dot;
            bx = -bx;
            by = -by;
            bz = -bz;
            bw = -bw;
        }

        if (dot > 0.9995) {
            this.x += (bx - this.x) * t;
            this.y += (by - this.y) * t;
            this.z += (bz - this.z) * t;
            this.w += (bw - this.w) * t;

            return this.normalize();
        }

        const theta0 = Math.acos(Math.min(Math.max(dot, -1), 1));
        const theta = theta0 * t;
        const sinTheta = Math.sin(theta);
        const sinTheta0 = Math.sin(theta0);

        const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
        const s1 = sinTheta / sinTheta0;

        this.x = s0 * this.x + s1 * bx;
        this.y = s0 * this.y + s1 * by;
        this.z = s0 * this.z + s1 * bz;
        this.w = s0 * this.w + s1 * bw;

        return this;
    }

    static rotateVector(quaternion, value) {
        const q = Quaternion.from(quaternion);
        const vector = value instanceof Vector ? value.clone() : new Vector(value);

        const vx = vector.x;
        const vy = vector.y;
        const vz = vector.z;

        const qx = q.x;
        const qy = q.y;
        const qz = q.z;
        const qw = q.w;

        const tx = 2 * (qy * vz - qz * vy);
        const ty = 2 * (qz * vx - qx * vz);
        const tz = 2 * (qx * vy - qy * vx);

        vector.x = vx + qw * tx + (qy * tz - qz * ty);
        vector.y = vy + qw * ty + (qz * tx - qx * tz);
        vector.z = vz + qw * tz + (qx * ty - qy * tx);

        return vector;
    }

    toMatrix() {
        return Matrix.fromQuaternion(this);
    }

    toArray() {
        return [this.x, this.y, this.z, this.w];
    }

    toObject() {
        return {
            x: this.x,
            y: this.y,
            z: this.z,
            w: this.w,
        };
    }
}