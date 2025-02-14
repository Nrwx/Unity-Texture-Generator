import { computed, ref, onMounted, onUnmounted } from "vue";

export function gridModel(props) {
    const canvasContainer = ref(null);
    const scale = ref(1); // Zoom-Wert
    const offsetX = ref(0); // Verschiebung auf der X-Achse
    const offsetY = ref(0); // Verschiebung auf der Y-Achse
    const cursorPosition = ref({ x: 0, y: 0 });
    const isPanning = ref(false); // Ob das Verschieben aktiv ist
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Berechne die Maße des Rulers (Lineales)
    const rulerWidth = computed(() => props.settings.width * scale.value);
    const rulerHeight = computed(() => props.settings.height * scale.value);

    // Berechne die Position der Ruler
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

    // Der Stil des Canvas mit der Skalierung und Position
    const canvasStyle = computed(() => ({
        width: `${props.settings.width}px`, // Maximalbreite des Canvas
        height: `${props.settings.height}px`, // Maximalhöhe des Canvas
        transform: `scale(${scale.value})`,
        transformOrigin: "center center",
        marginLeft: `${offsetX.value}px`,
        marginTop: `${offsetY.value}px`,
    }));

    // Aktualisiere die Cursorposition
    const updateCursorPosition = (event) => {
        const rect = canvasContainer.value.getBoundingClientRect();
        const x = (event.clientX - rect.left) / scale.value;
        const y = (event.clientY - rect.top) / scale.value;
        cursorPosition.value.x = Math.round(x);
        cursorPosition.value.y = Math.round(y);
    };

    const cursorStyle = computed(() => ({
        position: "absolute",
        left: `${cursorPosition.value.x}px`,
        top: `${cursorPosition.value.y}px`,
        transform: "translate(10px, -20px)",
    }));

    // Zooming (linker Mausklick)
    const handleMouseDown = (event) => {
        if (event.button === 0) {
            scale.value = Math.min(scale.value + 0.1, 2); // Zoom-In
        } else if (event.button === 2) {
            event.preventDefault();
            scale.value = Math.max(scale.value - 0.1, 0.5); // Zoom-Out
        }
    };

    // Mausbewegung für Verschieben
    window.addEventListener("mousemove", (event) => {
        if (isPanning.value) {
            const dx = event.clientX - lastMouseX;
            const dy = event.clientY - lastMouseY;

            // Berechne die neue Position des Canvas
            const newOffsetX = offsetX.value + dx;
            const newOffsetY = offsetY.value + dy;

            // Maximaler Bereich, in dem sich das Canvas bewegen kann
            const containerRect = canvasContainer.value.getBoundingClientRect();
            const maxOffsetX = Math.min(0, containerRect.width - props.settings.width * scale.value);
            const maxOffsetY = Math.min(0, containerRect.height - props.settings.height * scale.value);

            offsetX.value = Math.max(maxOffsetX, Math.min(newOffsetX, 0));
            offsetY.value = Math.max(maxOffsetY, Math.min(newOffsetY, 0));

            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
        }
    });

    // Start des Panning
    const startPan = (event) => {
        if (isPanning.value) {
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
        }
    };

    // Ende des Panning
    const endPan = () => {
        isPanning.value = false;
    };

    // Leertaste für das Verschieben aktivieren
    const handleKeyDown = (event) => {
        if (event.code === "Space") {
            document.body.style.cursor = "grab"; // Cursor ändern
            isPanning.value = true;
            window.addEventListener("mousemove", startPan);
        }
    };

    const handleKeyUp = (event) => {
        if (event.code === "Space") {
            document.body.style.cursor = "default"; // Cursor zurücksetzen
            isPanning.value = false;
            window.removeEventListener("mousemove", startPan);
        }
    };

    onMounted(() => {
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
    });

    onUnmounted(() => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
    });

    return {
        canvasContainer,
        canvasStyle,
        columnPositions,
        rowPositions,
        handleMouseDown,
        updateCursorPosition,
        cursorPosition,
        cursorStyle,
        rulerWidth,
        rulerHeight,
        offsetX,
        offsetY,
        startPan,
        endPan,
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
