/**
 * Multipliziert zwei Matrizen.
 *
 * Normal:
 *    m2 ∘ m1  (2×3 affine Canvas-Matrix)
 *
 * WebGL:
 *    B ∘ A    (4×4 Matrix, column-major)
 *
 * @param {Object|Float32Array} m2 - Matrix 2 (rechts)
 * @param {Object|Float32Array} m1 - Matrix 1 (links)
 * @param {boolean} [webgl=false] - true → WebGL 4×4 Multiplikation
 * @returns {Object|Float32Array} - neue Matrix
 */
export const matrixMultiply = (m2, m1, webgl = false) => {
    if (webgl) {
        const A = m1;
        const B = m2;
        const result = new Float32Array(16);

        // 4x4 Matrix Multiplikation (column-major)
        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 4; row++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += B[k * 4 + row] * A[col * 4 + k];
                }
                result[col * 4 + row] = sum;
            }
        }

        return result;
    } else {
        // 2D Canvas 2x3 affine Matrix Multiplikation
        return {
            a: m2.a * m1.a + m2.c * m1.b,
            b: m2.b * m1.a + m2.d * m1.b,
            c: m2.a * m1.c + m2.c * m1.d,
            d: m2.b * m1.c + m2.d * m1.d,
            x: m2.a * m1.x + m2.c * m1.y + m2.x,
            y: m2.b * m1.x + m2.d * m1.y + m2.y
        };
    }
};


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
export const matrixCombine = (m) => {
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
/**
 * Konvertiert Grad in Radiant.
 * @param {(rotX?: number, rotY?: number, rotZ?: number) => DOMMatrix} deg - Winkel in Grad
 * @param {number} deg - Winkel in Grad
 * @returns {number} Winkel in Radiant
 */
export const deg2rad = (deg) => deg * Math.PI / 180;

/**
 * Erzeugt eine 2D-Affine-Matrix.
 *
 * @param {number} a
 * @param {number} b
 * @param {number} c
 * @param {number} d
 * @param {number} [x=0] - Translation X
 * @param {number} [y=0] - Translation Y
 * @returns {{a:number,b:number,c:number,d:number,x:number,y:number}}
 */
export const matrixAffine = (a, b, c, d, x = 0, y = 0) => ({
    a, b, c, d, x, y
});

/**
 * Erzeugt eine Kombinierte 2D-Affine-Matrix.
 *
 * @returns {{a:number,b:number,c:number,d:number,x:number,y:number}}
 * @param {object} [cm={a: number, b: number, c: number, d: number, x: number, y: number}]
 */
export const matrixAffineCombine = (cm) => matrixAffine(cm.a ?? 1, cm.b ?? 0, cm.c ?? 0, cm.d ?? 1, cm.x ?? 0, cm.y ?? 0);

/**
 * Wendet eine Matrix auf einen Punkt an.
 *
 * Canvas 2D:
 *   {a,b,c,d,x,y}
 *
 * WebGL 4x4 (column-major):
 *   Float32Array(16)
 *
 * @param {Object|Float32Array} m - Matrix
 * @param {{x:number,y:number,z?:number,w?:number}} p - Punkt
 * @param {boolean} [webgl=false] - true → WebGL 4×4
 * @returns {{x:number,y:number,z?:number}}
 */
export const matrixApply = (m, p, webgl = false) => {
    if (webgl) {
        // Defaultwerte für Homogeneous Coordinates
        const x = p.x;
        const y = p.y;
        const z = p.z ?? 0;
        const w = p.w ?? 1;

        // column-major 4x4 * vec4
        const nx =
            m[0] * x +
            m[4] * y +
            m[8] * z +
            m[12] * w;

        const ny =
            m[1] * x +
            m[5] * y +
            m[9] * z +
            m[13] * w;

        const nz =
            m[2] * x +
            m[6] * y +
            m[10] * z +
            m[14] * w;

        const nw =
            m[3] * x +
            m[7] * y +
            m[11] * z +
            m[15] * w;

        // perspektivische Division (falls nötig)
        if (nw !== 0 && nw !== 1) {
            return {
                x: nx / nw,
                y: ny / nw,
                z: nz / nw
            };
        }

        return { x: nx, y: ny, z: nz };
    }

    // Canvas 2D affine Matrix
    return {
        x: m.a * p.x + m.c * p.y + m.x,
        y: m.b * p.x + m.d * p.y + m.y
    };
};

/**
 * Erstellt eine Translationsmatrix oder wendet Translation auf eine Matrix an.
 *
 * @param {{x:number,y:number,z?:number}} offset - Translation
 * @param {Object|Float32Array|null} matrix - optionale Ausgangsmatrix
 * @param {boolean} [webgl=false] - true → WebGL 4×4
 * @returns {Object|Float32Array}
 */
export const matrixTranslate = (offset, matrix = null, webgl = false) => {
    if (webgl) {
        const tx = offset.x ?? 0;
        const ty = offset.y ?? 0;
        const tz = offset.z ?? 0;

        // Nur Translation erzeugen
        if (!matrix) {
            return new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                tx, ty, tz, 1
            ]);
        }

        const m = matrix;

        // Matrix * Translation (column-major)
        const out = new Float32Array(16);

        out[0]  = m[0];  out[1]  = m[1];  out[2]  = m[2];  out[3]  = m[3];
        out[4]  = m[4];  out[5]  = m[5];  out[6]  = m[6];  out[7]  = m[7];
        out[8]  = m[8];  out[9]  = m[9];  out[10] = m[10]; out[11] = m[11];

        out[12] =
            m[0] * tx +
            m[4] * ty +
            m[8] * tz +
            m[12];

        out[13] =
            m[1] * tx +
            m[5] * ty +
            m[9] * tz +
            m[13];


        out[14] =
            m[2] * tx +
            m[6] * ty +
            m[10] * tz +
            m[14];

        out[15] =
            m[3] * tx +
            m[7] * ty +
            m[11] * tz +
            m[15];

        return out;
    } else {
        const tx = offset.x ?? 0;
        const ty = offset.y ?? 0;

        if (!matrix) {
            return {
                a: 1, b: 0,
                c: 0, d: 1,
                x: tx,
                y: ty
            };
        }

        return {
            a: matrix?.a,
            b: matrix?.b,
            c: matrix?.c,
            d: matrix?.d,
            x: matrix?.a * tx + matrix?.c * ty + matrix?.x,
            y: matrix?.b * tx + matrix?.d * ty + matrix?.y
        };
    }
}


