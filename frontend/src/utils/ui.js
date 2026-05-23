/**
 * Returns a human-friendly step size based on a raw step value.
 *
 * The result is rounded up to a "nice" step using the sequence:
 * `1, 2, 5, 10, 20, 50, 100, 200, 500, ...`
 *
 * This is useful for timelines, rulers, chart ticks, grid spacing, zoom levels,
 * and similar UI calculations.
 *
 * Behavior:
 * - Returns `fallback` when `rawStep` is not finite
 * - Returns `fallback` when `rawStep` is smaller than or equal to `0`
 * - Rounds the value up to the next nice `1 / 2 / 5 / 10` step
 *
 * @param {number} rawStep - The raw step value to normalize.
 * @param {number} [fallback=50] - The fallback step for invalid values.
 * @returns {number} The normalized nice step value.
 *
 * @example
 * getNiceStep(3); // 5
 * getNiceStep(12); // 20
 * getNiceStep(87); // 100
 * getNiceStep(250); // 500
 * getNiceStep(0); // 50
 */
export const getNiceStep = (rawStep, fallback = 50) => {
    if (!Number.isFinite(rawStep) || rawStep <= 0) return fallback;

    const exponent = Math.floor(Math.log10(rawStep));
    const base = 10 ** exponent;
    const fraction = rawStep / base;

    if (fraction <= 1) return base;
    if (fraction <= 2) return 2 * base;
    if (fraction <= 5) return 5 * base;

    return 10 * base;
};