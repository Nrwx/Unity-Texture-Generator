// getTextSize.js

/**
 * Misst den Textinhalt eines <textarea> oder ähnlichen Elements
 * und passt props.layer.width/height so an, dass er genau um den Text passt.
 *
 * @param {HTMLElement} textEl - Das textarea- oder Textelement, dessen Inhalt gemessen wird.
 * @param {Object} layer - Das Layer-Objekt, das width/height enthält.
 * @param {HTMLElement} overlayEl - Das Overlay-Element (für Skalierungskorrektur).
 * @param {Object} [opts] - Optionen
 * @param {number} [opts.minWidth=10] - Mindestbreite
 * @param {number} [opts.minHeight=10] - Mindesthöhe
 */
export function getTextSize(textEl, layer, overlayEl, opts = {}) {
    const MIN_W = opts.minWidth ?? 10;
    const MIN_H = opts.minHeight ?? 10;

    if (!textEl || !layer) return;

    const measureTextSize = (el) => {
        const style = window.getComputedStyle(el);
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.visibility = 'hidden';
        div.style.whiteSpace = 'pre';
        div.style.pointerEvents = 'none';
        div.style.boxSizing = 'content-box';
        div.style.fontFamily = style.fontFamily;
        div.style.fontSize = style.fontSize;
        div.style.fontWeight = style.fontWeight;
        div.style.fontStyle = style.fontStyle;
        div.style.fontVariant = style.fontVariant;
        div.style.lineHeight = style.lineHeight;
        div.style.letterSpacing = style.letterSpacing;
        div.style.textTransform = style.textTransform;
        div.style.textDecoration = style.textDecoration;

        div.style.padding = "0";
        div.style.border = "0";
        div.style.margin = "0";

        const text = el.value || el.innerText || '';
        div.textContent = text.length ? text : ' ';

        document.body.appendChild(div);
        const measuredWidth = Math.ceil(div.getBoundingClientRect().width);
        const measuredHeight = Math.ceil(div.getBoundingClientRect().height);
        document.body.removeChild(div);

        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        const paddingRight = parseFloat(style.paddingRight) || 0;
        const paddingTop = parseFloat(style.paddingTop) || 0;
        const paddingBottom = parseFloat(style.paddingBottom) || 0;

        const borderH = (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
        const borderV = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);

        return {
            width: measuredWidth + paddingLeft + paddingRight + borderH,
            height: measuredHeight + paddingTop + paddingBottom + borderV
        };
    };

    const measured = measureTextSize(textEl);

    // Skalierungskorrektur ermitteln
    let scale = 1;
    if (overlayEl) {
        const overlayRect = overlayEl.getBoundingClientRect();
        const overlayClientWidth = overlayEl.clientWidth || overlayRect.width;
        const overlayClientHeight = overlayEl.clientHeight || overlayRect.height;
        const scaleX = overlayClientWidth ? (overlayRect.width / overlayClientWidth) : 1;
        const scaleY = overlayClientHeight ? (overlayRect.height / overlayClientHeight) : 1;
        scale = (scaleX + scaleY) / 2 || 1;
    }

    // Werte anwenden (in logische Pixel umrechnen)
    layer.width = Math.max(MIN_W, Math.round(measured.width / scale));
    layer.height = Math.max(MIN_H, Math.round(measured.height / scale));
}
