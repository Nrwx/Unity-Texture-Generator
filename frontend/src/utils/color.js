import {clamp, mixNumbers, toFiniteNumber} from "@/utils/tools";

/**
 * Adjusts a HEX color by adding an amount to each RGB channel.
 *
 * This internal helper is used as the shared bridge for `lighten` and `darken`.
 * It supports both short and full HEX colors and assumes that `hex` is a valid
 * HEX color string and `amt` is a number.
 *
 * @param {string} hex - The HEX color to adjust.
 * @param {number} amt - The amount to add to each RGB channel.
 * @returns {string} The adjusted HEX color.
 *
 * @example
 * adjustHex("#000000", 20); // "#141414"
 * adjustHex("#ffffff", -20); // "#ebebeb"
 */

const adjustHex = (hex, amt) => {
    let col = hex.charCodeAt(0) === 35 ? hex.slice(1) : hex;

    if (col.length === 3) {
        col = col[0] + col[0] + col[1] + col[1] + col[2] + col[2];
    }

    const num = parseInt(col, 16);

    let r = (num >> 16) + amt;
    let g = ((num >> 8) & 255) + amt;
    let b = (num & 255) + amt;

    r = clamp(r, 0, 255);
    g = clamp(g, 0, 255);
    b = clamp(b, 0, 255);

    return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
};

/**
 * Lightens a HEX color by adding an amount to each RGB channel.
 *
 * Supports both short and full HEX colors:
 * - `#fff`
 * - `#ffffff`
 *
 * @param {string} hex - The HEX color to lighten.
 * @param {number} amt - The amount to add to each RGB channel.
 * @returns {string} The lightened HEX color.
 *
 * @example
 * lighten("#000000", 20); // "#141414"
 * lighten("#abc", 10); // "#b5c6d7"
 */
export const lighten = (hex, amt) => adjustHex(hex, amt);

/**
 * Darkens a HEX color by subtracting an amount from each RGB channel.
 *
 * Supports both short and full HEX colors:
 * - `#fff`
 * - `#ffffff`
 *
 * @param {string} hex - The HEX color to darken.
 * @param {number} amt - The amount to subtract from each RGB channel.
 * @returns {string} The darkened HEX color.
 *
 * @example
 * darken("#ffffff", 20); // "#ebebeb"
 * darken("#abc", 10); // "#a1b2c3"
 */
export const darken = (hex, amt) => adjustHex(hex, -amt);

/**
 * Parses a CSS color string into RGBA channel values.
 *
 * This function uses a shared canvas context internally, which allows the
 * browser to parse any valid CSS color format supported by `fillStyle`.
 * Parsed colors are cached by input string for faster repeated lookups.
 *
 * Supports values such as:
 * - HEX colors: `#fff`, `#ffffff`
 * - RGB/RGBA colors: `rgb(255, 0, 0)`, `rgba(255, 0, 0, 0.5)`
 * - HSL/HSLA colors
 * - Named CSS colors: `red`, `transparent`, etc.
 *
 * Assumes that `color` is a valid CSS color string and that the code runs in a
 * browser environment where `document` and `canvas` are available.
 *
 * @param {string} color - The CSS color string to parse.
 * @returns {{ r: number, g: number, b: number, a: number }} The parsed RGBA color.
 *
 * @example
 * parseColor("#ff0000"); // { r: 255, g: 0, b: 0, a: 1 }
 * parseColor("rgba(255, 0, 0, 0.5)"); // { r: 255, g: 0, b: 0, a: 0.5019607843137255 }
 * parseColor("transparent"); // { r: 0, g: 0, b: 0, a: 0 }
 */
export const parseColor = (() => {
    const cache = {};
    const context = document.createElement('canvas').getContext('2d');
    return (str) => {
        if (cache[str]) return cache[str];
        context.fillStyle = str;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
        cache[str] = {
            r,
            g,
            b,
            a: a / 255
        };
        return cache[str];
    };
})();

const HEX_TO_INT = new Int8Array(103);

for (let i = 0; i < HEX_TO_INT.length; i++) {
    HEX_TO_INT[i] = -1;
}

for (let i = 48; i <= 57; i++) {
    HEX_TO_INT[i] = i - 48;
}

for (let i = 65; i <= 70; i++) {
    HEX_TO_INT[i] = i - 55;
}

for (let i = 97; i <= 102; i++) {
    HEX_TO_INT[i] = i - 87;
}

const INV_255 = 1 / 255;
const HEX_SHORT_SCALE = 17 * INV_255;

