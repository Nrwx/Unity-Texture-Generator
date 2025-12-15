export class FileCache {

    /**
     * @param {FileLoader} loader - FileLoader Instanz zum Laden der Assets
     */
    constructor(loader) {
        this.cache = new Map();
        this.loader = loader;
    }

    /**
     * Prüft, ob eine Datei bereits im Cache liegt
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this.cache.has(key);
    }

    /**
     * Liefert die gecachte Datei zurück
     * @param {string} key
     * @returns {any}
     */
    get(key) {
        return this.cache.get(key);
    }

    /**
     * Speichert eine Datei oder Promise im Cache
     * @param {string} key
     * @param {any} value
     */
    set(key, value) {
        this.cache.set(key, value);
    }

    /**
     * Lädt ein Asset über den übergebenen Loader und speichert es automatisch im Cache
     * @param {string} key - URL oder relativer Pfad
     * @returns {Promise<any>}
     */
    async load(key) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        if (!this.loader) {
            throw new Error("FileCache: Kein FileLoader vorhanden.");
        }

        const promise = this.loader.load(key);
        this.cache.set(key, promise);

        try {
            const result = await promise;
            this.cache.set(key, result); // Promise durch Ergebnis ersetzen
            return result;
        } catch (err) {
            this.cache.delete(key); // Fehlerhafte Load nicht im Cache halten
            throw err;
        }
    }

    /**
     * Leert den Cache
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Entfernt eine Datei aus dem Cache
     * @param {string} key
     */
    remove(key) {
        this.cache.delete(key);
    }
}
