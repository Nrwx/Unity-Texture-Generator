const toNumber = (value, fallback = 0) => {
    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
};

const toArray3 = (value, fallback = [0, 0, 0]) => {
    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
        return [
            toNumber(value[0], fallback[0]),
            toNumber(value[1], fallback[1]),
            toNumber(value[2], fallback[2]),
        ];
    }

    if (value && typeof value === "object") {
        const source = value.data || value;

        return [
            toNumber(source.x ?? source[0], fallback[0]),
            toNumber(source.y ?? source[1], fallback[1]),
            toNumber(source.z ?? source[2], fallback[2]),
        ];
    }

    return [fallback[0], fallback[1], fallback[2]];
};

const normalize3 = (value, fallback = [0, 0, -1]) => {
    const vector = toArray3(value, fallback);
    const length = Math.hypot(vector[0], vector[1], vector[2]);

    if (length <= 0.000001) {
        return [fallback[0], fallback[1], fallback[2]];
    }

    const invLength = 1 / length;

    return [
        vector[0] * invLength,
        vector[1] * invLength,
        vector[2] * invLength,
    ];
};

export class Ray {
    constructor(origin = [0, 0, 0], dir = [0, 0, -1]) {
        this.origin = toArray3(origin);
        this.dir = normalize3(dir, [0, 0, -1]);
    }

    static from(value = {}) {
        if (value instanceof Ray) {
            return value;
        }

        return new Ray(value.origin, value.dir || value.direction);
    }

    static fromCamera(camera, x, y, viewport) {
        return Ray.from(camera.rayFromScreen(x, y, viewport));
    }

    at(distance = 0) {
        const amount = toNumber(distance, 0);
        const origin = this.origin;
        const dir = this.dir;

        return [
            origin[0] + dir[0] * amount,
            origin[1] + dir[1] * amount,
            origin[2] + dir[2] * amount,
        ];
    }

    projectPoint(point) {
        const p = toArray3(point);
        const origin = this.origin;
        const dir = this.dir;

        return (
            (p[0] - origin[0]) * dir[0] +
            (p[1] - origin[1]) * dir[1] +
            (p[2] - origin[2]) * dir[2]
        );
    }

    distanceToPoint(point) {
        const p = toArray3(point);
        const origin = this.origin;
        const dir = this.dir;
        const t = Math.max(
            0,
            (p[0] - origin[0]) * dir[0] +
            (p[1] - origin[1]) * dir[1] +
            (p[2] - origin[2]) * dir[2]
        );
        const dx = p[0] - (origin[0] + dir[0] * t);
        const dy = p[1] - (origin[1] + dir[1] * t);
        const dz = p[2] - (origin[2] + dir[2] * t);

        return Math.hypot(dx, dy, dz);
    }
}
