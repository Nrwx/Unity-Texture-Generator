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

    const config = reactive({
        method: 43,
        mode: exportData.mode.value,
        quality: exportData.quality.value,
        type: exportData.type.value,
        dpi: exportData.dpi.value,
        title: exportData.title.value,
        compress: exportData.compress.value,
        inlineCss: exportData.inlineCss.value,
        paperSize: exportData.paperSize.value,
        landscape: exportData.landscape.value,
        margin: exportData.margin.value,
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
                active: true,
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
                active: exportData.mode.value === 2,
                icon: 'mdi-dots-grid'
            },
            paperSize: {
                type: 'select',
                label: 'Papierformat',
                prependIcon: 'mdi-file-document',
                event: 'export:paperSize',
                active: exportData.mode.value === 2,
                options: [
                    { title: 'A4', value: 0 },
                    { title: 'A3', value: 1 },
                    { title: 'Brief', value: 2 },
                ],
                title: 'Papiergröße wählen',
                subtitle: 'Bestimmt das Format des exportierten Dokuments.',
            },
            landscape: {
                type: 'select',
                label: 'Dokumentenausrichtung',
                prependIcon: 'mdi-file-rotate-right',
                event: 'export:landscape',
                active: exportData.mode.value === 2,
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
                active: exportData.mode.value === 2,
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
                options: computed(() => {
                    if (exportData.mode.value === 0) return [{ title: '.jpg', value: 'JPG' }, { title: '.jpeg', value: 'JPEG' }, { title: '.png', value: 'PNG' }, { title: '.tga', value: 'TGA' },{ title: '.dds', value: 'DDS' }];
                    if (exportData.mode.value === 1) return [{ title: '.svg', value: 'SVG' }];
                    if (exportData.mode.value === 2) return [{ title: '.pdf', value: 'PDF' }];
                    return [];
                }).value,
                title: 'Dateityp',
                subtitle: 'Bestimmen Sie einen Dateitypen, um verschiedene Ergebnisse zu erzielen.',
            },
            inlineCss: {
                type: 'switch',
                label: 'CSS',
                event: 'export:inlineCss',
                title: 'CSS-Inhalte einbetten',
                subtitle: 'Fügt CSS-Styles direkt in das SVG-Dokument ein.',
                active: exportData.mode.value === 1,
                icon: 'mdi-code-tags',
            },
            compress: {
                type: 'switch',
                event: 'export:compress',
                title: 'Output komprimieren',
                subtitle: 'Komprimiert die Datei (empfohlen für Web).',
                active: true,
                icon: 'mdi-folder-zip'
            }
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