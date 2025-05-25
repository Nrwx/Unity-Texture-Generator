/**
 * Normalisiert einen Fontnamen für die Verwendung in CSS.
 * Ersetzt alle Nicht-Alphanumerischen Zeichen durch Unterstriche.
 * Beispiel: "Open Sans" → "Open_Sans"
 *
 * @param {string} name - Der originale Fontname
 * @returns {string} - Der normalisierte Fontname
 */
export function normalizeFontName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, "_");
}

/**
 * Integriert ein @font-face CSS-Regelwerk einmalig ins <head>.
 * Falls bereits vorhanden (via ID), wird kein Duplikat eingefügt.
 *
 * @param {string} name - Der Name der Font-Family (bereits normalisiert)
 * @param {string} url - Pfad zur .ttf-Datei oder font-url
 */
export function injectFontFace(name, url) {
    if (document.getElementById(`font-${name}`)) return;

    const style = document.createElement("style");
    style.id = `font-${name}`;
    style.innerHTML = `
    @font-face {
      font-family: '${name}';
      src: url('fonts${url}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
  `;
    document.head.appendChild(style);
}