/**
 * Converts a HEX color string into a normalized RGB or RGBA array.
 *
 * Optimized for performance-sensitive paths:
 * - no regex
 * - no parseInt
 * - no split/map/join
 * - no padEnd/slice
 * - optional output array reuse
 *
 * Supported input:
 * - "#fff"
 * - "fff"
 * - "#ffffff"
 * - "ffffff"
 *
 * Supported modes:
 * - "rgb"  -> [r, g, b]
 * - "rgba" -> [r, g, b, a]
 *
 * Invalid input falls back to white.
 *
 * @param {string} [hex="#ffffff"] - HEX color string.
 * @param {number} [alpha=1] - Alpha value between 0 and 1.
 * @param {"rgb"|"rgba"} [mode="rgba"] - Output mode.
 * @param {number[]} [out] - Optional output array to avoid allocations.
 * @returns {number[]} Normalized RGB or RGBA array.
 *
 * @example
 * hexToRgbaArray("#ff0000");
 * // [1, 0, 0, 1]
 *
 * @example
 * hexToRgbaArray("#ff0000", 1, "rgb");
 * // [1, 0, 0]
 *
 * @example
 * const out = [0, 0, 0, 1];
 * hexToRgbaArray("#336699", 0.8, "rgba", out);
 * // out === [0.2, 0.4, 0.6, 0.8]
 */
export const hexToRgbaArray = (
    hex = "#ffffff",
    alpha = 1,
    mode = "rgba",
    out
) => {
    const isRgb = mode === "rgb";
    const result = out || (isRgb ? [1, 1, 1] : [1, 1, 1, 1]);

    let a = alpha;

    if (a !== a) {
        a = 1;
    } else if (a < 0) {
        a = 0;
    } else if (a > 1) {
        a = 1;
    }

    if (typeof hex !== "string") {
        result[0] = 1;
        result[1] = 1;
        result[2] = 1;

        if (!isRgb) {
            result[3] = a;
        }

        return result;
    }

    const length = hex.length;
    let offset = 0;
    let digits = length;

    if (hex.charCodeAt(0) === 35) {
        offset = 1;
        digits = length - 1;
    }

    if (digits === 3) {
        const r = HEX_TO_INT[hex.charCodeAt(offset)] ?? -1;
        const g = HEX_TO_INT[hex.charCodeAt(offset + 1)] ?? -1;
        const b = HEX_TO_INT[hex.charCodeAt(offset + 2)] ?? -1;

        if ((r | g | b) < 0) {
            result[0] = 1;
            result[1] = 1;
            result[2] = 1;
        } else {
            result[0] = r * HEX_SHORT_SCALE;
            result[1] = g * HEX_SHORT_SCALE;
            result[2] = b * HEX_SHORT_SCALE;
        }

        if (!isRgb) {
            result[3] = a;
        }

        return result;
    }

    if (digits === 6) {
        const r1 = HEX_TO_INT[hex.charCodeAt(offset)] ?? -1;
        const r2 = HEX_TO_INT[hex.charCodeAt(offset + 1)] ?? -1;
        const g1 = HEX_TO_INT[hex.charCodeAt(offset + 2)] ?? -1;
        const g2 = HEX_TO_INT[hex.charCodeAt(offset + 3)] ?? -1;
        const b1 = HEX_TO_INT[hex.charCodeAt(offset + 4)] ?? -1;
        const b2 = HEX_TO_INT[hex.charCodeAt(offset + 5)] ?? -1;

        if ((r1 | r2 | g1 | g2 | b1 | b2) < 0) {
            result[0] = 1;
            result[1] = 1;
            result[2] = 1;
        } else {
            result[0] = ((r1 << 4) | r2) * INV_255;
            result[1] = ((g1 << 4) | g2) * INV_255;
            result[2] = ((b1 << 4) | b2) * INV_255;
        }

        if (!isRgb) {
            result[3] = a;
        }

        return result;
    }

    result[0] = 1;
    result[1] = 1;
    result[2] = 1;

    if (!isRgb) {
        result[3] = a;
    }

    return result;
};

const BYTE_TO_HEX = new Array(256);

for (let i = 0; i < 256; i++) {
    BYTE_TO_HEX[i] = i < 16
        ? "0" + i.toString(16)
        : i.toString(16);
}

/**
 * Converts a normalized RGB/RGBA array into a HEX color string.
 *
 * Supported modes:
 * - "rgb"  -> expects [r, g, b]
 * - "rgba" -> expects [r, g, b, a], alpha is ignored for HEX output
 *
 * Note:
 * HEX output does not include alpha. The alpha channel is intentionally ignored.
 *
 * Optimized for hot paths:
 * - no per-call helper function
 * - no padStart
 * - no repeated toString(16)
 * - uses a precomputed byte-to-hex lookup table
 *
 * @param {number[]} value - Normalized RGB or RGBA array.
 * @param {"rgb"|"rgba"} [mode="rgba"] - Input mode.
 * @returns {string} HEX color string.
 *
 * @example
 * colorArrayToHex([1, 0, 0], "rgb");
 * // "#ff0000"
 *
 * @example
 * colorArrayToHex([1, 0, 0, 0.5], "rgba");
 * // "#ff0000"
 */
