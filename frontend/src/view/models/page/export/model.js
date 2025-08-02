import {appData} from "@/dataLayer/local";
import {computed, reactive, ref} from "vue";
import {exportData} from "@/models/export/config/model";

export function exportModel(props, emit) {

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const setting = ref({
        title: 'Projekt-Export',
        fullscreen: true,
        emit: 'export-state'
    });

    const exportTypes = {
        0: [
            { title: '.jpeg', value: 'JPEG' },
            { title: '.png', value: 'PNG' },
            { title: '.tga', value: 'TGA' },
            { title: '.dds', value: 'DDS' }
        ],
        1: [
            { title: '.svg', value: 'SVG' }
        ],
        2: [
            { title: '.pdf', value: 'PDF' }
        ]
    };

    const computedType = computed({
        get() {
            const allowed = exportTypes[exportData.value.mode] || [];
            const current = exportData.value.type;
            return allowed.includes(current) ? current : allowed.find(x => x.value === current);
        },
        set(val) {
            emitEvent('export:type', val);
        }
    });

    const config = reactive({
        method: 43,
        mode: exportData.value.mode,
        quality: exportData.value.quality,
        get type() {
            return computedType.value;
        },
        set type(val) {
            computedType.value = val;
        },
        dpi: exportData.value.dpi,
        title: exportData.value.title,
        compress: exportData.value.compress,
        inlineCss: exportData.value.inlineCss,
        paperSize: exportData.value.paperSize,
        landscape: exportData.value.landscape,
        margin: exportData.value.margin,
        mipmap: exportData.value.mipmap,
        ddsCompress: exportData.value.ddsCompress,
    });

    const operation = computed(() =>({
        43: {
            title: { type: 'text', label: 'Dateiname', event: 'export:title',  icon: 'mdi-rename', active: true, title: 'Export-Dateiname', subtitle: 'Legt den Namen der exportierten Datei fest.' },
            mode: {
                type: 'select',
                label: 'Export-Dateityp',
                prependIcon: 'mdi-image',
                event: 'export:mode',
                active: true,
                options: [
                    { title: 'Bild', value: 0 },
                    { title: 'Vektor', value: 1 },
                    { title: 'Dokument', value: 2 },
                ],
                title: 'Dateityp',
                subtitle: 'Bestimmen Sie einen Dateitypen, um verschiedene Ergebnisse zu erzielen.',
            },
            quality: {
                type: 'slider',
                min: 1,
                max: 100,
                step: 1,
                event: 'export:quality',
                title: 'Qualität',
                subtitle: 'Regelt die Qualität des finalen Exports.',
                active: exportData.value.mode === 0 && exportData.value.type === 'JPEG' ||exportData.value.mode === 0 && exportData.value.type === 'PNG' ||exportData.value.mode === 2 && exportData.value.type === 'PDF',
                icon: 'mdi-star-half-full',
            },
            dpi: {
                type: 'slider',
                label: 'DPI',
                min: 1,
                max: 100,
                step: 1,
                event: 'export:dpi',
                title: 'Druckauflösung',
                subtitle: 'Bestimmt die Auflösung (Dots per Inch) des Bildes.',
                active: exportData.value.mode === 2,
                icon: 'mdi-dots-grid'
            },
            paperSize: {
                type: 'select',
                label: 'Papierformat',
                prependIcon: 'mdi-file-document',
                event: 'export:paperSize',
                active: exportData.value.mode === 2,
                options: [
                    { title: 'A0 (841 × 1189 mm)', value: 'A0' },
                    { title: 'A1 (594 × 841 mm)', value: 'A1' },
                    { title: 'A2 (420 × 594 mm)', value: 'A2' },
                    { title: 'A3 (297 × 420 mm)', value: 'A3' },
                    { title: 'A4 (210 × 297 mm)', value: 'A4' },
                    { title: 'A5 (148 × 210 mm)', value: 'A5' },
                    { title: 'A6 (105 × 148 mm)', value: 'A6' },
                    { title: 'A7 (74 × 105 mm)', value: 'A7' },
                    { title: 'A8 (52 × 74 mm)', value: 'A8' },
                    { title: 'A9 (37 × 52 mm)', value: 'A9' },
                    { title: 'A10 (26 × 37 mm)', value: 'A10' },

                    { title: 'B0 (1000 × 1414 mm)', value: 'B0' },
                    { title: 'B1 (707 × 1000 mm)', value: 'B1' },
                    { title: 'B2 (500 × 707 mm)', value: 'B2' },
                    { title: 'B3 (353 × 500 mm)', value: 'B3' },
                    { title: 'B4 (250 × 353 mm)', value: 'B4' },
                    { title: 'B5 (176 × 250 mm)', value: 'B5' },
                    { title: 'B6 (125 × 176 mm)', value: 'B6' },
                    { title: 'B7 (88 × 125 mm)', value: 'B7' },
                    { title: 'B8 (62 × 88 mm)', value: 'B8' },
                    { title: 'B9 (44 × 62 mm)', value: 'B9' },
                    { title: 'B10 (31 × 44 mm)', value: 'B10' },

                    { title: 'C0 (917 × 1297 mm)', value: 'C0' },
                    { title: 'C1 (648 × 917 mm)', value: 'C1' },
                    { title: 'C2 (458 × 648 mm)', value: 'C2' },
                    { title: 'C3 (324 × 458 mm)', value: 'C3' },
                    { title: 'C4 (229 × 324 mm)', value: 'C4' },
                    { title: 'C5 (162 × 229 mm)', value: 'C5' },
                    { title: 'C6 (114 × 162 mm)', value: 'C6' },
                    { title: 'C7 (81 × 114 mm)', value: 'C7' },
                    { title: 'C8 (57 × 81 mm)', value: 'C8' },
                    { title: 'C9 (40 × 57 mm)', value: 'C9' },
                    { title: 'C10 (28 × 40 mm)', value: 'C10' },

                    { title: 'Letter (216 × 279 mm)', value: 'LETTER' },
                    { title: 'Legal (216 × 356 mm)', value: 'LEGAL' }
                ],
                title: 'Papiergröße wählen',
                subtitle: 'Bestimmt das Format des exportierten Dokuments.',
            },
            landscape: {
                type: 'select',
                label: 'Dokumentenausrichtung',
                prependIcon: 'mdi-file-rotate-right',
                event: 'export:landscape',
                active: exportData.value.mode === 2,
                options: [
                    { title: 'Hochformat', value: false },
                    { title: 'Querformat', value: true }
                ],
                title: 'Ausrichtung',
                subtitle: 'Exportiert das Dokument im Querformat statt Hochformat.',
            },
            margin: {
                type: 'number',
                label: 'Rand (mm)',
                step: 1,
                min: 0,
                max: 100,
                event: 'export:margin',
                active: exportData.value.mode === 2,
                title: 'Seitenränder',
                subtitle: 'Definiert den Abstand zum Rand in Millimetern.',
                icon: 'mdi-border-style',
            },
            type: {
                type: 'select',
                label: 'Ziel-Format',
                prependIcon: 'mdi-flag-checkered',
                event: 'export:type',
                active: true,
                options: exportTypes[exportData.value.mode],
                title: 'Dateityp',
                subtitle: 'Bestimmen Sie einen Dateitypen, um verschiedene Ergebnisse zu erzielen.',
            },
            inlineCss: {
                type: 'switch',
                label: 'CSS',
                event: 'export:inlineCss',
                title: 'CSS-Inhalte einbetten',
                subtitle: 'Fügt CSS-Styles direkt in das SVG-Dokument ein.',
                active: exportData.value.mode === 1,
                icon: 'mdi-code-tags',
            },
            ddsCompress: {
                type: 'select',
                label: 'DDS Kompression',
                prependIcon: 'mdi-shape',
                event: 'export:dds-compress',
                active:  exportData.value.mode === 0 && exportData.value.type === 'DDS', // Nur aktiv wenn DDS ausgewählt ist
                options: [
                    { title: 'Unkomprimiert (RGBA)', value: 'UNCOMPRESSED' },
                    { title: 'DXT1 (ohne Alpha)', value: 'DXT1' },
                    { title: 'DXT3 (mit Alpha)', value: 'DXT3' },
                    { title: 'DXT5 (mit Alpha)', value: 'DXT5' },
                    { title: 'BC4 (Ein-Kanal Grau)', value: 'BC4' },
                    { title: 'BC5 (Zwei-Kanal, Normal Map)', value: 'BC5' },
                    { title: 'BC7 (High Quality Kompression)', value: 'BC7' },
                    { title: 'RGB 8-bit', value: 'RGB8' },
                    { title: 'RGBA 8-bit (R8G8B8A8)', value: 'R8G8B8A8' },
                    { title: 'R5G6B5 (fastcompress)', value: 'R5G6B5' },
                ],
                title: 'DDS-Kompression',
                subtitle: 'Wählen Sie die Kompressionsart für DDS-Dateien aus.',
            },
            mipmap: {
                type: 'switch',
                event: 'export:mipmap',
                title: 'Mipmaps erstellen',
                subtitle: 'Erstellt eine Mipmap-Kette für die Textur, verbessert die Darstellung und Leistung in Spielen und 3D-Anwendungen.',
                active: exportData.value.mode === 0 && exportData.value.type === 'DDS',
                icon: 'mdi-view-grid'
            },
            compress: {
                type: 'switch',
                event: 'export:compress',
                title: 'Output komprimieren',
                subtitle: 'Komprimiert die Datei (empfohlen für Web).',
                active: exportData.value.type !== 'DDS',
                icon: 'mdi-folder-zip'
            },
        },
    }));

    const download = (filePath) => {
        if (!filePath) {
            console.error("Kein gültiger Dateipfad übergeben.");
            return;
        }

        const link = document.createElement("a");
        link.href = filePath;
        link.download = filePath.split("/").pop(); // Dateiname aus Pfad extrahieren
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return {
        theme: appData.theme.value,
        setting,
        operation,
        config,
        download,
        emitEvent
    };
}

export const exportProps = {
};