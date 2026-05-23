import {clamp} from "@/utils/tools";

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