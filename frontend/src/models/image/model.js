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


    return {
        emitUpdateLayer,
        emitSelectLayer,
        extractImageSize
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