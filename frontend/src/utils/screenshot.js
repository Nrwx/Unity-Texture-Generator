import html2canvas from 'html2canvas';

/**
 * Screenshot eines Ausschnitts aus einem HTML-Element
 * @param {HTMLElement} el - Das Ziel-Element
 * @param {Object} config - Screenshot-Konfiguration
 * @param {Object} [crop] - Optionaler Ausschnitt { x, y, width, height }
 * @returns {Promise<string>} - Data-URL PNG (base64)
 */
export const screenshot = async (el, config = {}, crop = null) => {
    if (!el || !(el instanceof HTMLElement)) {
        throw new Error('Ungültiges Element übergeben.');
    }

    const canvas = await html2canvas(el, {
        backgroundColor: config.backgroundColor ?? null,
        scale: config.scale ?? 1,
        useCORS: config.useCORS ?? true
    });

    if (crop && crop.width > 0 && crop.height > 0) {
        const cropped = document.createElement('canvas');
        cropped.width = crop.width;
        cropped.height = crop.height;
        cropped
            .getContext('2d')
            .drawImage(canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
        return cropped.toDataURL('image/png');
    }

    return canvas.toDataURL('image/png');
};