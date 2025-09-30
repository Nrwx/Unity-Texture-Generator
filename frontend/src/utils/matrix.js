export function invertMatrix(m) {
    const det = m.a * m.d - m.b * m.c;
    if (!det) return null;
    return {
        a: m.d / det,
        b: -m.b / det,
        c: -m.c / det,
        d: m.a / det,
        x: (m.c * m.y - m.d * m.x) / det,
        y: (m.b * m.x - m.a * m.y) / det,
    };
}

export function transformPoint(x, y, m) {
    return {
        x: x * m.a + y * m.c + m.x,
        y: x * m.b + y * m.d + m.y
    };
}

export function inverseTransformPoint(x, y, m) {
    const inv = invertMatrix(m);
    return inv
        ? { x: x * inv.a + y * inv.c + inv.x, y: x * inv.b + y * inv.d + inv.y }
        : null;
}