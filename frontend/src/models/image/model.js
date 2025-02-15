export function imageModel(props, emit) {
    const emitEvent = (payload, event) => {
        emit("update:select-layer", payload, event);
    };
    const extractImageSize = async () => {
        const img = new Image();
        img.src = props.image;

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

    return {
        emitEvent,
        extractImageSize,
    };
}

export const imageProps = {
    layers: {
        type: Array,
        required: true,
        default: () => [],
    },
    selectedLayers: {
        type: Array,
        required: true,
        default: () => [],
    },
    offsetX: {
        type: Number,
        required: true,
        default: 0
    },
    offsetY: {
        type: Number,
        required: true,
        default: 0
    },
};