/**
 * Prüft, ob ein Punkt innerhalb eines Polygons liegt (Raycasting).
 *
 * @param {number} px - X des Punktes
 * @param {number} py - Y des Punktes
 * @param {{x:number,y:number}[]} poly - Polygonpunkte
 * @returns {boolean} true wenn der Punkt im Polygon liegt
 */
export const rayCast = (px, py, poly) => {
    let inside = false;

    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;

        const intersect =
            ((yi > py) !== (yj > py)) &&
            (px < (xj - xi) * (py - yi) / ((yj - yi) + 1e-12) + xi);

        if (intersect) inside = !inside;
    }

    return inside;
};

/**
 * Invertiert eine Matrix
 *
 * - 2D Canvas: 2x3 affine Matrix
 * - WebGL: 4x4 column-major Float32Array
 *
 * @param {Object|Float32Array} m
 * @param {boolean} [webgl=false]
 * @returns {Object|Float32Array}
 */
export const matrixInvert = (m, webgl = false) => {

    // ===============================
    // WebGL 4x4 Matrix (column-major)
    // ===============================
    if (webgl) {
        const inv = new Float32Array(16);

        const a00 = m[0],  a01 = m[4],  a02 = m[8],  a03 = m[12];
        const a10 = m[1],  a11 = m[5],  a12 = m[9],  a13 = m[13];
        const a20 = m[2],  a21 = m[6],  a22 = m[10], a23 = m[14];
        const a30 = m[3],  a31 = m[7],  a32 = m[11], a33 = m[15];

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

        // Determinante
        let det =
            b00 * b11 -
            b01 * b10 +
            b02 * b09 +
            b03 * b08 -
            b04 * b07 +
            b05 * b06;

        if (!det) throw new Error("Matrix not invertible");

        det = 1.0 / det;

        inv[0]  = ( a11 * b11 - a12 * b10 + a13 * b09) * det;
        inv[1]  = (-a10 * b11 + a12 * b08 - a13 * b07) * det;
        inv[2]  = ( a10 * b10 - a11 * b08 + a13 * b06) * det;
        inv[3]  = (-a10 * b09 + a11 * b07 - a12 * b06) * det;

        inv[4]  = (-a01 * b11 + a02 * b10 - a03 * b09) * det;
        inv[5]  = ( a00 * b11 - a02 * b08 + a03 * b07) * det;
        inv[6]  = (-a00 * b10 + a01 * b08 - a03 * b06) * det;
        inv[7]  = ( a00 * b09 - a01 * b07 + a02 * b06) * det;

        inv[8]  = ( a31 * b05 - a32 * b04 + a33 * b03) * det;
        inv[9]  = (-a30 * b05 + a32 * b02 - a33 * b01) * det;
        inv[10] = ( a30 * b04 - a31 * b02 + a33 * b00) * det;
        inv[11] = (-a30 * b03 + a31 * b01 - a32 * b00) * det;

        inv[12] = (-a21 * b05 + a22 * b04 - a23 * b03) * det;
        inv[13] = ( a20 * b05 - a22 * b02 + a23 * b01) * det;
        inv[14] = (-a20 * b04 + a21 * b02 - a23 * b00) * det;
        inv[15] = ( a20 * b03 - a21 * b01 + a22 * b00) * det;

        return inv;
    } else {
        const det = m.a * m.d - m.b * m.c;
        if (!det) throw new Error("Matrix not invertible");

        const invDet = 1 / det;

        return {
            a: m.d * invDet,
            b: -m.b * invDet,
            c: -m.c * invDet,
            d: m.a * invDet,
            x: (m.c * m.y - m.d * m.x) * invDet,
            y: (m.b * m.x - m.a * m.y) * invDet
        };
    }
};


