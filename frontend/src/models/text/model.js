import {computed, nextTick, onBeforeUnmount, onMounted, ref} from "vue";
import {eventRegister} from "@/dataLayer/event";
import {uuid} from "@/utils/uuid";
import {getTextSize} from "@/utils/getTextSize";

export function textModel(props, emit) {
    const overlay = ref(null);
    const overlayId = ref(uuid());
    const container = ref(null);
    const containerId = ref(uuid());
    const textarea = ref(null);
    const textareaId = ref(uuid());
    const resize = ref(null);
    const resizeId = ref(uuid());
    const confirm = ref(null);
    const confirmId = ref(uuid());
    const cancel = ref(null);
    const cancelId = ref(uuid());


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

    const { register } = eventRegister('listener:text-create', emitEvent);

    const focusTextarea = async () => {
        await nextTick(() => {
            textarea.value?.focus();
        });
    };

    const confirmText = () => {
        getTextSize(textarea.value, props.layer, overlay.value, { minWidth: 10, minHeight: 10 });
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

        register('add', overlay.value, 'pointermove', handleDraw);
        register('add', overlay.value, 'pointerup', stopDraw);
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
        register('remove', overlay.value, 'pointermove', handleDraw);
        register('remove', overlay.value, 'pointerup', stopDraw);

        if (props.layer.width > 10 && props.layer.height > 10) {
            props.layer.initWidth = props.layer.width;
            props.layer.initHeight = props.layer.height;
            props.layer.fontSize = Math.round(Math.min(props.layer.width, props.layer.height) / 2.5);
            props.layer.initFontSize = props.layer.fontSize; // neue Property für spätere Referenz
            drawn.value = true;
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

    const startTextResize = async (e) => {
        e.preventDefault();
        initialMouseX.value = e.clientX;
        initialMouseY.value = e.clientY;
        initialWidth.value = props.layer.width;
        initialHeight.value = props.layer.height;
        register('add', overlay.value, 'pointermove', handleTextResize);
        register('add', overlay.value, 'pointerup', stopTextResize);
    };

    const handleTextResize = (e) => {
        const dx = e.clientX - initialMouseX.value;
        const dy = e.clientY - initialMouseY.value;

        const newWidth = Math.max(50, Math.round(initialWidth.value + dx));
        const newHeight = Math.max(30, Math.round(initialHeight.value + dy));

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
            const shrunkFontSize = Math.round(
                Math.max(12, props.layer.initFontSize * ratio)
            );

            if (shrunkFontSize < props.layer.fontSize) {
                props.layer.fontSize = shrunkFontSize;
            }
        }

        // Grow, aber nicht über initFontSize
        if (newWidth > widthGrowThreshold || newHeight > heightGrowThreshold) {
            const grownFontSize = Math.round(
                Math.min(props.layer.initFontSize, props.layer.initFontSize * ratio)
            );

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


    const stopTextResize = () => {
        register('remove', overlay.value, 'pointermove', handleTextResize);
        register('remove', overlay.value, 'pointerup', stopTextResize);
        console.log('STOPPED')
    };

    const adjustHeight = () => {
        const el = textarea.value;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
    };

    const stopPropagation = (e) => {
        e.stopPropagation();
    };

    const predictedFontSize = computed(() => {
        const ratio = Math.min(
            props.layer.width / props.layer.initWidth || 1,
            props.layer.height / props.layer.initHeight || 1
        );

        return Math.round(
            Math.max(12, props.layer.initFontSize * ratio)
        );
    });

    const init = async () => {
        try {
            overlay.value = document.getElementById(overlayId.value);
            container.value = document.getElementById(containerId.value);
            textarea.value = document.getElementById(textareaId.value);
            resize.value = document.getElementById(resizeId.value);
            confirm.value = document.getElementById(confirmId.value);
            cancel.value = document.getElementById(cancelId.value);

            if (overlay.value) {
                register('add', overlay.value, 'pointerdown', handleOverlayClick);
            }
            if (container.value) {
                register('add', container.value, 'dblclick', editAgain);
            }
            if (textarea.value) {
                register('add', textarea.value, 'input', adjustHeight);
                register('add', textarea.value, 'pointerdown', stopPropagation);
            }
            if (resize.value) {
                register('add', resize.value, 'pointerdown', startTextResize);
            }
            if (confirm.value) {
                register('add', confirm.value, 'click', confirmText);
            }
            if (cancel.value) {
                register('add', cancel.value, 'click', cancelText);
            }

            register('pause');

            return console.log('Text-Component successfully initialized');
        } catch (error) {
            console.error('[init] Initialization failed:', error);
            throw new Error('Text-Component initialization failed');
        }
    };


    onMounted( async () => {
        await init()
    });

    onBeforeUnmount(() => {
        register('removeAll');
    });

    return {
        drawing,
        overlay,
        overlayId,
        drawn,
        textarea,
        textareaId,
        container,
        containerId,
        confirm,
        confirmId,
        cancel,
        cancelId,
        resize,
        resizeId,
        wrapperStyle,
        textareaStyle,
        selectionSvgStyle,
        predictedFontSize
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
