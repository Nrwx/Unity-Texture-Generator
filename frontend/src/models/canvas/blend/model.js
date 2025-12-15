export const blendMode = [
    { key: 0,  title: "Normal",        subtitle: "Standard-Modus",      value: "source-over" },
    { key: 1, title: "Multiply",      subtitle: "Multiplikation",     value: "multiply" },
    { key: 2, title: "Screen",        subtitle: "Aufhellen",          value: "screen" },
    { key: 3, title: "Overlay",       subtitle: "Overlay",            value: "overlay" },
    { key: 4, title: "Darken",        subtitle: "Dunkler",            value: "darken" },
    { key: 5, title: "Lighten",       subtitle: "Heller",             value: "lighten" },
    { key: 6, title: "Color Dodge",   subtitle: "Farbdodge",          value: "color-dodge" },
    { key: 7, title: "Color Burn",    subtitle: "Farbverbrennen",     value: "color-burn" },
    { key: 8, title: "Hard Light",    subtitle: "Hartes Licht",       value: "hard-light" },
    { key: 9, title: "Soft Light",    subtitle: "Weiches Licht",      value: "soft-light" },
    { key: 10, title: "Difference",    subtitle: "Differenz",          value: "difference" },
    { key: 11, title: "Exclusion",     subtitle: "Exklusiv",           value: "exclusion" },
    { key: 12, title: "Hue",           subtitle: "Farbton",            value: "hue" },
    { key: 13, title: "Saturation",    subtitle: "Sättigung",          value: "saturation" },
    { key: 14, title: "Color",         subtitle: "Farbe",              value: "color" },
    { key: 15, title: "Luminosity",    subtitle: "Helligkeit",         value: "luminosity" },
    { key: 16, title: "Source In",     subtitle: "Quelle innerhalb Ziel", value: "source-in" },
    { key: 17, title: "Source Out",    subtitle: "Quelle außerhalb Ziel", value: "source-out" },
    { key: 18, title: "Source Atop",   subtitle: "Quelle auf Ziel",    value: "source-atop" },
    { key: 19, title: "Destination Over", subtitle: "Ziel hinter Quelle", value: "destination-over" },
    { key: 20, title: "Destination In",   subtitle: "Ziel innerhalb Quelle", value: "destination-in" },
    { key: 21, title: "Destination Out",  subtitle: "Ziel außerhalb Quelle", value: "destination-out" },
    { key: 22, title: "Destination Atop", subtitle: "Ziel auf Quelle", value: "destination-atop" },
    { key: 23, title: "Lighter",       subtitle: "Additive Mischung",  value: "lighter" },
    { key: 24, title: "Copy",          subtitle: "Quelle ersetzt Ziel", value: "copy" },
    { key: 25, title: "XOR",           subtitle: "Exklusiv Oder",     value: "xor" }
];

export const blendModeMap = (mode) => {
    if (typeof mode === "number") {
        return blendMode.find(x => x.key === mode).value || "source-over";
    }
    if (typeof mode === "string") {
        return blendMode.find(x => x.value === mode).value || blendMode.find(x => x.title === mode).value || "source-over";
    }
    return "source-over";
};

// Kleiner helper für blend-mode (nur die gängigen)
export const applyWebGLBlendMode = (gl, mode) => {
    gl.enable(gl.BLEND);
    switch (mode) {
        case "multiply":
            gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
            break;
        case "screen":
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
            break;
        case "add":
        case "lighter":
            gl.blendFunc(gl.ONE, gl.ONE);
            break;
        case "copy":
            gl.blendFunc(gl.ONE, gl.ZERO);
            break;
        default:
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.disable(gl.DEPTH_TEST);
};