/**
 * Erzeugt eine Rotationsmatrix um einen Pivotpunkt.
 * @param {number} deg - Rotation in Grad
 * @param {number} px - Pivot X
 * @param {number} py - Pivot Y
 * @returns {{a,b,c,d,x,y}}
 */
export const matrixRotateAt = (deg, px, py) => {
    const rot = matrixCombine({rotate: deg});
    return matrixMultiply(
        matrixMultiply(matrixTranslate(px, py), rot),
        matrixTranslate(-px, -py)
    );
};

/**
 * Erzeugt eine Skalierungsmatrix um einen Pivotpunkt.
 * @param {number} sx - Scale X
 * @param {number} sy - Scale Y
 * @param {number} px - Pivot X
 * @param {number} py - Pivot Y
 * @returns {{a,b,c,d,x,y}}
 */
export const matrixScaleAt = (sx, sy, px, py) => {
    return matrixMultiply(
        matrixMultiply(matrixTranslate(px, py), matrixAffine(sx, 0, 0, sy)),
        matrixTranslate(-px, -py)
    );
};

/**
 * Wandelt eine Matrix in einen CSS transform() String um.
 * @param {{a,b,c,d,x,y}} m
 * @returns {string}
 */
export const matrixToCss = (m) =>
    `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.x}, ${m.y})`;

/**
 * Berechnet die Distanz von Punkt p zu einem Liniensegment AB.
 * @param {{x,y}} p
 * @param {{x,y}} a
 * @param {{x,y}} b
 * @returns {number}
 */
export const pointToSegmentDistance = (p, a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);

    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const proj = {x: a.x + t * dx, y: a.y + t * dy};
    return Math.hypot(p.x - proj.x, p.y - proj.y);
};

