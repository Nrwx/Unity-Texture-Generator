/**
 * Stores a shallow copy of a property from a reference object.
 *
 * This utility is useful for saving the original state of a nested property,
 * such as a layer matrix, before it gets modified.
 *
 * Assumes that `ref` is an object and `property` exists on it.
 *
 * @param {Object} ref - The object that contains the property to store.
 * @param {string} property - The property name to copy from `ref`.
 * @param {string} storeKey - The property name where the copied value is stored.
 * @returns {Object} The same reference object.
 *
 * @example
 * store(layer, "matrix", "_originalMatrix");
 */
export const store = (ref, property, storeKey) => {
    ref[storeKey] = { ...ref[property] };

    return ref;
};

export const CLONE_MODE = Object.freeze({
    DEFAULT: "default",
    JSON: "json",
});

const resolveJsonReplacement = (replacement, value, key) => {
    return typeof replacement === "function" ? replacement(value, key) : replacement;
};

/**
 * Creates a JSON.stringify replacer for project payloads and signatures.
 *
 * The default mode matches transport-safe JSON payloads: unsupported values and
 * circular references are omitted. Callers that need a stable signature can
 * enable sorted object keys and provide string tokens for unsupported values.
 *
 * @param {Object} [options] - Replacer behavior.
 * @param {boolean} [options.sortKeys=false] - Sort plain object keys before serialization.
 * @param {*} [options.circularValue] - Replacement for repeated object references.
 * @param {*} [options.functionValue] - Replacement for functions. Can be a callback.
 * @param {*} [options.symbolValue] - Replacement for symbols. Can be a callback.
 * @returns {Function} JSON.stringify replacer.
 */
export const createJsonReplacer = ({
    sortKeys = false,
    circularValue = undefined,
    functionValue = undefined,
    symbolValue = undefined,
} = {}) => {
    const seen = new WeakSet();

    return (key, value) => {
        if (typeof value === "function") {
            return resolveJsonReplacement(functionValue, value, key);
        }

        if (typeof value === "symbol") {
            return resolveJsonReplacement(symbolValue, value, key);
        }

        if (value && typeof value === "object") {
            if (seen.has(value)) {
                return resolveJsonReplacement(circularValue, value, key);
            }

            seen.add(value);

            if (sortKeys && !Array.isArray(value)) {
                return Object.keys(value)
                    .sort()
                    .reduce((result, objectKey) => {
                        result[objectKey] = value[objectKey];
                        return result;
                    }, {});
            }
        }

        return value;
    };
};

/**
 * Creates a deep clone of a value.
 *
 * By default, this utility keeps the previous behavior and uses
 * `structuredClone` for structured-clone-compatible values.
 *
 * Use `CLONE_MODE.JSON` only for plain JSON-compatible data.
 *
 * @param {*} value - The value to clone.
 * @param {"default"|"json"} [mode=CLONE_MODE.DEFAULT] - The clone strategy.
 * @returns {*} A deep-cloned value.
 */
export const clone = (value, mode = CLONE_MODE.DEFAULT) => {
    if (mode === CLONE_MODE.JSON) {
        return JSON.parse(JSON.stringify(value));
    }

    return structuredClone(value);
};

/**
 * Clamps a numeric value between a minimum and maximum boundary.
 *
 * This function is optimized for hot paths and assumes that `value`, `min`,
 * and `max` are already numbers. It does not parse strings or validate bounds.
 *
 * When only `value` is provided, it behaves like `clamp01` and clamps the value
 * between `0` and `1`.
 *
 * Behavior:
 * - Returns `min` if `value` is `NaN`
 * - Returns `min` if `value` is smaller than `min`
 * - Returns `max` if `value` is greater than `max`
 * - Otherwise returns `value`
 *
 * @param {number} value - The number to clamp.
 * @param {number} [min=0] - The lower boundary.
 * @param {number} [max=1] - The upper boundary.
 * @returns {number} The clamped number.
 *
 * @example
 * clamp(1.5); // 1
 * clamp(-0.2); // 0
 * clamp(0.5); // 0.5
 *
 * @example
 * clamp(10, 0, 5); // 5
 * clamp(-1, 0, 5); // 0
 * clamp(3, 0, 5); // 3
 * clamp(NaN, 0, 5); // 0
 */
