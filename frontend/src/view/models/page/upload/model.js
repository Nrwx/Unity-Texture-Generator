import {computed, reactive} from "vue";
import {localData} from "@/dataLayer/local";

export function uploadModel(emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const maps = ["Diffuse Map", "Normal Map", "Specular Map", "Bump Map", "Light Map", "Alpha Map"];

    const targetResize = [
        { title: "Original", value: 0, w: 0, h: 0},
        { title: "32x32", value: 1, w: 32, h: 32 },
        { title: "64x64", value: 2, w: 64, h: 64 },
        { title: "128x128", value: 3, w: 128, h: 128 },
        { title: "256x256", value: 4, w: 256, h: 256 },
        { title: "512x512", value: 5, w: 512, h: 512 },
        { title: "1024x1024", value: 6, w: 1024, h: 1024 },
        { title: "2048x2048", value: 7, w: 2048, h: 2048 },
        { title: "4096x4096", value: 8, w: 4096, h: 4096 },
        { title: "8192x8192", value: 9, w: 8192, h: 8192 }
    ];

    const targetResizeOption = [
        { title: "Auto-Crop", value: 0 },
        { title: "Padding", value: 1 }
    ];

    const upscaleMethods = [
        { title: "Nearest Neighbor (Pixel-Style)", value: 0 },
        { title: "Bicubic / Bilinear", value: 1 },
        { title: "AI Scale", value: 2 }
    ];

    const rgbMode = [
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
    ];

    const rgbaModes = [
        {
            value: 0,
            title: "Original",
            subtitle: "Keine Alpha veränderung oder Konvertierung.",
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
    ];


    const config = reactive({
        method: 9,
        selectedMaps: localData.selectedMaps.value,
        selectedTargetResize: localData.selectedTargetResize.value,
        selectedTargetResizeOption: localData.selectedTargetResizeOption.value,
        selectedUpscaleMethod: localData.selectedUpscaleMethod.value,
        selectedRgb: localData.selectedRgb.value,
        selectedRgba: localData.selectedRgba.value
    })
    const methods = computed(() =>({
        9: {
            selectedMaps: {
                active: true,
                type: "select",
                label: "Zusätzliche Maps",
                title: 'Map-Generierung',
                subtitle: 'Erstellen Sie zusätzlich zu ihrer Upload-Referenz, eine Auswahl an Subtexturen.',
                prependIcon: 'mdi-image-plus-outline',
                options: maps,
                multi: true,
                event: 'apply-maps'
            },
            selectedTargetResize: {
                active: true,
                type: "select",
                label: "Ziel-Skalierung",
                title: 'Resizing/Upscale',
                subtitle: 'Bild-Auflösungsoperationen für eine schnelle saubere Skalierung.',
                prependIcon: 'mdi-image-size-select-large',
                options: targetResize.filter(option =>
                    option.w <= localData.viewport.value.width &&
                    option.h <= localData.viewport.value.height
                ),
                event: 'apply-target-size'
            },
            selectedTargetResizeOption: {
                active: localData.selectedTargetResize.value > 0,
                type: "select",
                label: "Ziel-Skalierungsoption",
                title: 'Power-of-Two Anpassung',
                subtitle: `Bild zuschneiden oder auffüllen auf Größe: ${targetResize[localData.selectedTargetResize.value].title}.`,
                prependIcon: localData.selectedTargetResizeOption.value === 0 ? 'mdi-crop' : 'mdi-crop-free',
                options: targetResizeOption,
                event: 'apply-target-size-option'
            },
            selectedUpscaleMethod: {
                active: localData.selectedTargetResize.value > 0,
                type: "select",
                label: "Ziel-Skalierungsmethode",
                title: 'Resize-Bildprozess',
                subtitle: `Bestimme die Qualität der Vergrößerung (z.B ${upscaleMethods[localData.selectedUpscaleMethod.value].title}).`,
                prependIcon: localData.selectedUpscaleMethod.value === 2 ? 'mdi-robot-outline' : 'mdi-overscan',
                options: upscaleMethods,
                event: 'apply-target-size-method'
            },
            selectedRgb: {
                active: true,
                type: "select",
                label: "Pre RGB Konfiguration",
                title: 'RGB: ' + rgbMode[localData.selectedRgb.value]?.title || 'RGB-Auto-Optimierungs Preset',
                subtitle: rgbMode[localData.selectedRgb.value]?.subtitle || 'Legen Sie Ihr Individuelles RGB Preset fest',
                prependIcon: rgbMode[localData.selectedRgb.value]?.icon || 'mdi-image',
                options: rgbMode,
                event: 'apply-rgb-mode'
            },
            selectedRgba: {
                active: true,
                type: "select",
                label: "Pre RGBA Konfiguration",
                title: 'Alpha: ' + rgbaModes[localData.selectedRgba.value]?.title || 'RGBA-Auto-Optimierungs Preset',
                subtitle: rgbaModes[localData.selectedRgba.value]?.subtitle || 'Legen Sie Ihr Individuelles RGBA Preset fest',
                prependIcon: rgbaModes[localData.selectedRgba.value]?.icon || 'mdi-alpha-a-box',
                options: rgbaModes,
                event: 'apply-rgba-mode'
            },
        },
    }))
    return {
        emitEvent,
        config,
        methods
    };
}

export const uploadProps = {
};