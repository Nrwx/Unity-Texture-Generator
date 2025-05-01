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
        initWidth: 0,
        initHeight: 0,
        initFontSize: 0,
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

    const selectionSvgStyle = computed(() => ({
        top: `${layer.y}px`,
        left: `${layer.x}px`,
        width: `${layer.width}px`,
        height: `${layer.height}px`,
        position: 'absolute',
        overflow: 'visible',
        pointerEvents: 'none',
    }));


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
        layer.initWidth = 1;
        layer.initHeight = 1;
        layer.initFontSize = 0.40;

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
    };

    const stopDraw = () => {
        drawing.value = false;
        window.removeEventListener("mousemove", handleDraw);
        window.removeEventListener("mouseup", stopDraw);

        if (layer.width > 10 && layer.height > 10) {
            layer.initWidth = layer.width;
            layer.initHeight = layer.height;
            layer.fontSize = Math.round(Math.min(layer.width, layer.height) / 2.5);
            layer.initFontSize = layer.fontSize; // neue Property für spätere Referenz
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
        };
    });

    const textareaStyle = computed(() => {
        return {
            fontSize: `${layer.fontSize}px`
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

        const newWidth = Math.max(50, initialWidth.value + dx);
        const newHeight = Math.max(30, initialHeight.value + dy);

        layer.width = newWidth;
        layer.height = newHeight;

        const widthShrinkThreshold = layer.initWidth - 60;
        const heightShrinkThreshold = layer.initHeight - 30;
        const widthGrowThreshold = layer.initWidth + 60;
        const heightGrowThreshold = layer.initHeight + 30;

        const widthRatio = newWidth / layer.initWidth;
        const heightRatio = newHeight / layer.initHeight;
        const ratio = Math.min(widthRatio, heightRatio);

        // Shrink
        if (newWidth < widthShrinkThreshold || newHeight < heightShrinkThreshold) {
            const shrunkFontSize = Math.max(12, layer.initFontSize * ratio);
            if (shrunkFontSize < layer.fontSize) {
                layer.fontSize = shrunkFontSize;
            }
        }

        // Grow (but not beyond initFontSize)
        if (newWidth > widthGrowThreshold || newHeight > heightGrowThreshold) {
            const grownFontSize = Math.min(layer.initFontSize, layer.initFontSize * ratio);
            if (grownFontSize > layer.fontSize) {
                layer.fontSize = grownFontSize;
            }
        }
    };


    const stopResize = () => {
        window.removeEventListener("mousemove", handleResize);
        window.removeEventListener("mouseup", stopResize);
    };

    const adjustHeight = () => {
        const el = textarea.value;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
    };

    const predictedFontSize = computed(() => {
        const ratio = Math.min(layer.width / layer.initWidth || 1, layer.height / layer.initHeight || 1);
        return Math.max(12, layer.initFontSize * ratio);
    });


    onUnmounted(() => {
        window.removeEventListener("mousemove", handleDraw);
        window.removeEventListener("mouseup", stopDraw);
    });

    return {
        drawing,
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
        startResize,
        adjustHeight,
        selectionSvgStyle,
        predictedFontSize,
    };
}


export const textProps = {
    state: {
        type: Boolean,
        default: false,
    },
};
