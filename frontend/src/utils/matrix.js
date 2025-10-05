export function invertMatrix(m) {
    const det = m.a * m.d - m.b * m.c;
    if (!det) return null;

    const a =  m.d / det;
    const b = -m.b / det;
    const c = -m.c / det;
    const d =  m.a / det;

    const x = -(m.x * a + m.y * c);
    const y = -(m.x * b + m.y * d);

    return { a, b, c, d, x, y };
}


export function transformPoint(x, y, m) {
    return {
        x: x * m.a + y * m.c + m.x,
        y: x * m.b + y * m.d + m.y,
    };
}

export function inverseTransformPoint(x, y, m) {
    const inv = invertMatrix(m);
    return inv
        ? {
            x: x * inv.a + y * inv.c + inv.x,
            y: x * inv.b + y * inv.d + inv.y,
        }
        : null;
}