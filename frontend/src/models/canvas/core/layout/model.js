// Layout / Grid utilities for the canvas environment
// Exports:
//  - computeLayout(canvas, rows, columns, viewport = {})  -> { isSingle, colWidths, rowHeights, colOffset, rowOffset }
//  - createLayoutCache() -> { getLayout(model), invalidate(model), clear() }
//  - layoutKeyFor(model) (optional helper)

import {canvasEnvironment} from "@/models/canvas/config/model";

export const computeLayout = async (canvas, rows, columns, viewport = {}) => {
    if (!rows || !columns) {
        return {
            isSingle: true,
            colWidths: [canvas.width],
            rowHeights: [canvas.height],
            colOffset: [0],
            rowOffset: [0]
        };
    }

    const cw = canvas.width;
    const ch = canvas.height;

    const colWidths = Array(columns).fill(0);
    const rowHeights = Array(rows).fill(0);

    let usedW = 0, usedH = 0;

    for (let c = 0; c < columns; c++) {
        if (viewport.columns?.[c]?.width) {
            colWidths[c] = viewport.columns[c].width;
            usedW += colWidths[c];
        }
    }

    for (let r = 0; r < rows; r++) {
        if (viewport.rows?.[r]?.height) {
            rowHeights[r] = viewport.rows[r].height;
            usedH += rowHeights[r];
        }
    }

    const freeW = cw - usedW;
    const freeH = ch - usedH;

    const dynCols = colWidths.filter(w => w === 0).length || 1;
    const dynRows = rowHeights.filter(h => h === 0).length || 1;

    for (let c = 0; c < columns; c++)
        if (colWidths[c] === 0) colWidths[c] = Math.floor(freeW / dynCols);

    for (let r = 0; r < rows; r++)
        if (rowHeights[r] === 0) rowHeights[r] = Math.floor(freeH / dynRows);

    const colOffset = colWidths.map((_, i) => colWidths.slice(0, i).reduce((a, b) => a + b, 0));
    const rowOffset = rowHeights.map((_, i) => rowHeights.slice(0, i).reduce((a, b) => a + b, 0));

    return {isSingle: false, colWidths, rowHeights, colOffset, rowOffset};
};

export const getLayout = (model) => {
    if (!model || !model.canvas) {
        return { isSingle: true, colWidths: [0], rowHeights: [0], colOffset: [0], rowOffset: [0] };
    }
    const key = keyLayout(model);
    const entry = canvasEnvironment.value.layout.get(model);
    if (entry && entry?.key === key) {
        return entry?.layout;
    }
    const layout = computeLayout(model.canvas, model.rows, model.columns, model.viewport || {});
    canvasEnvironment.value.layout.set(model, { key, layout });
    return layout;
}

export const deleteLayout = (model) => {
    canvasEnvironment.value.layout.delete(model);
};

export const keyLayout = (model) => {
    if (!model || !model.canvas) return '';
    const viewport = model.viewport || {};
    try {
        return `${model.canvas.width}x${model.canvas.height}|r${model.rows}|c${model.columns}|${JSON.stringify(viewport)}`;
    } catch (e) {
        return `${model.canvas.width}x${model.canvas.height}|r${model.rows}|c${model.columns}|${String(viewport)}`;
    }
};