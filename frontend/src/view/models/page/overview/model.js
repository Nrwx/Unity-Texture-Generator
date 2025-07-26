import {reactive} from "vue";
import {appData, localData} from "@/dataLayer/local";

export function overviewModel(props, emit) {

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const tiles = reactive([
        {
            id: 'template',
            label: 'Vorlagen',
            description: 'Designvorlagen durchsuchen',
            icon: 'mdi-shape-outline',
            color: appData.theme.value ? '#40124f' : '#8e24aa',
        },
        {
            id: 'settings',
            label: 'Projekt',
            description: 'Erweiterte Optionen',
            icon: 'mdi-cog',
            color: appData.theme.value ? '#3a2100' : '#fb8c00',
        },
    ]);

    const getTileStyle = (tile) => ({
        backgroundColor: tile.color,
        color: appData.theme.value ? '#ffffff' : '#000000',
        borderRadius: '12px',
        padding: '16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        minHeight: '100px',
    });

    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '16px',
    };

    const onTileClick = (tile) => {
        emitEvent('tile:click', tile.id);
    };

    const dpiUnits = [
        { title: 'Pixel', value: 'px' },
        { title: 'Zoll', value: 'in' },
        { title: 'Millimeter', value: 'mm' },
        { title: 'Zentimeter', value: 'cm' },
    ];

    const config = reactive({
        method: 42,
        title: localData.viewport.value.title,
        unit: localData.viewport.value.unit,
    });

    const operation = {
        42: {
            title: {
                type: 'text',
                label: 'Projekt-Titel',
                icon: 'mdi-text',
                event: 'viewport:title',
                active: true,
                title: 'Titel des Projekts',
                subtitle: 'Dieser Titel beschreibt Ihr aktuelles Design oder Vorhaben.',
            },
            unit: {
                type: 'select',
                label: 'Einheit',
                prependIcon: 'mdi-ruler-square',
                event: 'viewport:unit',
                active: true,
                options: dpiUnits,
                title: 'Maßeinheit',
                subtitle: 'Wählen Sie die gewünschte Maßeinheit für Breite und Höhe.',
            },
        },
    };


    return {
        theme: appData.theme.value,
        tiles,
        gridStyle,
        getTileStyle,
        onTileClick,
        config,
        operation,
        emitEvent,
    };
}

export const overviewProps = {};
