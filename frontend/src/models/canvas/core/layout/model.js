// Layout / Grid utilities for the canvas environment
// Exports:
//  - computeLayout(canvas, rows, columns, viewport = {})  -> { isSingle, colWidths, rowHeights, colOffset, rowOffset }

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