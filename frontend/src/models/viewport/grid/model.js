import { computed, ref, onMounted, onUnmounted } from "vue";

export function gridModel(props, emit) {
    const settings = computed(() => props.settings);
    const canvasContainer = ref(null);
    const isPanning = ref(false);
    const isZooming = ref(false);
    const scale = ref(1);
    const offsetX = ref(0);
    const offsetY = ref(0);
    const cursorPosition = ref({ x: 0, y: 0 });
    let lastMouseX = 0;
    let lastMouseY = 0;
    const guides = ref([]);
    let draggingGuide = null;

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const columnPositions = computed(() => {
        const positions = [];
        const step = 50;
        for (let x = 0; x <= settings.value.width; x += step) {
            positions.push(x);
        }
        return positions;
    });

    const rowPositions = computed(() => {
        const positions = [];
        const step = 50;
        for (let y = 0; y <= settings.value.height; y += step) {
            positions.push(y);
        }
        return positions;
    });

    const canvasContainerStyle = computed(() => ({
        width: `${settings.value.width}px`,
        height: `${settings.value.height}px`,
        transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`,
        transformOrigin: "center center",
    }));

    const handleMouseDown = (event) => {
        if (isZooming.value) {
            if (event.button === 0) {
                scale.value = Math.min(scale.value + 0.1, 2);
            } else if (event.button === 2) {
                event.preventDefault();
                scale.value = Math.max(scale.value - 0.1, 0.5);
            }
        }
    };

    const handleMouseMove = (event) => {
        const rect = canvasContainer.value.getBoundingClientRect();
        const x = (event.clientX - rect.left) / scale.value;
        const y = (event.clientY - rect.top) / scale.value;

        cursorPosition.value.x = Math.round(x);
        cursorPosition.value.y = Math.round(y);

        if (isPanning.value) {
            const dx = event.clientX - lastMouseX;
            const dy = event.clientY - lastMouseY;

            offsetX.value += dx;
            offsetY.value += dy;
        }
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    };

    const startPan = (event) => {
        if (!isPanning.value) return;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", stopPan);
    };

    const stopPan = () => {
        isPanning.value = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", stopPan);
    };

    const startDraggingGuide = (guide, event) => {
        event.preventDefault();
        draggingGuide = guide;
        document.addEventListener("mousemove", dragGuide);
        document.addEventListener("mouseup", stopDraggingGuide);
    };

    const startGuide = (type, event) => {
        const position = type === 'horizontal' ? event.clientY : event.clientX;

        // Prüfen, ob eine bestehende Hilfslinie an dieser Position existiert
        const existingIndex = guides.value.findIndex(g => g.type === type && Math.abs(g.position - position) < 5);

        if (existingIndex !== -1) {
            // Entferne die bestehende Hilfslinie
            guides.value.splice(existingIndex, 1);
        } else {
            // Neue Hilfslinie erstellen
            const guide = { id: Date.now(), type, position };
            guides.value.push(guide);
            startDraggingGuide(guide, event);
        }
    };

    const dragGuide = (event) => {
        if (!draggingGuide) return;

        // Verhindere, dass position unnötig auf 0 gesetzt wird
        const newPosition = draggingGuide.type === 'horizontal' ? event.clientY : event.clientX;

        // Nur aktualisieren, wenn sich die Position wirklich ändert
        if (draggingGuide.position !== newPosition) {
            draggingGuide.position = newPosition;
        }
    };

    const stopDraggingGuide = () => {
        if (!draggingGuide) return;

        // Prüfen, ob die Hilfslinie auf das Lineal zurückgelegt wurde
        const isOnXAxis = draggingGuide.type === 'horizontal' && draggingGuide.position <= 20; // 20px Toleranz für das Lineal
        const isOnYAxis = draggingGuide.type === 'vertical' && draggingGuide.position <= 20;

        if (isOnXAxis || isOnYAxis) {
            // Lösche die Hilfslinie
            guides.value = guides.value.filter(g => g.id !== draggingGuide.id);
        }

        draggingGuide = null;
        document.removeEventListener("mousemove", dragGuide);
        document.removeEventListener("mouseup", stopDraggingGuide);
    };

    const getGuideStyle = (guide) => {
        return guide.type === 'horizontal'
            ? { top: `${guide.position}px`, bottom: '0', left: '0', right: '0', width: '100%', height: '1px', background: 'blue', position: 'absolute', cursor: 'row-resize' }
            : { left: `${guide.position}px`, bottom: '0', top: '0', right: '0', height: '100%', width: '1px', background: 'blue', position: 'absolute', cursor: 'col-resize' };
    };

    const handleKeyDown = (event) => {
        if (event.key === 'g') isPanning.value = true;
        if (event.key === 'z') isZooming.value = !isZooming.value;
    };

    const handleKeyUp = (event) => {
        if (event.key === 'g') isPanning.value = false;
    };

    onMounted(() => {
        document.addEventListener("contextmenu", (event) => event.preventDefault());
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);
        document.addEventListener("mousedown", startPan);
    });

    onUnmounted(() => {
        document.removeEventListener("contextmenu", (event) => event.preventDefault());
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("keyup", handleKeyUp);
        document.removeEventListener("mousedown", startPan);
    });

    return {
        canvasContainer,
        canvasContainerStyle,
        handleMouseDown,
        handleMouseMove,
        cursorPosition,
        offsetX,
        offsetY,
        scale,
        columnPositions,
        rowPositions,
        guides,
        startGuide,
        startDraggingGuide,
        getGuideStyle,
        isZooming,
        emitEvent,
    };
}


export const gridProps = {
    settings: {
        type: Object,
    },
    layers: {
        type: Array,
        required: true,
        default: () => [],
    },
};
