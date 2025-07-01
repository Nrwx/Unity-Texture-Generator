import {computed, nextTick, onBeforeUnmount, onMounted, ref} from "vue";

export function textModel(props, emit) {
    const overlay = ref(null);
    const textarea = ref(null);
    const container = ref(null);

    const drawing = ref(false);
    const drawn = ref(false);

    const startX = ref(0);
    const startY = ref(0);

    const initialMouseX = ref(0);
    const initialMouseY = ref(0);
    const initialWidth = ref(0);
    const initialHeight = ref(0);

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const register = (mode, target, type = null, handler = null) => {
        const id = 'listener:text-create';

        switch (mode) {
            case 'add':
                if (!target || typeof target.addEventListener !== 'function') {
                    console.warn(`Invalid target for event listener:`, target);
                    return;
                }
                emitEvent('event:listener', {
                    add: true,
                    id: id,
                    target: target,
                    type: type,
                    handler: handler,
                    options: false,
                    active: true,
                });
                break;

            case 'remove':
                emitEvent('event:listener', {
                    removeAll: true,
                    id: id,
                    type: type,
                    handler: handler
                });
                break;

            case 'removeAll':
                emitEvent('event:listener', {
                    removeAll: true,
                    id,
                });
                break;

            case 'pause':
                emitEvent('event:listener', {
                    pause: true,
                    id
                });
                break;

            default:
                console.warn(`Unknown mode '${mode}' passed to register()`);
        }
    };

    const focusTextarea = async () => {
        await nextTick(() => {
            textarea.value?.focus();
        });
    };

    const confirmText = () => {
        textarea.value?.blur();
        finishEditing();
        drawn.value = false
        drawing.value = false
        resetLayer()
        overlay.value = null
        textarea.value = null
        container.value = null
        startX.value = 0
        startY.value = 0
        initialMouseX.value = 0
        initialMouseY.value = 0
        initialWidth.value = 0
        initialHeight.value = 0
        emitEvent('text-state', false)
    };

    const cancelText = () => {
        resetLayer()
        drawing.value = false
        drawn.value = false;
    };

    // Nur Zeichnen starten, wenn kein Textfeld bereits sichtbar ist
    const handleOverlayClick = (e) => {
        if (!drawn.value) {
            return startDraw(e);
        }
    };

    const editAgain = async () => {
        // Bei Doppelklick das Textfeld erneut fokussieren
        await focusTextarea();
    };

    const selectionSvgStyle = computed(() => ({
        top: `${props.layer.y}px`,
        left: `${props.layer.x}px`,
        width: `${props.layer.width}px`,
        height: `${props.layer.height}px`,
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
        startX.value = Math.round(e.clientX - rect.left);
        startY.value = Math.round(e.clientY - rect.top);

        props.layer.x = startX.value;
        props.layer.y = startY.value;
        props.layer.width = 0;
        props.layer.height = 0;
        props.layer.initWidth = 1;
        props.layer.initHeight = 1;
        props.layer.initFontSize = 0.40;

        register('add', window, 'mousemove', handleDraw);
        register('add', window, 'mouseup', stopDraw);
    };


    const handleDraw = (e) => {
        if (!drawing.value || !overlay.value) return;

        const rect = overlay.value.getBoundingClientRect();
        const currentX = Math.round(e.clientX - rect.left);
        const currentY = Math.round(e.clientY - rect.top);

        props.layer.x = Math.min(startX.value, currentX);
        props.layer.y = Math.min(startY.value, currentY);
        props.layer.width = Math.abs(currentX - startX.value);
        props.layer.height = Math.abs(currentY - startY.value);
    };

    const stopDraw = async () => {
        drawing.value = false;
        register('add', window, 'mousemove', handleDraw);
        register('add', window, 'mouseup', stopDraw);

        if (props.layer.width > 10 && props.layer.height > 10) {
            props.layer.initWidth = props.layer.width;
            props.layer.initHeight = props.layer.height;
            props.layer.fontSize = Math.round(Math.min(props.layer.width, props.layer.height) / 2.5);
            props.layer.initFontSize = props.layer.fontSize; // neue Property für spätere Referenz
            drawn.value = true;
            await nextTick(() => {
                textarea.value?.focus();
            });
        }
    };


    const finishEditing = () => {
        emitEvent("add-text-layer", props.layer);
    };

    const wrapperStyle = computed(() => {
        return {
            top: `${props.layer.y}px`,
            left: `${props.layer.x}px`,
            width: `${props.layer.width}px`,
            height: `${props.layer.height}px`,
        };
    });

    const textareaStyle = computed(() => {
        return {
            fontSize:       `${props.layer.fontSize}px`,
            fontFamily:     props.layer.fontFamily,
            fontWeight:     props.layer.fontWeight,
            textAlign:      props.layer.textAlign,
            lineHeight:     props.layer.lineHeight,
            letterSpacing:  `${props.layer.letterSpacing}px`,
            textTransform:  props.layer.textTransform,
            textDecoration: props.layer.textDecoration,
            color:          props.layer.color,
        };
    });

    const startResize = (e) => {
        e.preventDefault();
        initialMouseX.value = e.clientX;
        initialMouseY.value = e.clientY;
        initialWidth.value = props.layer.width;
        initialHeight.value = props.layer.height;

        register('add', window, 'mousemove', handleResize);
        register('add', window, 'mouseup', stopResize);
    };

    const handleResize = (e) => {
        const dx = e.clientX - initialMouseX.value;
        const dy = e.clientY - initialMouseY.value;

        const newWidth = Math.max(50, initialWidth.value + dx);
        const newHeight = Math.max(30, initialHeight.value + dy);

        props.layer.width = newWidth;
        props.layer.height = newHeight;

        const widthShrinkThreshold = props.layer.initWidth - 60;
        const heightShrinkThreshold = props.layer.initHeight - 30;
        const widthGrowThreshold = props.layer.initWidth + 60;
        const heightGrowThreshold = props.layer.initHeight + 30;

        const widthRatio = newWidth / props.layer.initWidth;
        const heightRatio = newHeight / props.layer.initHeight;
        const ratio = Math.min(widthRatio, heightRatio);

        // Shrink
        if (newWidth < widthShrinkThreshold || newHeight < heightShrinkThreshold) {
            const shrunkFontSize = Math.max(12, props.layer.initFontSize * ratio);
            if (shrunkFontSize < props.layer.fontSize) {
                props.layer.fontSize = shrunkFontSize;
            }
        }

        // Grow (but not beyond initFontSize)
        if (newWidth > widthGrowThreshold || newHeight > heightGrowThreshold) {
            const grownFontSize = Math.min(props.layer.initFontSize, props.layer.initFontSize * ratio);
            if (grownFontSize > props.layer.fontSize) {
                props.layer.fontSize = grownFontSize;
            }
        }
    };

    const resetLayer = () => {
        props.layer.x = 0;
        props.layer.y = 0;
        props.layer.width = 0;
        props.layer.height = 0;
        props.layer.initWidth = 1;
        props.layer.initHeight = 1;
        props.layer.fontSize = 16;
        props.layer.initFontSize = 16;
        props.layer.text = '';
    };


    const stopResize = () => {
        register('remove', window, 'mousemove', handleResize);
        register('remove', window, 'mouseup', stopResize);
    };

    const adjustHeight = () => {
        const el = textarea.value;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
    };

    const predictedFontSize = computed(() => {
        const ratio = Math.min(props.layer.width / props.layer.initWidth || 1, props.layer.height / props.layer.initHeight || 1);
        return Math.max(12, props.layer.initFontSize * ratio);
    });


    onMounted( async () => {
        register('add', overlay.value, 'mousedown', handleOverlayClick);
        register('pause')
    });

    onBeforeUnmount(() => {
        register('removeAll');
    });

    return {
        drawing,
        overlay,
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
    layer: {
        type: Object,
        required: true,
    }
};
