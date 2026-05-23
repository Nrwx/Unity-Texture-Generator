/**
 * Small floating-point tolerance used for geometric
 * and numerical comparisons.
 *
 * Useful when checking:
 * - parallel vectors
 * - ray-plane intersections
 * - degenerate triangles
 * - near-zero lengths
 * - floating-point precision issues
 *
 * @example
 * if (Math.abs(value) < EPSILON) {
 *     // treat as zero
 * }
 */
export const EPSILON = 1e-7;

/**
 * Immutable unit axis vectors for 3D space.
 *
 * Used as canonical basis vectors for transformations,
 * projections, and directional math in the engine.
 *
 * Representation:
 * - x → [1, 0, 0]
 * - y → [0, 1, 0]
 * - z → [0, 0, 1]
 *
 * These vectors are intentionally frozen to guarantee
 * referential stability in hot-path computations.
 */
export const AXIS_VECTORS = Object.freeze({
    x: Object.freeze([1, 0, 0]),
    y: Object.freeze([0, 1, 0]),
    z: Object.freeze([0, 0, 1]),
});

/**
 * Immutable plane basis vectors for 3D space.
 *
 * Each entry defines a 2D subspace within ℝ³
 * using canonical axis vectors.
 *
 * Used for:
 * - projections
 * - planar transformations
 * - 2D-to-3D mappings
 */
export const PLANE_AXES = Object.freeze({
    xy: Object.freeze([
        Object.freeze([1, 0, 0]),
        Object.freeze([0, 1, 0]),
    ]),
    xz: Object.freeze([
        Object.freeze([1, 0, 0]),
        Object.freeze([0, 0, 1]),
    ]),
    yz: Object.freeze([
        Object.freeze([0, 1, 0]),
        Object.freeze([0, 0, 1]),
    ]),
});

/**
 * Normal vectors for canonical planes in 3D space.
 * Used for ray-plane intersection and camera-aligned transforms.
 */
export const AXIS_PLANES = Object.freeze({
    xy: Object.freeze([0, 0, 1]),
    yx: Object.freeze([0, 0, 1]),

    xz: Object.freeze([0, 1, 0]),
    zx: Object.freeze([0, 1, 0]),

    yz: Object.freeze([1, 0, 0]),
    zy: Object.freeze([1, 0, 0]),
});

/**
 * Conversion factor from radians to degrees.
 *
 * Used to convert mathematical radian values (used in trig functions,
 * rotations, quaternions, etc.) into human-readable degrees.
 *
 * Formula:
 * degrees = radians * (180 / π)
 */
export const DEG = 180 / Math.PI;

/**
 * Converts radians to degrees.
 *
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 *
 * @example
 * toDeg(Math.PI) // 180
 * toDeg(Math.PI / 2) // 90
 */
export const toDeg = (radians) => radians * DEG;

/**
 * Checks whether a value is a finite number.
 *
 * Hot-path optimized predicate used in math and 3D engine operations.
 * This version avoids Number() coercion and only accepts real JS numbers.
 *
 * Behavior:
 * - Returns true for valid finite numbers
 * - Returns false for NaN, Infinity, -Infinity
 * - Returns false for all non-number types (including numeric strings)
 *
 * @param {*} value - Value to check.
 * @returns {boolean} True if value is a finite number, otherwise false.
 *
 * @example
 * isFiniteNumber(10); // true
 * isFiniteNumber(NaN); // false
 * isFiniteNumber(Infinity); // false
 * isFiniteNumber("10"); // false
 * isFiniteNumber(null); // false
 */
export const isFiniteNumber = (value) => {
    return typeof value === "number" && value === value && value !== Infinity && value !== -Infinity;
};

/**
 * Converts any value into a finite number.
 *
 * Core numeric sanitizer for the math engine.
 * This is the single source of truth for number coercion.
 *
 * Behavior:
 * - Coerces input via Number()
 * - Returns fallback if NaN or non-finite
 *
 * Hot-path optimized for math/3D operations.
 *
 * @param {*} value - Input value
 * @param {number} [fallback=0] - Fallback if invalid
 * @returns {number} Finite number
 */
export const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};