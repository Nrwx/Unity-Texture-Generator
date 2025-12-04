import {makeDefaultSegment} from "@/models/canvas/core/utils/model";

/**
 * Compute segment layout for canvas and map global base/layers into segments
 * @param {HTMLCanvasElement} canvas
 * @param {object} viewport
 * @returns {object} layout
 */
export const computeLayout = async (canvas, viewport = {}) => {
    const cw = canvas.width;
    const ch = canvas.height;

    const colWidths = Array(viewport?.columns).fill(0);
    const rowHeights = Array(viewport?.rows).fill(0);

    let usedW = 0, usedH = 0;

    for (let c = 0; c < viewport?.columns; c++) {
        if (viewport.columns?.[c]?.width) {
            colWidths[c] = viewport.columns[c].width;
            usedW += colWidths[c];
        }
    }

    for (let r = 0; r < viewport?.rows; r++) {
        if (viewport.rows?.[r]?.height) {
            rowHeights[r] = viewport.rows[r].height;
            usedH += rowHeights[r];
        }
    }

    const freeW = cw - usedW;
    const freeH = ch - usedH;

    const dynCols = colWidths.filter(w => w === 0).length || 1;
    const dynRows = rowHeights.filter(h => h === 0).length || 1;

    for (let c = 0; c < viewport?.columns; c++)
        if (colWidths[c] === 0) colWidths[c] = Math.floor(freeW / dynCols);

    for (let r = 0; r < viewport?.rows; r++)
        if (rowHeights[r] === 0) rowHeights[r] = Math.floor(freeH / dynRows);

    const colOffset = colWidths.map((_, i) => colWidths.slice(0, i).reduce((a, b) => a + b, 0));
    const rowOffset = rowHeights.map((_, i) => rowHeights.slice(0, i).reduce((a, b) => a + b, 0));

    return {
        isSingle: viewport?.rows === 1 && viewport?.columns === 1,
        colWidths,
        rowHeights,
        colOffset,
        rowOffset
    };
};

export const ensure_segments = async (model, layout) => {
    if (!model?.viewport?.rows || !model?.viewport?.columns) return;

    const rows = model.viewport.rows;
    const cols = model.viewport.columns;

    if (!Array.isArray(model.segments)) {
        model.segments = [];
    }

    const neededCount = rows * cols;

    while (model.segments.length < neededCount) {
        model.segments.push(makeDefaultSegment());
    }

    if (model.segments.length > neededCount) {
        model.segments.length = neededCount;
    }

    let i = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {

            const seg = model.segments[i];
            seg.id = `${r}-${c}`;
            seg.row = r;
            seg.col = c;

            seg.width = layout.colWidths[c];
            seg.height = layout.rowHeights[r];

            // important: write into matrix.x / matrix.y
            seg.matrix.x = layout.colOffset[c];
            seg.matrix.y = layout.rowOffset[r];

            i++;
        }
    }
};

export const updateSegmentGridData = async (model, layout) => {
    if (!model?.segments) return;

    for (const seg of model.segments) {
        const c = seg.col;
        const r = seg.row;

        // set grid size
        seg.width = layout.colWidths[c];
        seg.height = layout.rowHeights[r];

        // write offset into matrix
        seg.matrix.x = layout.colOffset[c];
        seg.matrix.y = layout.rowOffset[r];
    }
};