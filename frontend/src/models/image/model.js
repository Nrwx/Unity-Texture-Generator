export function imageModel(props, emit) {
    const extractImageSize = async () => {
        const img = new Image();
        img.src = props.image;

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        if (img && img.naturalWidth && img.naturalHeight) {
            emit('component-event', 'update-dimension', {width: img.naturalWidth, height: img.naturalHeight})
            console.log(img.naturalWidth, img.naturalHeight);
        } else {
            console.error("Bild ist nicht verfügbar oder noch nicht geladen.");
        }
    };
    return {
        extractImageSize,
    };
}

export const imageProps = {
    layers: {
        type: Array,
        required: true,
        default: () => [],
    },
};