export const clamp = (value, min = 0, max = 1) => {
    if (value !== value) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
};

/**
 * Clamps a numeric value between two boundaries, regardless of their order.
 *
 * This function is useful when the lower and upper boundaries are dynamic
 * and may be passed in either order. It assumes that `value`, `a`, and `b`
 * are already numbers.
 *
 * Behavior:
 * - Uses the smaller of `a` and `b` as the lower boundary
 * - Uses the larger of `a` and `b` as the upper boundary
 * - Returns the clamped `value`
 * - Delegates the final clamping logic to `clamp`
 *
 * @param {number} value - The number to clamp.
 * @param {number} a - The first boundary.
 * @param {number} b - The second boundary.
 * @returns {number} The clamped number.
 *
 * @example
 * clampBetween(10, 0, 5); // 5
 * clampBetween(-1, 0, 5); // 0
 * clampBetween(3, 5, 0); // 3
 * clampBetween(10, 5, 0); // 5
 */
export const clampBetween = (value, a, b) => {
    const min = a < b ? a : b;
    const max = a > b ? a : b;

    return clamp(value, min, max);
};

/**
 * Linearly interpolates between two numeric values.
 *
 * This function is optimized for hot paths and assumes that `a`, `b`,
 * and `t` are already numbers. It does not clamp `t`.
 *
 * Behavior:
 * - `t = 0` returns `a`
 * - `t = 1` returns `b`
 * - Values between `0` and `1` return a value between `a` and `b`
 * - Values below `0` or above `1` extrapolate beyond `a` and `b`
 *
 * @param {number} a - The start value.
 * @param {number} b - The end value.
 * @param {number} t - The interpolation factor.
 * @returns {number} The interpolated value.
 *
 * @example
 * lerp(0, 10, 0); // 0
 * lerp(0, 10, 0.5); // 5
 * lerp(0, 10, 1); // 10
 * lerp(0, 10, 1.5); // 15
 */
export const lerp = (a, b, t) => {
    return a + (b - a) * t;
};

/**
 * Normalizes a numeric value within a given range.
 *
 * Converts `value` from the range between `min` and `max` into a normalized
 * progress value. The result is usually between `0` and `1` when `value` is
 * inside the range.
 *
 * Assumes that `value`, `min`, and `max` are already numbers.
 *
 * Behavior:
 * - Returns `0` when `value` equals `min`
 * - Returns `1` when `value` equals `max`
 * - Returns values below `0` or above `1` when `value` is outside the range
 * - Returns `0.5` when `min` and `max` are equal
 *
 * @param {number} value - The value to normalize.
 * @param {number} min - The lower range boundary.
 * @param {number} max - The upper range boundary.
 * @returns {number} The normalized value.
 *
 * @example
 * normalize(50, 0, 100); // 0.5
 * normalize(0, 0, 100); // 0
 * normalize(100, 0, 100); // 1
 * normalize(150, 0, 100); // 1.5
 * normalize(10, 10, 10); // 0.5
 */
export const normalize = (value, min, max) => {
    const range = max - min;

    if (range === 0) return 0.5;

    return (value - min) / range;
};

/**
 * Returns the first item with the matching ID.
 *
 * Searches through the provided items and returns the first item whose `id`
 * matches `id`. Returns `null` when no matching item exists.
 *
 * This utility is generic and can be used for layers, nodes, elements,
 * records, or any object list that uses an `id` property.
 *
 * Assumes that `items` is an array and each item has an `id` property.
 *
 * @param {Array<{ id: * }>} items - The items to search through.
 * @param {*} id - The ID to find.
 * @returns {{ id: * }|null} The matching item, or `null`.
 *
 * @example
 * const layers = [{ id: "background" }, { id: "title" }];
 *
 * getById(layers, "title"); // { id: "title" }
 * getById(layers, "missing"); // null
 */
export const getElById = (items, id) => {
    const item = items.find((item) => item.id === id);

    return item === undefined ? null : item;
};

