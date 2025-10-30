import {canvasEnvironment} from "@/models/canvas/config/model";

/**
 * Lädt ein Bild aus dem Cache oder erstellt ein neues Image-Objekt.
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
export const loadImage = (url) => {
    return new Promise((resolve, reject) => {
        if (canvasEnvironment.value.cache.has(url)) {
            const cached = canvasEnvironment.value.cache.get(url);
            if (cached?.complete) return resolve(cached);
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            canvasEnvironment.value.cache.set(url, img);
            resolve(img);
        };
        img.onerror = reject;
        img.src = url;
    });
};