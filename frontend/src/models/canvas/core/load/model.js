export class FileLoader {

    /**
     * @param {string} basePath - Basisverzeichnis für relative Engine-Dateien
     */
    constructor(basePath = "") {
        this.basePath = basePath.replace(/\/+$/, ""); // Clean ending slash
    }

    /**
     * lädt *jede* Datei, lokal oder remote
     * @param {string} url
     * @returns {Promise<any>}
     */
    async load(url) {
        const fullUrl = this._resolveURL(url);
        const ext     = this._extension(fullUrl);

        // 1. IMAGES --------------------------------------------------------
        if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
            return await this._loadImage(fullUrl);
        }

        // 2. VIDEOS --------------------------------------------------------
        if (["mp4", "webm", "mov", "ogg"].includes(ext)) {
            return await this._loadVideo(fullUrl);
        }

        // 3. JSON ----------------------------------------------------------
        if (ext === "json") {
            return await this._loadJSON(fullUrl);
        }

        // 4. SHADER / TEXT -------------------------------------------------
        if (["glsl", "txt", "frag", "vert", "gsl"].includes(ext)) {
            return await this._loadText(fullUrl);
        }

        // 5. BINARY --------------------------------------------------------
        if (["bin", "dat", "wasm"].includes(ext)) {
            return await this._loadBinary(fullUrl);
        }

        // 6. Fallback: Text
        return await this._loadText(fullUrl);
    }

    // =============================================================
    // Intern: URL Pfad behandeln
    // =============================================================
    _resolveURL(url) {
        if (/^https?:\/\//.test(url)) return url;             // externe URL
        if (url.startsWith("/")) return url;                  // absolute pfade
        return this.basePath + "/" + url.replace(/^\/+/, ""); // relative pfade
    }

    _extension(url) {
        return url.split("?")[0].split(".").pop().toLowerCase();
    }

    // =============================================================
    // Loader: Image
    // =============================================================
    async _loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    // =============================================================
    // Loader: Video
    // =============================================================
    async _loadVideo(url) {
        return new Promise((resolve, reject) => {
            const video = document.createElement("video");
            video.crossOrigin = "anonymous";
            video.src = url;
            video.preload = "auto";
            video.muted = true;

            video.onloadeddata = () => resolve(video);
            video.onerror = reject;

            video.load();
        });
    }

    // =============================================================
    // Loader: JSON
    // =============================================================
    async _loadJSON(url) {
        return await (await fetch(url)).json();
    }

    // =============================================================
    // Loader: Text/Shader
    // =============================================================
    async _loadText(url) {
        return await (await fetch(url)).text();
    }

    // =============================================================
    // Loader: Binary (ArrayBuffer)
    // =============================================================
    async _loadBinary(url) {
        return await (await fetch(url)).arrayBuffer();
    }
}


import {canvasEnvironment} from "@/models/canvas/config/model";

/**
 * Lädt ein Bild aus dem Cache oder erstellt ein neues Image-Objekt.
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
export const loadImage = (url) => {
    if (typeof url === "string") {
        return new Promise((resolve, reject) => {
            if (!url) return reject('loadImage: no url');

            const cache = canvasEnvironment.cache;

            if (cache.has(url)) {
                const cached = cache.get(url);
                if (cached?.complete) return resolve(cached);
            }

            const img = new Image();
            img.crossOrigin = "anonymous";

            img.onload = () => {
                cache.set(url, img);
                resolve(img);
            };

            img.onerror = (e) => {
                cache.delete(url);
                reject(e);
            };

            img.src = url;
        });
    }
};
