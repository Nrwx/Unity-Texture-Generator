export function imageModel(props, emit) {
    const emitUpdateLayer = (payload) => {
        emit("update:layer", payload);
    };
    const emitSelectLayer = (payload, event) => {
        emit("update:select-layer", payload, event);
    };
    const extractImageSize = async (layer) => {
        const img = new Image();
        img.src = layer.url;

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        if (img && img.naturalWidth && img.naturalHeight) {
            emit('component-event', 'update-dimension', {width: img.naturalWidth, height: img.naturalHeight})
        } else {
            console.error("Bild ist nicht verfügbar oder noch nicht geladen.");
        }
    };


    const handleContextAction = ({ action, contextId }) => {
        console.log('Aktion:', action, 'auf Datei:', contextId)
    }

    const menuItems = [
        {
            label: 'Datei',
            icon: 'mdi-file',
            children: [
                { label: 'Neu', icon: 'mdi-file-plus', action: 'new' },
                { label: 'Öffnen', icon: 'mdi-folder-open', action: 'open' },
                { label: 'Speichern', icon: 'mdi-content-save', action: 'save' },
            ],
        },
        {
            label: 'Bearbeiten',
            icon: 'mdi-pencil',
            children: [
                { label: 'Kopieren', icon: 'mdi-content-copy', action: 'copy' },
                { label: 'Einfügen', icon: 'mdi-content-paste', action: 'paste' },
            ],
        },
        {
            label: 'Löschen',
            icon: 'mdi-delete',
            action: 'delete',
        },
    ]

    return {
        emitUpdateLayer,
        emitSelectLayer,
        extractImageSize,
        handleContextAction,
        menuItems,
    };
}

export const imageProps = {
    layers: {
        type: Array,
        required: true,
        default: () => [],
    },
    selectedLayer: {
        type: Array,
        required: true,
        default: () => [],
    }
};