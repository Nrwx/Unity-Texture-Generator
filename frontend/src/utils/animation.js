/**
 * Returns the input value unchanged.
 *
 * Produces linear motion without acceleration or deceleration.
 * Assumes that `t` is already a number, usually between `0` and `1`.
 *
 * @param {number} t - The normalized progress value.
 * @returns {number} The unchanged progress value.
 *
 * @example
 * linear(0); // 0
 * linear(0.5); // 0.5
 * linear(1); // 1
 */
import {clamp} from "@/utils/tools";

export const linear = (t) => t;

/**
 * Applies quadratic ease-in interpolation.
 *
 * Starts slowly and accelerates toward the end.
 * Assumes that `t` is already a number, usually between `0` and `1`.
 *
 * @param {number} t - The normalized progress value.
 * @returns {number} The eased progress value.
 *
 * @example
 * easeIn(0); // 0
 * easeIn(0.5); // 0.25
 * easeIn(1); // 1
 */
export const easeIn = (t) => t * t;

/**
 * Applies quadratic ease-out interpolation.
 *
 * Starts quickly and decelerates toward the end.
 * Assumes that `t` is already a number, usually between `0` and `1`.
 *
 * @param {number} t - The normalized progress value.
 * @returns {number} The eased progress value.
 *
 * @example
 * easeOut(0); // 0
 * easeOut(0.5); // 0.75
 * easeOut(1); // 1
 */
export const easeOut = (t) => t * (2 - t);

/**
 * Applies quadratic ease-in-out interpolation.
 *
 * Starts slowly, accelerates through the middle, and decelerates toward
 * the end. Assumes that `t` is already a number, usually between `0` and `1`.
 *
 * @param {number} t - The normalized progress value.
 * @returns {number} The eased progress value.
 *
 * @example
 * easeInOut(0); // 0
 * easeInOut(0.5); // 0.5
 * easeInOut(1); // 1
 */
export const easeInOut = (t) =>
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

/**
 * Calculates a point on a cubic Bézier curve for a given progress value.
 *
 * This function is optimized for numeric hot paths and assumes that all
 * arguments are already numbers. It does not clamp `t`.
 *
 * Behavior:
 * - `t = 0` returns `p0`
 * - `t = 1` returns `p3`
 * - Values between `0` and `1` interpolate along the cubic Bézier curve
 * - Values below `0` or above `1` extrapolate beyond the curve
 *
 * @param {number} t - The progress value, usually between `0` and `1`.
 * @param {number} p0 - The start point.
 * @param {number} p1 - The first control point.
 * @param {number} p2 - The second control point.
 * @param {number} p3 - The end point.
 * @returns {number} The calculated Bézier value.
 *
 * @example
 * cubicBezier(0, 0, 0.25, 0.75, 1); // 0
 * cubicBezier(0.5, 0, 0.25, 0.75, 1); // 0.5
 * cubicBezier(1, 0, 0.25, 0.75, 1); // 1
 */
export const cubicBezier = (t, p0, p1, p2, p3) => {
    const u = 1 - t;

    return (
        u * u * u * p0 +
        3 * u * u * t * p1 +
        3 * u * t * t * p2 +
        t * t * t * p3
    );
};

import { lerp } from "@/utils/tools";

/**
 * Returns the numeric value of a Bézier point.
 *
 * Supports plain numbers and objects with a numeric `value` property.
 *
 * @param {number|{ value: number }} point - The Bézier point.
 * @returns {number} The numeric point value.
 */
const getPointValue = (point) =>
    typeof point === "number" ? point : point.value;

/**
 * Calculates a point on a quadratic Bézier curve.
 *
 * @param {number} t - The progress value, usually between `0` and `1`.
 * @param {number} p0 - The start point.
 * @param {number} p1 - The control point.
 * @param {number} p2 - The end point.
 * @returns {number} The calculated Bézier value.
 */
export const quadraticBezier = (t, p0, p1, p2) => {
    const u = 1 - t;

    return u * u * p0 + 2 * u * t * p1 + t * t * p2;
};

/**
 * Applies easing using a dynamic list of points.
 *
 * Uses optimized paths for common points array:
 * - 2 points: `lerp`
 * - 3 points: `quadraticBezier`
 * - 4 points: `cubicBezier`
 *
 * Falls back to De Casteljau's algorithm for more than 4 points.
 *
 * Each point can either be:
 * - a number
 * - an object with a numeric `value` property
 *
 * For cubic easing with fixed start `0` and end `1`, use:
 *
 * `applyEase(t, [0, cp1, cp2, 1])`
 *
 * This matches:
 *
 * `3 * u * u * t * cp1 + 3 * u * t * t * cp2 + t * t * t`
 *
 * @param {number} t - The normalized progress value.
 * @param {Array<number|{ value: number }>} points - The points, including start and end values.
 * @returns {number} The eased value.
 *
 * @example
 * const cp1 = { value: 0.25 };
 * const cp2 = { value: 0.75 };
 *
 * applyEase(0.5, [0, cp1, cp2, 1]); // 0.5
 *
 * @example
 * applyEase(0.5, [0, 0.25, 0.75, 1]); // 0.5
 *
 * @example
 * applyEase(0.5, [0, 0.2, 0.8, 0.6, 1]); // dynamic points
 */
export const applyEase = (t, points) => {
    const length = points.length;

    if (length === 2) {
        return lerp(
            getPointValue(points[0]),
            getPointValue(points[1]),
            t
        );
    }

    if (length === 3) {
        return quadraticBezier(
            t,
            getPointValue(points[0]),
            getPointValue(points[1]),
            getPointValue(points[2])
        );
    }

    if (length === 4) {
        return cubicBezier(
            t,
            getPointValue(points[0]),
            getPointValue(points[1]),
            getPointValue(points[2]),
            getPointValue(points[3])
        );
    }

    const values = new Array(length);

    for (let i = 0; i < length; i++) {
        values[i] = getPointValue(points[i]);
    }

    for (let size = length - 1; size > 0; size--) {
        for (let i = 0; i < size; i++) {
            values[i] = lerp(values[i], values[i + 1], t);
        }
    }

    return values[0];
};

/**
 * Normalizes a time value to stay within a given start and end time range.
 *
 * This utility is independent from component state or props. It works with any
 * numeric time range and safely handles reversed ranges.
 *
 * Assumes that `time`, `startTime`, and `endTime` are already numbers.
 *
 * Behavior:
 * - Uses the smaller value as the lower boundary
 * - Uses the larger value as the upper boundary
 * - Returns `startTime` when both boundaries are equal
 * - Otherwise clamps `time` between the resolved boundaries
 *
 * @param {number} time - The time value to normalize.
 * @param {number} startTime - The start time of the range.
 * @param {number} endTime - The end time of the range.
 * @returns {number} The normalized time value.
 *
 * @example
 * normalizeTime(50, 0, 100); // 50
 * normalizeTime(-10, 0, 100); // 0
 * normalizeTime(120, 0, 100); // 100
 * normalizeTime(50, 100, 0); // 50
 * normalizeTime(20, 10, 10); // 10
 */
export const normalizeTime = (time, startTime, endTime) => {
    const minTime = startTime < endTime ? startTime : endTime;
    const maxTime = startTime > endTime ? startTime : endTime;

    if (minTime === maxTime) return startTime;

    return clamp(time, minTime, maxTime);
};