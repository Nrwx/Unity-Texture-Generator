import {computed, nextTick, onUnmounted, reactive, ref} from "vue";

export function textModel(props, emit) {
    const overlay = ref(null);
    const drawing = ref(false);
    const drawn = ref(false);
    const textarea = ref(null);

    const startX = ref(0);
    const startY = ref(0);

    const initialMouseX = ref(0);
    const initialMouseY = ref(0);
    const initialWidth = ref(0);
    const initialHeight = ref(0);

    const layer = reactive({
        text: '',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        fontSize: 16,
    });

    const focusTextarea = () => {
        nextTick(() => {
            textarea.value?.focus();
        });
    };

    const confirmText = () => {
        textarea.value?.blur(); // Fokus entfernen
        finishEditing();
    };

    const cancelText = () => {
        layer.text = '';
        drawn.value = false;
    };

    // Nur Zeichnen starten, wenn kein Textfeld bereits sichtbar ist
    const handleOverlayClick = (e) => {
        if (!drawn.value) {
            startDraw(e);
        }
    };

    const editAgain = () => {
        // Bei Doppelklick das Textfeld erneut fokussieren
        focusTextarea();
    };

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const autoGrow = () => {
        const el = textarea.value;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
    };

    const startDraw = (e) => {
        // Falls bereits gezeichnet wurde und das Textfeld angeklickt wird – abbrechen
        if (drawn.value) return;

        if (!overlay.value) return;

        drawing.value = true;
        drawn.value = false;

        const rect = overlay.value.getBoundingClientRect();
        startX.value = e.clientX - rect.left;
        startY.value = e.clientY - rect.top;

        layer.x = startX.value;
        layer.y = startY.value;
        layer.width = 0;
        layer.height = 0;

        window.addEventListener("mousemove", handleDraw);
        window.addEventListener("mouseup", stopDraw);
    };


    const handleDraw = (e) => {
        if (!drawing.value || !overlay.value) return;

        const rect = overlay.value.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        layer.x = Math.min(startX.value, currentX);
        layer.y = Math.min(startY.value, currentY);
        layer.width = Math.abs(currentX - startX.value);
        layer.height = Math.abs(currentY - startY.value);

        layer.fontSize = Math.min(layer.width / 10, 32);
    };

    const stopDraw = () => {
        drawing.value = false;
        window.removeEventListener("mousemove", handleDraw);
        window.removeEventListener("mouseup", stopDraw);

        if (layer.width > 10 && layer.height > 10) {
            drawn.value = true;
            nextTick(() => {
                textarea.value?.focus();
            });
        }
    };

    const finishEditing = () => {
        emitEvent("text-finished", layer.text);
    };

    const wrapperStyle = computed(() => {
        return {
            top: `${layer.y}px`,
            left: `${layer.x}px`,
            width: `${layer.width}px`,
            height: `${layer.height}px`,
            fontSize: `${Math.min(layer.width / 10, 32)}px`, // Dynamische Schriftgröße
        };
    });

    const textareaStyle = computed(() => {
        return {
            fontSize: `${Math.min(layer.width / 10, 32)}px`, // Dynamische Schriftgröße
        };
    });

    const startResize = (e) => {
        e.preventDefault();
        initialMouseX.value = e.clientX;
        initialMouseY.value = e.clientY;
        initialWidth.value = layer.width;
        initialHeight.value = layer.height;

        window.addEventListener("mousemove", handleResize);
        window.addEventListener("mouseup", stopResize);
    };

    const handleResize = (e) => {
        const dx = e.clientX - initialMouseX.value;
        const dy = e.clientY - initialMouseY.value;
        layer.width = Math.max(50, initialWidth.value + dx);
        layer.height = Math.max(30, initialHeight.value + dy);
    };

    const stopResize = () => {
        window.removeEventListener("mousemove", handleResize);
        window.removeEventListener("mouseup", stopResize);
    };


    onUnmounted(() => {
        window.removeEventListener("mousemove", handleDraw);
        window.removeEventListener("mouseup", stopDraw);
    });

    return {
        overlay,
        layer,
        drawn,
        startDraw,
        finishEditing,
        wrapperStyle,
        textareaStyle,
        textarea,
        handleOverlayClick,
        editAgain,
        focusTextarea,
        confirmText,
        cancelText,
        autoGrow,
        startResize
    };
}


export const textProps = {
    state: {
        type: Boolean,
        default: false,
    },
};
