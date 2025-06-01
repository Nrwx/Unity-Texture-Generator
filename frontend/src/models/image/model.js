import {localData} from "@/dataLayer/local";

export function imageModel(props, emit) {
    const emitUpdateLayer = (payload) => {
        emit("update:layer", payload);
    };
    const emitSelectLayer = (payload, event) => {
        emit("update:select-layer", payload, event);
    };
    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const handleClick = async (event) => {
        if (!props.fillState) {
            return console.log('No image select')
        } else {
            const target = event.target.closest('[data-context-id]')
            const rect = target.getBoundingClientRect()

            const x = Math.round(event.clientX - rect.left)
            const y = Math.round(event.clientY - rect.top)

            const id = target.getAttribute("data-context-id");
            if (!id) throw new Error("Layer-ID nicht gefunden (data-context-id fehlt)")

            const color = localData.color.value

            const data = {id: id, x: x, y: y, color: color}
            if(data) {
                emitEvent("fill-color-modifier", data);
                emit("update:selected-layer", []);
            }
        }
    }
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
        handleClick,
        emitUpdateLayer,
        emitSelectLayer,
        extractImageSize,
    };
}

export const imageProps = {
    layers: {
        type: Array,
        required: true,
    },
    selectedLayer: {
        type: Array,
        required: true,
        default: () => [],
    },
    fillState: {
        type: Boolean,
        required: true,
    },
};