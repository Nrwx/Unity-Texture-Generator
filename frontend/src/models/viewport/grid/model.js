import {computed, ref} from "vue";

export function gridModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    const canvasContainer = ref(null);
    const scale = ref(1);
    const cursorPosition = ref({ x: 0, y: 0 });

    // Compute grid positions for both rows and columns
    const columnPositions = computed(() => {
        const positions = [];
        for (let x = 0; x <= props.settings.width; x += 50) {
            positions.push(x);
        }
        return positions;
    });

    const rowPositions = computed(() => {
        const positions = [];
        for (let y = 0; y <= props.settings.height; y += 50) {
            positions.push(y);
        }
        return positions;
    });

    // Canvas styles including scaling for zoom
    const canvasStyle = computed(() => ({
        width: `${props.settings.width}px`,
        height: `${props.settings.height}px`,
        transform: `scale(${scale.value})`,
        transformOrigin: "top left",
    }));

    const updateCursorPosition = (event) => {
        const rect = canvasContainer.value.getBoundingClientRect();
        cursorPosition.value.x = Math.round((event.clientX - rect.left) / scale.value);
        cursorPosition.value.y = Math.round((event.clientY - rect.top) / scale.value);
    };

    const cursorStyle = computed(() => ({
        position: "absolute",
        left: `${cursorPosition.value.x}px`,
        top: `${cursorPosition.value.y}px`,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        color: "white",
        padding: "2px 4px",
        fontSize: "12px",
        borderRadius: "3px",
        pointerEvents: "none",
        transform: "translate(10px, -20px)",
    }));

    // Handle zoom in/out
    const handleZoom = (event) => {
        event.preventDefault();
        if (event.deltaY < 0) {
            scale.value = Math.min(scale.value + 0.1, 2);
        } else {
            scale.value = Math.max(scale.value - 0.1, 0.5);
        }
    };

    // Style for each layer element
    const layerStyle = (layer) => ({
        position: "absolute",
        left: `${layer.x}px`,
        top: `${layer.y}px`,
        zIndex: layer.zIndex || 1,
        transform: `scale(${scale.value})`,
    });

    return {
        emitEvent,
        canvasContainer,
        canvasStyle,
        columnPositions,
        rowPositions,
        handleZoom,
        layerStyle,
        updateCursorPosition,
        cursorPosition,
        cursorStyle,
    };
}

export const gridProps = {
    settings: {
        type: Object,
        required: true,
        default: () => {},
    },
    layers: {
        type: Array,
        required: true,
        default: () => [],
    },
};