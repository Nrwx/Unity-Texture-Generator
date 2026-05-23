import {isFiniteNumber} from "@/utils/math";

export class Vector {
    constructor(x = 0, y = 0, z = 0) {
        this.data = new Float32Array(3);

        if (x instanceof Vector) {
            return this.set(x.x, x.y, x.z);
        }

        if (Array.isArray(x) || ArrayBuffer.isView(x)) {
            return this.set(x[0], x[1], x[2]);
        }

        if (x && typeof x === "object") {
            return this.set(
                x.x ?? x[0] ?? x.data?.[0],
                x.y ?? x[1] ?? x.data?.[1],
                x.z ?? x[2] ?? x.data?.[2],
            );
        }

        this.set(x, y, z);
    }

    get x() {
        return this.data[0];
    }

    set x(value) {
        this.data[0] = Vector.number(value);
    }

    get y() {
        return this.data[1];
    }

    set y(value) {
        this.data[1] = Vector.number(value);
    }

    get z() {
        return this.data[2];
    }

    set z(value) {
        this.data[2] = Vector.number(value);
    }

    static number(value, fallback = 0) {
        const number = Number(value);
        return isFiniteNumber(number) ? number : fallback;
    }

    static from(value, fallback = [0, 0, 0]) {
        if (value === null || value === undefined) {
            return new Vector(fallback);
        }

        if (value instanceof Vector) {
            return value.clone();
        }

        return new Vector(value);
    }

    static zero() {
        return new Vector(0, 0, 0);
    }

    static up() {
        return new Vector(0, 1, 0);
    }

    static right() {
        return new Vector(1, 0, 0);
    }

    static forward() {
        return new Vector(0, 0, -1);
    }

    static add(a, b) {
        return Vector.from(a).add(b);
    }

    static sub(a, b) {
        return Vector.from(a).sub(b);
    }

    static scale(value, scalar) {
        return Vector.from(value).scale(scalar);
    }

    static dot(a, b) {
        return Vector.from(a).dot(b);
    }

    static cross(a, b) {
        return Vector.from(a).cross(b);
    }

    static normalize(value, fallback = [0, 1, 0]) {
        return Vector.from(value, fallback).normalize(fallback);
    }

    clone() {
        return new Vector(this.x, this.y, this.z);
    }

    copy(value) {
        if (value instanceof Vector) {
            return this.set(value.x, value.y, value.z);
        }

        const vector = Vector.from(value);

        this.x = vector.x;
        this.y = vector.y;
        this.z = vector.z;

        return this;
    }

    update(x = 0, y = 0, z = 0) {
        if (
            x instanceof Vector ||
            Array.isArray(x) ||
            ArrayBuffer.isView(x) ||
            (x && typeof x === "object")
        ) {
            return this.copy(x);
        }

        return this.set(x, y, z);
    }

    set(x = 0, y = 0, z = 0) {
        this.x = Vector.number(x);
        this.y = Vector.number(y);
        this.z = Vector.number(z);

        return this;
    }

    add(value) {
        const vector = Vector.from(value);

        this.x += vector.x;
        this.y += vector.y;
        this.z += vector.z;

        return this;
    }

    sub(value) {
        const vector = Vector.from(value);

        this.x -= vector.x;
        this.y -= vector.y;
        this.z -= vector.z;

        return this;
    }

    scale(scalar = 1) {
        const value = Vector.number(scalar, 1);

        this.x *= value;
        this.y *= value;
        this.z *= value;

        return this;
    }

    addScaled(value, scalar = 1) {
        const vector = Vector.from(value);
        const amount = Vector.number(scalar, 1);

        this.x += vector.x * amount;
        this.y += vector.y * amount;
        this.z += vector.z * amount;

        return this;
    }

    lerp(value, amount = 0) {
        const vector = Vector.from(value);
        const t = Math.min(Math.max(Vector.number(amount), 0), 1);

        this.x += (vector.x - this.x) * t;
        this.y += (vector.y - this.y) * t;
        this.z += (vector.z - this.z) * t;

        return this;
    }

    damp(value, damping = 18, dt = 1 / 60) {
        const target = Vector.from(value);
        const alpha = damping <= 0 ? 1 : 1 - Math.exp(-damping * dt);

        return this.lerp(target, alpha);
    }

    dot(value) {
        const vector = Vector.from(value);

        return (
            this.x * vector.x +
            this.y * vector.y +
            this.z * vector.z
        );
    }

    cross(value) {
        const vector = Vector.from(value);

        const x = this.y * vector.z - this.z * vector.y;
        const y = this.z * vector.x - this.x * vector.z;
        const z = this.x * vector.y - this.y * vector.x;

        this.x = x;
        this.y = y;
        this.z = z;

        return this;
    }

    crossed(value) {
        return this.clone().cross(value);
    }

    lengthSq() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    length() {
        return Math.sqrt(this.lengthSq());
    }

    distance(value) {
        return this.clone().sub(value).length();
    }

    normalize(fallback = [0, 1, 0]) {
        const length = this.length();

        if (length <= 0.000001) {
            return this.copy(fallback);
        }

        return this.scale(1 / length);
    }

    negate() {
        this.x = -this.x;
        this.y = -this.y;
        this.z = -this.z;

        return this;
    }

    toArray() {
        return [this.x, this.y, this.z];
    }

    toObject() {
        return {
            x: this.x,
            y: this.y,
            z: this.z,
        };
    }

    toFloat32Array() {
        return new Float32Array(this.data);
    }
}
