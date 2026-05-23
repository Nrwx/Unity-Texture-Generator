/**
 * Draws an image source onto a canvas element.
 *
 * Loads the image from `src` and draws it onto the provided canvas at its
 * natural size. The canvas is resized to match the image dimensions before
 * drawing.
 *
 * Behavior:
 * - Returns `null` when the canvas or source is missing
 * - Loads the image from `src`
 * - Waits until the image is fully loaded
 * - Resizes the canvas to the image size
 * - Clears the canvas before drawing
 * - Returns the canvas after drawing
 *
 * @param {string} src - The image source URL.
 * @param {HTMLCanvasElement|null|undefined} canvas - The canvas element to draw into.
 * @returns {Promise<HTMLCanvasElement|null>} The canvas after drawing, or `null`.
 *
 * @example
 * await drawToCanvas(src, canvas);
 */
import {uuid} from "@/utils/uuid";
import {clamp} from "@/utils/tools";

export const drawToCanvas = async (src, canvas) => {
    if (!canvas || !src) return null;

    return new Promise((resolve, reject) => {
        const image = new Image();

        image.crossOrigin = "anonymous";

        image.onload = () => {
            const ctx = canvas.getContext("2d", { willReadFrequently: true });

            if (!ctx) {
                resolve(null);
                return;
            }

            const width = image.naturalWidth || image.width;
            const height = image.naturalHeight || image.height;

            canvas.width = width;
            canvas.height = height;

            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(image, 0, 0, width, height);

            resolve(canvas);
        };

        image.onerror = reject;
        image.src = src;
    });
};

/**
 * Creates a normalized 2D point.
 *
 * This utility creates a point object with a generated ID and clamps `x` and
 * `y` between `0` and `1`.
 *
 * Assumes that `x` and `y` are already numbers and that `uuid` and `clamp`
 * are available in scope or imported.
 *
 * @param {number} x - The x position of the point.
 * @param {number} y - The y position of the point.
 * @returns {{ id: string, x: number, y: number }} The created point.
 *
 * @example
 * createPoint(0.5, 0.25);
 * // { id: "...", x: 0.5, y: 0.25 }
 *
 * @example
 * createPoint(-1, 2);
 * // { id: "...", x: 0, y: 1 }
 */
export const createPoint = (x, y) => ({
    id: uuid("canvas-point"),
    x: clamp(x),
    y: clamp(y),
});