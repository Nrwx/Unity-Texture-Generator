/**
 * Snaps an angle to the nearest angle increment.
 *
 * This utility is independent from component state and works with any numeric
 * snap angle. It assumes that `angle` and `snapAngle` are already numbers.
 *
 * Behavior:
 * - Returns the nearest multiple of `snapAngle`
 * - Returns `angle` unchanged when `snapAngle` is `0`
 * - Supports positive and negative angles
 *
 * @param {number} angle - The angle to snap.
 * @param {number} snapAngle - The angle increment to snap to.
 * @returns {number} The snapped angle.
 *
 * @example
 * getSnappedAngle(43, 15); // 45
 * getSnappedAngle(37, 15); // 30
 * getSnappedAngle(90, 15); // 90
 * getSnappedAngle(-43, 15); // -45
 */
export const getSnappedAngle = (angle, snapAngle = 15) => {
    if (snapAngle === 0) return angle;

    return Math.round(angle / snapAngle) * snapAngle;
};