/**
 * Checks whether values have changed.
 *
 * By default, this function behaves like a fast shallow change detector:
 * it compares only the enumerable properties from `a` against `b`.
 *
 * When `deep` is enabled, nested objects and arrays are compared recursively.
 *
 * Behavior:
 * - Returns `false` when either value is missing
 * - Returns `true` when a property from `a` differs from `b`
 * - Ignores additional properties that only exist in `b`
 * - Uses shallow comparison by default
 * - Uses recursive comparison when `deep` is `true`
 *
 * @param {*} a - The source value to compare.
 * @param {*} b - The target value to compare against.
 * @param {boolean} [deep=false] - Whether to compare nested values recursively.
 * @returns {boolean} `true` when a change is detected, otherwise `false`.
 *
 * @example
 * hasChanged({ x: 10 }, { x: 10 }); // false
 * hasChanged({ x: 10 }, { x: 20 }); // true
 * hasChanged({ x: 10 }, { x: 10, y: 20 }); // false
 * hasChanged({ x: { y: 1 } }, { x: { y: 1 } }); // true
 * hasChanged({ x: { y: 1 } }, { x: { y: 1 } }, true); // false
 */
export const hasChanged = (a, b, deep = false) => {
    if (!a || !b) return false;

    for (const key in a) {
        if (deep) {
            if (hasChanged(a[key], b[key], true)) return true;
        } else if (a[key] !== b[key]) {
            return true;
        }
    }

    return false;
};

/**
 * Returns the bounding rectangle of an element.
 *
 * Accepts a DOM element, a CSS selector string, a raw element ID, or a data
 * attribute lookup object.
 *
 * Assumes that the code runs in a browser environment where `document` is
 * available.
 *
 * Behavior:
 * - Uses DOM elements directly
 * - Resolves CSS selector strings with `document.querySelector`
 * - Resolves raw IDs when no selector match is found
 * - Resolves data attributes with `{ data: "name" }`
 * - Resolves data attribute values with `{ data: "name", value: "example" }`
 * - Returns the element's `DOMRect`
 * - Returns `null` when no valid element is found
 *
 * @param {Element|string|{ data: string, value?: string }|null|undefined} target - The element, selector, ID, or data lookup.
 * @returns {DOMRect|null} The element's bounding rectangle, or `null`.
 *
 * @example
 * getRect(document.body); // DOMRect | null
 *
 * @example
 * getRect("#app"); // DOMRect | null
 *
 * @example
 * getRect("app"); // DOMRect | null
 *
 * @example
 * getRect({ data: "layer" }); // resolves `[data-layer]`
 *
 * @example
 * getRect({ data: "layer", value: "header" }); // resolves `[data-layer="header"]`
 */
export const getRect = (target) => {
    let el = target;

    if (typeof target === "string") {
        el = document.querySelector(target) || document.getElementById(target);
    } else if (target && typeof target === "object" && "data" in target) {
        const selector =
            target.value === undefined
                ? `[data-${target.data}]`
                : `[data-${target.data}="${target.value}"]`;

        el = document.querySelector(selector);
    }

    if (!el || !el.getBoundingClientRect) return null;

    return el.getBoundingClientRect();
};

/**
 * Calculates the Euclidean distance for different dimension modes.
 *
 * This utility supports fixed dimension flags for common distance checks.
 * It assumes that all provided values are already numbers.
 *
 * Supported modes:
 * - `"1D"` uses `dx`
 * - `"2D"` uses `dx` and `dy`
 * - `"3D"` uses `dx`, `dy`, and `dz`
 *
 * @param {number} dx - The distance on the x-axis.
 * @param {number} [dy=0] - The distance on the y-axis.
 * @param {number} [dz=0] - The distance on the z-axis.
 * @param {"1D"|"2D"|"3D"} [mode="2D"] - The distance calculation mode.
 * @returns {number} The calculated distance.
 *
 * @example
 * distance(3, 0, 0, "1D"); // 3
 * distance(3, 4, 0, "2D"); // 5
 * distance(1, 2, 2, "3D"); // 3
 */
