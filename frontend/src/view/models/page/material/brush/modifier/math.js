export const EPSILON = 1e-6;

export const clamp = (value, min = 0, max = 1) => Math.min(Math.max(Number(value) || 0, min), max);
export const clampSigned = value => Math.min(Math.max(Number(value) || 0, -1), 1);

export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a, b) => ([
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
]);
export const lenSq3 = a => dot3(a, a);
export const len3 = a => Math.sqrt(lenSq3(a));
export const distance3 = (a, b) => len3(sub3(a, b));
export const normalize3 = (value, fallback = [0, 0, 1]) => {
    const length = len3(value);

    if (length <= EPSILON) {
        return fallback.slice();
    }

    return [value[0] / length, value[1] / length, value[2] / length];
};

export const mix3 = (a, b, t) => ([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
]);

export const smoothstep = (edge0, edge1, value) => {
    const t = clamp((value - edge0) / Math.max(EPSILON, edge1 - edge0));

    return t * t * (3 - 2 * t);
};

export const brushFalloff = (distance, radius, softness = 0.65, offset = 0) => {
    const r = Math.max(EPSILON, Number(radius) || 1);
    const normalized = clamp(distance / r);
    const inner = clamp(Number(offset) || 0, 0, 0.95);
    const soft = clamp(Number(softness), 0, 1);
    const fadeStart = clamp(inner + (1 - inner) * (1 - soft), 0, 0.98);

    if (normalized <= fadeStart) {
        return 1;
    }

    return 1 - smoothstep(fadeStart, 1, normalized);
};
