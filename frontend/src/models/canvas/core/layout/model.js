import {isGLContext, makeDefaultSegment} from "@/models/canvas/core/utils/model";

/**
 * Compute segment layout for canvas and map global base/layers into segments
 * @returns {object} layout
 * @param model
 */
export const computeLayout = (model) => {
    if (!model?.canvas || !model.viewport) return;

    const colWidths = Array(model?.viewport?.columns).fill(0);
    const rowHeights = Array(model?.viewport?.rows).fill(0);

    let usedW = 0, usedH = 0;

    for (let c = 0; c < model?.viewport?.columns; c++) {
        if (model?.viewport?.columns?.[c]?.width) {
            colWidths[c] = model.viewport.columns[c].width;
            usedW += colWidths[c];
        }
    }

    for (let r = 0; r < model?.viewport?.rows; r++) {
        if (model?.viewport?.rows?.[r]?.height) {
            rowHeights[r] = model.viewport.rows[r].height;
            usedH += rowHeights[r];
        }
    }

    const freeW = model?.canvas?.width - usedW;
    const freeH = model?.canvas?.height - usedH;

    const dynCols = colWidths.filter(w => w === 0).length || 1;
    const dynRows = rowHeights.filter(h => h === 0).length || 1;

    for (let c = 0; c < model?.viewport?.columns; c++)
        if (colWidths[c] === 0) colWidths[c] = Math.floor(freeW / dynCols);

    for (let r = 0; r < model?.viewport?.rows; r++)
        if (rowHeights[r] === 0) rowHeights[r] = Math.floor(freeH / dynRows);

    const colOffset = colWidths.map((_, i) => colWidths.slice(0, i).reduce((a, b) => a + b, 0));
    const rowOffset = rowHeights.map((_, i) => rowHeights.slice(0, i).reduce((a, b) => a + b, 0));

    return {
        isSingle: model?.viewport?.rows === 1 && model?.viewport?.columns === 1,
        colWidths,
        rowHeights,
        colOffset,
        rowOffset
    };
};

export const ensure_segments = (model) => {
    if (!model?.viewport?.rows || !model?.viewport?.columns || !model?.layout) return;

    const neededCount = model.viewport.rows *  model.viewport.columns;

    while (model.segments.length < neededCount) {
        model.segments.push(makeDefaultSegment(model?.webgl));
    }

    if (model.segments.length > neededCount) {
        model.segments.length = neededCount;
    }

    let i = 0;
    for (let r = 0; r < model.viewport.rows; r++) {
        for (let c = 0; c < model.viewport.columns; c++) {

            const seg = model?.segments[i];
            seg.id = `${r}-${c}`;
            seg.row = r;
            seg.col = c;

            seg.width = model.layout.colWidths[c];
            seg.height = model.layout.rowHeights[r];

            const x = model.layout.colOffset[c];
            const y = model.layout.rowOffset[r];
            if (model?.webgl && seg?.matrix instanceof Float32Array) {
                seg.matrix[12] = x;
                seg.matrix[13] = y;
            }

            else if (!isGLContext(model.ctx)) {
                seg.matrix.x = x;
                seg.matrix.y = y;
            }

            i++;
        }
    }
};


export const updateSegmentGridData = (model) => {
    if (!model?.segments) return;

    for (const seg of model.segments) {
        const c = seg.col;
        const r = seg.row;

        seg.width  = model.layout.colWidths[c];
        seg.height = model.layout.rowHeights[r];

        // ✅ WebGL: write into 4x4 matrix
        if (model.webgl && seg.matrix instanceof Float32Array) {
            // column-major translation
            seg.matrix[12] = model.layout.colOffset[c];
            seg.matrix[13] = model.layout.rowOffset[r];
        }
        // ✅ Canvas 2D: affine matrix
        else if (!isGLContext(model.ctx) && seg?.matrix) {
            seg.matrix.x = model.layout.colOffset[c];
            seg.matrix.y = model.layout.rowOffset[r];
        }
    }
};