export const distance = (dx, dy = 0, dz = 0, mode = "2D") => {
    if (mode === "1D") return Math.abs(dx);
    if (mode === "3D") return Math.sqrt(dx * dx + dy * dy + dz * dz);

    return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculates the intersection of two boxes.
 *
 * Supports 2D and 3D box intersections.
 *
 * Modes:
 * - `"2D"` expects `{ x, y, width, height }`
 * - `"3D"` expects `{ x, y, z, width, height, depth }`
 *
 * Behavior:
 * - Returns `null` when either box is missing
 * - Returns `null` when the boxes do not overlap
 * - Returns the overlapping box when an intersection exists
 *
 * @param {Object|null|undefined} a - The first box.
 * @param {Object|null|undefined} b - The second box.
 * @param {"2D"|"3D"} [mode="2D"] - The intersection mode.
 * @returns {Object|null} The intersection box, or `null`.
 *
 * @example
 * intersect(
 *   { x: 0, y: 0, width: 100, height: 100 },
 *   { x: 50, y: 50, width: 100, height: 100 }
 * );
 * // { x: 50, y: 50, width: 50, height: 50 }
 *
 * @example
 * intersect(
 *   { x: 0, y: 0, z: 0, width: 10, height: 10, depth: 10 },
 *   { x: 5, y: 5, z: 5, width: 10, height: 10, depth: 10 },
 *   "3D"
 * );
 * // { x: 5, y: 5, z: 5, width: 5, height: 5, depth: 5 }
 */
export const intersect = (a, b, mode = "2D") => {
    if (!a || !b) return null;

    const left = a.x > b.x ? a.x : b.x;
    const top = a.y > b.y ? a.y : b.y;

    const rightA = a.x + a.width;
    const rightB = b.x + b.width;
    const bottomA = a.y + a.height;
    const bottomB = b.y + b.height;

    const right = rightA < rightB ? rightA : rightB;
    const bottom = bottomA < bottomB ? bottomA : bottomB;

    if (right <= left || bottom <= top) return null;

    if (mode === "3D") {
        const front = a.z > b.z ? a.z : b.z;

        const backA = a.z + a.depth;
        const backB = b.z + b.depth;
        const back = backA < backB ? backA : backB;

        if (back <= front) return null;

        return {
            x: left,
            y: top,
            z: front,
            width: right - left,
            height: bottom - top,
            depth: back - front,
        };
    }

    return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    };
};

/**
 * Converts a value into a finite number.
 *
 * @param {*} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
export const toFiniteNumber = (value, fallback = 0) => {
    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
};

/**
 * Converts a scalar or array value into a 3D vector.
 *
 * @param {*|number[]} value
 * @param {number[]} [fallback=[0, 0, 0]]
 * @returns {number[]}
 */
export const toVector3 = (value, fallback = [0, 0, 0]) => {
    if (Array.isArray(value)) {
        return [
            toFiniteNumber(value[0], fallback[0] ?? 0),
            toFiniteNumber(value[1], value[0] ?? fallback[1] ?? 0),
            toFiniteNumber(value[2], value[0] ?? fallback[2] ?? 0),
        ];
    }

    const number = toFiniteNumber(value, fallback[0] ?? 0);

    return [number, number, number];
};

/**
 * Mixes two numeric values with a clamped factor.
 *
 * @param {*} a
 * @param {*} b
 * @param {*} factor
 * @returns {number}
 */
export const mixNumbers = (a, b, factor) => {
    const amount = clamp(toFiniteNumber(factor, 0.5), 0, 1);

    return (
        toFiniteNumber(a, 0) * (1 - amount) +
        toFiniteNumber(b, 0) * amount
    );
};

/**
 * Applies a named math operation.
 *
 * @param {string} mode
 * @param {*} a
 * @param {*} b
 * @returns {number}
 */
export const applyMathOperation = (mode, a, b) => {
    const left = toFiniteNumber(a, 0);
    const right = toFiniteNumber(b, 0);

    switch (String(mode || "add").toLowerCase()) {
        case "subtract":
            return left - right;

        case "multiply":
            return left * right;

        case "divide":
            return right === 0 ? left : left / right;

        case "min":
            return Math.min(left, right);

        case "max":
            return Math.max(left, right);

        case "power":
            return Math.pow(left, right);

        case "mix":
            return mixNumbers(left, right, 0.5);

        case "add":
        default:
            return left + right;
    }
};