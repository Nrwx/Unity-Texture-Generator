import {ref} from "vue";
import {v4 as uuidv4} from "uuid";

export const localData = {
    loading: ref(false),
    viewport: ref({id: uuidv4(), width: 1024, height: 1024, mode: 1, title: 'Unbekannt', layer: 'Ebene'}),
    file: ref(null),
    output: ref(''),
    dimension: ref({width: 1024, height: 1024}),
    layers: ref([]),
    channel: ref([]),
    selectedLayers: ref([]),
    selectedMaps: ref(["Diffuse Map"]),
    maps: ref(["Diffuse Map", "Normal Map", "Specular Map", "Bump Map", "Light Map", "Alpha Map"]),
    selectedTargetResize: ref(0),
    targetResize: ref([{ title: "Original", value: 0, w: 0, h: 0}, { title: "32x32", value: 1, w: 32, h: 32 }, { title: "64x64", value: 2, w: 64, h: 64 }, { title: "128x128", value: 3, w: 128, h: 128 }, { title: "256x256", value: 4, w: 256, h: 256 }, { title: "512x512", value: 5, w: 512, h: 512 }, { title: "1024x1024", value: 6, w: 1024, h: 1024 }, { title: "2048x2048", value: 7, w: 2048, h: 2048 }, { title: "4096x4096", value: 8, w: 4096, h: 4096 }, { title: "8192x8192", value: 9, w: 8192, h: 8192 },]),
    selectedTargetResizeOption: ref(0),
    targetResizeOption: ref([{ title: "Auto-Crop", value: 0 }, { title: "Padding", value: 1 }]),
    selectedUpscaleMethod: ref(1),
    upscaleMethods: ref([{ title: "Nearest Neighbor (Pixel-Style)", value: 0 }, { title: "Bicubic / Bilinear", value: 1 }, { title: "AI Scale", value: 2 }]),
    selectedMapAutoOptimize: ref(0),
    mapAutoOptimize: ref([{ title: "Original", value: 0 }, { title: "RGB", value: 1 }, { title: "RGBA", value: 2 }]),
    selectedRgb: ref(0),
    rgbMode: ref([
        {
            value: 0,
            title: "Original",
            subtitle: "Keine Farbveränderung oder Konvertierung.",
            icon: "mdi-palette"
        },
        {
            value: 1,
            title: "sRGB → Linear",
            subtitle: "Farbwerte werden linearisiert (z.B. für Shader).",
            icon: "mdi-chart-bell-curve"
        },
        {
            value: 2,
            title: "Linear → sRGB",
            subtitle: "Lineare Farben in sRGB-Farbraum konvertieren.",
            icon: "mdi-chart-line"
        },
        {
            value: 3,
            title: "Tonemapping",
            subtitle: "Farbwerte auf spieltypische Range begrenzen.",
            icon: "mdi-tune-variant"
        },
        {
            value: 4,
            title: "Kontrast erhöhen",
            subtitle: "Verstärkt Unterschiede in dunklen/hellen Bereichen.",
            icon: "mdi-brightness-7"
        },
        {
            value: 5,
            title: "Gamma-Korrektur",
            subtitle: "RGB-Werte werden mit Gamma angepasst.",
            icon: "mdi-circle-slice-3"
        },
        {
            value: 6,
            title: "Desaturieren",
            subtitle: "Farben werden reduziert – monochromatischer Look.",
            icon: "mdi-invert-colors-off"
        },
        {
            value: 7,
            title: "Farbbereich beschneiden",
            subtitle: "RGB-Clipping bei <0 oder >255.",
            icon: "mdi-content-cut"
        },
        {
            value: 8,
            title: "Farbanalyse/Debug",
            subtitle: "Visualisierung von RGB als Debugmap.",
            icon: "mdi-bug-outline"
        },
        {
            value: 9,
            title: "Fake HDR Boost",
            subtitle: "Helle Bereiche verstärken für stilisierte Wirkung.",
            icon: "mdi-white-balance-sunny"
        },
        {
            value: 10,
            title: "Invert RGB",
            subtitle: "RGB-Farben werden invertiert.",
            icon: "mdi-invert-colors"
        },
        {
            value: 11,
            title: "Normalize RGB",
            subtitle: "RGB-Kanäle auf einheitliche Range normalisieren.",
            icon: "mdi-tune"
        },
        {
            value: 12,
            title: "Heatmap Visualisierung",
            subtitle: "RGB → Heatmap-Look (z.B. für Masken).",
            icon: "mdi-fire"
        }
    ]),
    selectedRgba: ref(0),
    rgbaMode: ref([
        {
            value: 0,
            title: "Original",
            subtitle: "Keine Farbveränderung oder Konvertierung.",
            icon: "mdi-alpha-a-box"
        },
        {
            value: 1,
            title: "Straight Alpha",
            subtitle: "RGB bleibt erhalten, Alpha unverändert.",
            icon: "mdi-alpha"
        },
        {
            value: 2,
            title: "Premultiplied Alpha",
            subtitle: "RGB wird mit Alpha multipliziert (RGB * A).",
            icon: "mdi-blur"
        },
        {
            value: 3,
            title: "Binary Alpha",
            subtitle: "Alpha wird zu Schwarz/Weiß maske (>0.5 = sichtbar).",
            icon: "mdi-opacity"
        },
        {
            value: 4,
            title: "Clean Alpha",
            subtitle: "Alpha wird auf 256 Stufen quantisiert.",
            icon: "mdi-contrast"
        },
        {
            value: 5,
            title: "DXT5 Alpha Clamp",
            subtitle: "Alpha <8 = 0, >248 = 255 (für DXT5-Formate).",
            icon: "mdi-cube-outline"
        },
        {
            value: 6,
            title: "DXT1 1-bit Alpha",
            subtitle: "Harter Cut – 1-Bit Alpha für DXT1.",
            icon: "mdi-cube-scan"
        },
        {
            value: 7,
            title: "DXT1 ColorKey",
            subtitle: "RGB-Schwarz wird als vollständig transparent interpretiert.",
            icon: "mdi-color-helper"
        },
        {
            value: 8,
            title: "DXT3 4-bit Alpha",
            subtitle: "Alpha mit 16 festen Stufen (4-Bit).",
            icon: "mdi-grid-large"
        },
        {
            value: 9,
            title: "Alpha Threshold Map",
            subtitle: "Alpha in Graustufen-Map gewandelt.",
            icon: "mdi-image-filter-hdr"
        },
        {
            value: 10,
            title: "Alpha Boost",
            subtitle: "Alpha-Kontrast erhöht – sichtbarere Übergänge.",
            icon: "mdi-brightness-6"
        },
        {
            value: 11,
            title: "Soft Cutout",
            subtitle: "Weicher Übergang von sichtbar zu transparent.",
            icon: "mdi-gesture-tap-hold"
        },
        {
            value: 12,
            title: "Invert Alpha",
            subtitle: "Alpha wird invertiert – Sichtbares wird unsichtbar.",
            icon: "mdi-invert-colors"
        },
        {
            value: 13,
            title: "Clamp Alpha",
            subtitle: "Alpha wird auf definierten Bereich begrenzt.",
            icon: "mdi-filter-outline"
        },
        {
            value: 14,
            title: "Remove Alpha",
            subtitle: "Alpha wird entfernt – RGB bleibt erhalten.",
            icon: "mdi-alpha-x-box"
        }
    ]),
    buildId: ref(''),
    builds: ref([]),
    sort: ref("newest"),
    animation: ref([]),
    tile: ref({x: 1, y: 1}),
    selectedShape: ref('rectangle'), // oder 'rectangle' | 'square' | 'circle'
    selectedBlendMode: ref(0),
    blend_mode: ref([
        { title: "Normal", value: 0 },
        { title: "Sprenkeln", value: 1 },
        { title: "Abdunkeln", value: 2 },
        { title: "Multiplizieren", value: 3 },
        { title: "Farbig nachdunkeln", value: 4 },
        { title: "Linear nachbelichten", value: 5 },
        { title: "Aufhellen", value: 6 },
        { title: "Negativ Multiplizieren", value: 7 },
        { title: "Farbig Abwedeln", value: 8 },
        { title: "Linear Abwedeln", value: 9 },
        { title: "Hellere Farbe", value: 10 },
        { title: "Überlagern", value: 11 },
        { title: "Weiches Licht", value: 12 },
        { title: "Hartes Licht", value: 13 },
        { title: "Strahlendes Licht", value: 14 },
        { title: "Lineares Licht", value: 15 },
        { title: "Lichtpunkt", value: 16 },
        { title: "Hart mischen", value: 17 },
        { title: "Differenz", value: 18 },
        { title: "Subtrahieren", value: 19 },
        { title: "Dividieren", value: 20 },
        { title: "Farbton", value: 21 },
        { title: "Sättigung", value: 22 },
        { title: "Farbe", value: 23 },
        { title: "Luminanz", value: 24 },
    ]),
}