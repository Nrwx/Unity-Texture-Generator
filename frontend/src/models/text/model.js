import { computed, ref } from "vue";

export function textModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    // Text Layer Definition
    const layer = ref({
        text: 'Dein Text hier',
        width: 200,
        height: 100,
        fontSize: 16, // Basis-Schriftgröße
    });

    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    // Berechnung der Container-Styles (Position, Größe, Schriftgröße)
    const wrapperStyle = computed(() => {
        return {
            position: 'absolute',
            top: '150px', // Beispielwert, je nach Bedarf dynamisch
            left: '100px', // Beispielwert, je nach Bedarf dynamisch
            width: `${layer.value.width}px`,
            height: `${layer.value.height}px`,
            fontSize: `${Math.min(layer.value.width / 10, layer.value.fontSize)}px`, // Dynamische Schriftgröße
            border: '1px solid #ccc',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'se-resize', // Cursor für Resize
        };
    });

    const textareaStyle = computed(() => ({
        width: '100%',
        height: '100%',
        fontSize: `${Math.min(layer.value.width / 10, layer.value.fontSize)}px`, // Dynamische Schriftgröße
        resize: 'none',
        border: 'none',
        outline: 'none',
    }));

    // Resizing Funktion starten
    const startResize = (e) => {
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = layer.value.width;
        startHeight = layer.value.height;

        window.addEventListener('mousemove', handleResize);
        window.addEventListener('mouseup', stopResize);
    };

    // Resizing Funktion
    const handleResize = (e) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        layer.value.width = startWidth + dx;
        layer.value.height = startHeight + dy;

        // Dynamische Schriftgröße
        layer.value.fontSize = Math.min(layer.value.width / 10, 30); // Maximale Schriftgröße begrenzen
    };

    // Resize stoppen
    const stopResize = () => {
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', stopResize);
    };

    // Beendet den Bearbeitungsmodus
    const finishEditing = () => {
        emitEvent('text-state', false)
    };

    return {
        layer,
        finishEditing,
        startResize,
        wrapperStyle,
        textareaStyle,
        emitEvent,
    };
}

export const textProps = {
    state: {
        type: Boolean,
        default: false,
    },
};
