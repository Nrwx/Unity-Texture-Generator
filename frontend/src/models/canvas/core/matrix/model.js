import {
    matrixAffineCombine,
    matrixApply,
    matrixCombine,
    matrixDefault,
    matrixMultiply,
    matrixTranslate
} from "@/utils/matrix";

export const combineLayerMatrix = (sx, sy, lw, lh, layerMatrix) => {
    const lcm = matrixCombine(layerMatrix || matrixDefault());
    const Mlayer = matrixAffineCombine(lcm);

    const cxLayer = sx + lw / 2;
    const cyLayer = sy + lh / 2;

    const TnegL = matrixTranslate(-cxLayer, -cyLayer);
    const stepL = matrixMultiply(Mlayer, TnegL);
    return matrixMultiply(matrixTranslate(cxLayer, cyLayer), stepL);
}

export const combinedSegmentMatrix = (sx, sy, sw, sh, segMatrix) => {
    const base = segMatrix ? matrixCombine(segMatrix) : matrixCombine(matrixDefault());
    const cx = sx + sw / 2, cy = sy + sh / 2;
    const Tneg = matrixTranslate(-cx, -cy);
    const Mbase = matrixAffineCombine(base);
    const Tpos = matrixTranslate(cx, cy);
    const step1 = matrixMultiply(Mbase, Tneg);
    return matrixMultiply(Tpos, step1);
};

// -----------------------------------------------------------
// buildFullMatrix(baseMatrix, offsetX, offsetY, width, height)
// Creates a final transform including layout offset.
// -----------------------------------------------------------
export const combinedRenderMatrix = (baseMat, ox, oy, w, h) => {
    const mat = matrixAffineCombine(baseMat);

    const cx = ox + w / 2;
    const cy = oy + h / 2;

    const Tneg = matrixTranslate(-cx, -cy);
    const step1 = matrixMultiply(mat, Tneg);
    return matrixMultiply(matrixTranslate(cx, cy), step1);
}

export const transformedCorners = (mat, x, y, w, h) => {
    const corners = [
        { x: x, y: y },
        { x: x + w, y: y },
        { x: x + w, y: y + h },
        { x: x, y: y + h }
    ];
    return corners.map(p => matrixApply(mat, p));
};