import html2canvas from 'html2canvas';

/**
 * Screenshot eines HTML-Elements erstellen
 * @param {HTMLElement} element - Das HTML-Element, das du capturen willst
 * @returns {Promise<string>} - Ein Data-URL PNG als base64-String
 */
export const screenshot = async (element) => {
    if (!element || !(element instanceof HTMLElement)) {
        throw new Error('Ungültiges Element übergeben.');
    }

    const canvas = await html2canvas(element, {
        backgroundColor: null, // Transparent optional
        scale: 2,              // Höhere Auflösung (z.B. Retina)
        useCORS: true          // Falls externe Bilder enthalten sind
    });

    return canvas.toDataURL('image/png');
};