export const colorArrayToHex = (value, mode = "rgba") => {
    if (!Array.isArray(value)) {
        return "#ffffff";
    }

    const requiredLength = mode === "rgb" ? 3 : 4;

    if (value.length < requiredLength) {
        return "#ffffff";
    }

    let r = value[0];
    let g = value[1];
    let b = value[2];

    r = r !== r ? 1 : r < 0 ? 0 : r > 1 ? 1 : r;
    g = g !== g ? 1 : g < 0 ? 0 : g > 1 ? 1 : g;
    b = b !== b ? 1 : b < 0 ? 0 : b > 1 ? 1 : b;

    return "#" +
        BYTE_TO_HEX[(r * 255 + 0.5) | 0] +
        BYTE_TO_HEX[(g * 255 + 0.5) | 0] +
        BYTE_TO_HEX[(b * 255 + 0.5) | 0];
};

/**
 * Normalizes any scalar or array value into an RGBA array.
 *
 * @param {*|number[]} value
 * @param {number[]} [fallback=[1, 1, 1, 1]]
 * @returns {number[]}
 */
export const normalizeColorValue = (value, fallback = [1, 1, 1, 1]) => {
    if (Array.isArray(value)) {
        return [
            clamp(toFiniteNumber(value[0], fallback[0] ?? 1), 0, 1),
            clamp(toFiniteNumber(value[1], fallback[1] ?? 1), 0, 1),
            clamp(toFiniteNumber(value[2], fallback[2] ?? 1), 0, 1),
            clamp(toFiniteNumber(value[3], fallback[3] ?? 1), 0, 1),
        ];
    }

    const number = clamp(toFiniteNumber(value, fallback[0] ?? 1), 0, 1);

    return [number, number, number, 1];
};

/**
 * Calculates luminance from an RGBA-like color value.
 *
 * @param {*|number[]} color
 * @returns {number}
 */
export const luminanceFromColor = color => {
    const value = normalizeColorValue(color, [0, 0, 0, 1]);

    return clamp(
        value[0] * 0.2126 +
        value[1] * 0.7152 +
        value[2] * 0.0722,
        0,
        1
    );
};

/**
 * Mixes two RGBA-like color values.
 *
 * @param {*|number[]} a
 * @param {*|number[]} b
 * @param {*} factor
 * @param {boolean} [shouldClamp=true]
 * @returns {number[]}
 */
export const mixColors = (a, b, factor, shouldClamp = true) => {
    const amount = clamp(toFiniteNumber(factor, 0.5), 0, 1);
    const left = normalizeColorValue(a, [0, 0, 0, 1]);
    const right = normalizeColorValue(b, [1, 1, 1, 1]);

    return left.map((channel, index) => {
        const mixed = mixNumbers(
            channel,
            right[index] ?? (index === 3 ? 1 : 0),
            amount
        );

        return index === 3 || shouldClamp === false
            ? mixed
            : clamp(mixed, 0, 1);
    });
};

/**
 * Converts a Kelvin temperature into normalized RGBA.
 *
 * @param {*} value
 * @returns {number[]}
 */
export const kelvinToColor = value => {
    const temperature = clamp(toFiniteNumber(value, 6500), 1000, 40000) / 100;

    const red = temperature <= 66
        ? 255
        : 329.698727446 * Math.pow(temperature - 60, -0.1332047592);

    const green = temperature <= 66
        ? 99.4708025861 * Math.log(temperature) - 161.1195681661
        : 288.1221695283 * Math.pow(temperature - 60, -0.0755148492);

    const blue = temperature >= 66
        ? 255
        : temperature <= 19
            ? 0
            : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;

    return [
        clamp(red / 255, 0, 1),
        clamp(green / 255, 0, 1),
        clamp(blue / 255, 0, 1),
        1,
    ];
};

/**
 * Applies strength/offset/invert-like interpolation to a scalar value.
 *
 * @param {*} value
 * @param {Object} [settings={}]
 * @returns {number}
 */
export const interpolateValue = (value, settings = {}) => {
    const strength = toFiniteNumber(settings.strength ?? settings.factor ?? 1, 1);
    const offset = toFiniteNumber(settings.offset ?? 0, 0);
    const shouldClamp = settings.clamp !== false;

    const input = strength < 0
        ? 1 - clamp(toFiniteNumber(value ?? 0, 0), 0, 1)
        : toFiniteNumber(value ?? 0, 0);

    const result = input * Math.abs(strength) + offset;

    return shouldClamp ? clamp(result, 0, 1) : result;
};

/**
 * Applies strength/offset/invert-like interpolation to a color.
 *
 * @param {*|number[]} color
 * @param {Object} [settings={}]
 * @returns {number[]}
 */
export const interpolateColor = (color, settings = {}) => {
    const source = Array.isArray(color) ? color : [1, 1, 1, 1];
    const strength = toFiniteNumber(settings.strength ?? settings.factor ?? 1, 1);
    const offset = toFiniteNumber(settings.offset ?? 0, 0);
    const shouldClamp = settings.clamp !== false;

    return source.map((channel, index) => {
        if (index === 3) {
            return channel;
        }

        const input = strength < 0
            ? 1 - clamp(toFiniteNumber(channel ?? 0, 0), 0, 1)
            : toFiniteNumber(channel ?? 0, 0);

        const result = input * Math.abs(strength) + offset;

        return shouldClamp ? clamp(result, 0, 1) : result;
    });
};