import {ref} from "vue";

export function fullscreenModel(props, emit) {
    const config = ref({
        fullscreen : true,
        class: 'dialog-dimm',
        title: 'Vollbild-Ansicht',
        emit: 'fullscreen-state'
    });
    const tileSizes = [
        { title: "1x1", value: {x: 1, y: 1} },
        { title: "2x2", value: {x: 2, y: 2} },
        { title: "3x3", value: {x: 3, y: 3} },
        { title: "4x4", value: {x: 4, y: 4} },
        { title: "6x6", value: {x: 6, y: 6} },
        { title: "12x12", value: {x: 12, y: 12} },
    ];
    const zoomedStyle = ref({})
    const resetZoom = () => {
        // Zoom zurücksetzen
        zoomedStyle.value = {
            backgroundPosition: '50% 50%',
            backgroundSize: '100%',
        };
    }
    const handleImageZoom = (event) => {
        const container = event.currentTarget;
        const { left, top, width, height } = container.getBoundingClientRect();

        // Mausposition relativ zum Container
        const mouseX = event.clientX - left;
        const mouseY = event.clientY - top;

        // Prozentuale Position
        const xPercent = (mouseX / width) * 100;
        const yPercent = (mouseY / height) * 100;

        // Zoom-Stil anpassen
        zoomedStyle.value = {
            backgroundImage: `url(${props.data.tile && props.data.tileSrc && props.data.tileSize.x > 1 && props.data.tileSize.y > 1 ? props.data.tileSrc : props.data.src})`,
            backgroundSize: '200%',
            backgroundPosition: `${xPercent}% ${yPercent}%`,
        };
    };
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    return {
        config,
        tileSizes,
        handleImageZoom,
        zoomedStyle,
        resetZoom,
        emitEvent,

    };
}

export const fullscreenProps = {
    state: {
        type: Boolean,
        required: true,
        default: false
    },
    loading: {
        type: Boolean,
        required: true,
        default: false
    },
    data: {
        type: Object,
        required: true,
        default: () => {},
    },
    theme: {
        type: String,
        required: true,
    },
};