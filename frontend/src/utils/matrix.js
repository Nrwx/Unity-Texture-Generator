/**
 * Erzeugt eine reine Standartmatrix.
 *
 * @param {number} [a=1]
 * @param {number} [b=0]
 * @param {number} [c=0]
 * @param {number} [d=1]
 * @param {number} [x=0] - Translation X
 * @param {number} [y=0] - Translation Y
 * @param {number} [rotate=0]
 * @returns {{a:number,b:number,c:number,d:number,x:number,y:number, rotate:number}}
 */
export const matrixDefault = (a = 1, b = 0, c = 0, d = 1, x = 0, y = 0, rotate = 0) => ({
    a: a, b: b,
    c: c, d: d,
    x: x, y: y,
    rotate: rotate
});

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
 * Erzeugt eine reine Translationsmatrix.
 *
 * @param {number} [x=0] - Translation X
 * @param {number} [y=0] - Translation Y
 * @returns {{a:number,b:number,c:number,d:number,x:number,y:number}}
 */
export const matrixTranslate = (x = 0, y = 0) => ({
    a: 1, b: 0,
    c: 0, d: 1,
    x: x, y: y
});

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
 * Multipliziert zwei Matrizen (m2 ∘ m1).
 *
 * @param {Object} m2 - Matrix 2
 * @param {Object} m1 - Matrix 1
 * @returns {{a:number,b:number,c:number,d:number,x:number,y:number}}
 */
export const matrixMultiply = (m2, m1) => ({
    a: m2.a * m1.a + m2.c * m1.b,
    b: m2.b * m1.a + m2.d * m1.b,
    c: m2.a * m1.c + m2.c * m1.d,
    d: m2.b * m1.c + m2.d * m1.d,
    x: m2.a * m1.x + m2.c * m1.y + m2.x,
    y: m2.b * m1.x + m2.d * m1.y + m2.y
});


/**
 * Wendet eine Matrix auf einen Punkt an.
 *
 * @param {{a:number,b:number,c:number,d:number,x:number,y:number}} m - Matrix
 * @param {{x:number,y:number}} p - Punkt
 * @returns {{x:number,y:number}} Transformierter Punkt
 */
export const matrixApply = (m, p) => ({
    x: m.a * p.x + m.c * p.y + m.x,
    y: m.b * p.x + m.d * p.y + m.y
});

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
 * Berechnet die Inverse einer 2D-Affinmatrix.
 * @param {{a:number,b:number,c:number,d:number,x:number,y:number}} m
 * @returns {{a:number,b:number,c:number,d:number,x:number,y:number}} inverse Matrix
 */
export const matrixInverse = (m) => {
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
