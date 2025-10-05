/**
 * Erzeugt eine Transformationsmatrix, die Translation, Rotation und Skalierung kombiniert, basierend auf den übergebenen Parametern.
 *
 * @param {Object} m - Matrix-Parameter
 * @param {number} [m.a=1] - Skalierung in X-Richtung
 * @param {number} [m.d=1] - Skalierung in Y-Richtung
 * @param {number} [m.rotate=0] - Rotation in Grad
 * @param {number} [m.x=0] - Translation in X-Richtung
 * @param {number} [m.y=0] - Translation in Y-Richtung
 * @returns {{a: number, b: number, c: number, d: number, x: number, y: number}} Transformationsmatrix
 */
export const combinedMatrix = (m) => {
    const rad = (m.rotate || 0) * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Kombiniert Translation + Rotation + Scale in einer Matrix
    const a = (m.a ?? 1) * cos;
    const b = (m.a ?? 1) * sin;
    const c = (m.d ?? 1) * -sin;
    const d = (m.d ?? 1) * cos;
    const x = m.x ?? 0;
    const y = m.y ?? 0;

    return {a, b, c, d, x, y};
};