/**
 * Transformiert ein Axis-Aligned Bounding Box (AABB) mit einer Matrix.
 * @param {{minX:number,minY:number,maxX:number,maxY:number}} box
 * @param {{a,b,c,d,x,y}} m
 * @returns {{minX,minY,maxX,maxY}}
 */
export const transformAABB = (box, m) => {
    const pts = [
        {x: box.minX, y: box.minY},
        {x: box.maxX, y: box.minY},
        {x: box.maxX, y: box.maxY},
        {x: box.minX, y: box.maxY},
    ].map(p => matrixApply(m, p));

    return {
        minX: Math.min(...pts.map(p => p.x)),
        minY: Math.min(...pts.map(p => p.y)),
        maxX: Math.max(...pts.map(p => p.x)),
        maxY: Math.max(...pts.map(p => p.y)),
    };
};

/**
 * Baut eine Transformationsmatrix aus Position, Rotation, Scale + Pivot.
 * @param {number} [x=0] - Translation X
 * @param {number} [y=0] - Translation Y
 * @param {number} deg - Rotation in Grad
 * @param {number} sx - Scale X
 * @param {number} sy - Scale Y
 * @param {number} px - Pivot X
 * @param {number} py - Pivot Y
 * @param {number} px - Pivot X
 * @param {number} py - Pivot Y
 * @returns {{a: number, b: number, c: number, d: number, x: number, y: number}}
 */
export const matrixTRS = ({x = 0, y = 0, rotate = 0, sx = 1, sy = 1, px = 0, py = 0}) => {
    const S = matrixScaleAt(sx, sy, px, py);
    const R = matrixRotateAt(rotate, px, py);
    const T = matrixTranslate(x, y);

    return matrixMultiply(T, matrixMultiply(R, S));
};


/**
 * Converts a matrix object to 3x3 affine array
 * @param {object} m
 * @returns {number[][]}
 */
export const matrixTo3x3Affine = (m) => [
    [m?.a ?? 1, m?.c ?? 0, m?.x ?? 0],
    [m?.b ?? 0, m?.d ?? 1, m?.y ?? 0],
    [0, 0, 1]
];

/**
 * Multiplies two 3x3 matrices
 * @param {number[][]} A
 * @param {number[][]} B
 * @returns {number[][]}
 */
export const matrixMultiply3x3Affine = (A, B) => {
    const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            let s = 0;
            for (let k = 0; k < 3; k++) s += A[i][k] * B[k][j];
            R[i][j] = s;
        }
    }
    return R;
};

/**
 * Applies 3x3 affine matrix to point
 * @param {number[][]} M
 * @param {number} px
 * @param {number} py
 * @returns {{x:number, y:number}}
 */
export const matrixApply3x3Affine = (M, px, py) => ({
    x: M[0][0] * px + M[0][1] * py + M[0][2],
    y: M[1][0] * px + M[1][1] * py + M[1][2]
});

export function invertMatrix4(m) {
    // ... (same implementation as in previous answer; omitted here for brevity)
    // copy helper from earlier code block in your project
    // return Float32Array(16) or null
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

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1.0 / det;

    const out = new Float32Array(16);
    out[0] = ( a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * det;
    out[2] = ( a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * det;
    out[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * det;
    out[5] = ( a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * det;
    out[7] = ( a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = ( a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * det;
    out[10]= ( a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11]= (-a20 * b04 + a21 * b02 - a23 * b00) * det;
    out[12]= (-a10 * b09 + a11 * b07 - a12 * b06) * det;
    out[13]= ( a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14]= (-a30 * b03 + a31 * b01 - a32 * b00) * det;
    out[15]= ( a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
}
export function extractScaleFromMat4(m) {
    const sx = Math.hypot(m[0], m[1], m[2]) || 1.0;
    const sy = Math.hypot(m[4], m[5], m[6]) || 1.0;
    const sz = Math.hypot(m[8], m[9], m[10]) || 1.0;
    return [sx, sy, sz];
}