import {computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch} from "vue";
import {uuid} from "@/utils/uuid";
import {eventRegister} from "@/dataLayer/event";
import {getTextSize} from "@/utils/getTextSize";

export function editTextModel(props, emit) {
    const overlay = ref(null);
    const overlayId = ref(uuid());

    const container = ref(null);
    const containerId = ref(uuid());

    const textarea = ref(null);
    const textareaId = ref(uuid());

    const confirm = ref(null);
    const confirmId = ref(uuid());

    const cancel = ref(null);
    const cancelId = ref(uuid());

    const draft = reactive({
        text: "",
    });

    const editorSize = reactive({
        width: 10,
        height: 10,
    });

    let resizeFrame = null;

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const { register } = eventRegister("listener:edit-text", emitEvent);

    const closeEditor = () => {
        emitEvent("text-edit-state", false);
    };

    const getTextareaMetrics = () => {
        if (!textarea.value) {
            return {
                paddingX: 20,
                borderX: 2,
                minWidth: props.layer?.width ?? 10,
                minHeight: props.layer?.height ?? 10,
            };
        }

        const style = window.getComputedStyle(textarea.value);

        return {
            paddingX:
                parseFloat(style.paddingLeft || 0) +
                parseFloat(style.paddingRight || 0),
            borderX:
                parseFloat(style.borderLeftWidth || 0) +
                parseFloat(style.borderRightWidth || 0),
            minWidth: Math.max(10, props.layer?.width ?? 10),
            minHeight: Math.max(10, props.layer?.height ?? 10),
        };
    };

    const measureTextWidth = () => {
        if (!textarea.value || !props.layer) {
            return props.layer?.width ?? 10;
        }

        const textareaEl = textarea.value;
        const style = window.getComputedStyle(textareaEl);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
            return textareaEl.scrollWidth;
        }

        context.font = [
            style.fontStyle,
            style.fontVariant,
            style.fontWeight,
            style.fontSize,
            style.fontFamily,
        ].join(" ");

        const lines = String(draft.text || textareaEl.placeholder || "")
            .split("\n")
            .map((line) => line || " ");

        const longestLineWidth = Math.max(
            ...lines.map((line) => context.measureText(line).width)
        );

        const { paddingX, borderX, minWidth } = getTextareaMetrics();

        const nextWidth = Math.ceil(longestLineWidth + paddingX + borderX + 8);

        return Math.max(minWidth, nextWidth, 40);
    };

    const resizeEditor = async () => {
        await nextTick();

        if (!textarea.value || !props.layer) return;

        const textareaEl = textarea.value;

        textareaEl.style.height = "auto";
        textareaEl.style.width = "auto";

        editorSize.width = measureTextWidth();

        await nextTick();

        textareaEl.style.width = `${editorSize.width}px`;
        textareaEl.style.height = "auto";

        const { minHeight } = getTextareaMetrics();
        const nextHeight = Math.max(minHeight, textareaEl.scrollHeight);

        editorSize.height = Math.ceil(nextHeight);

        textareaEl.style.height = `${editorSize.height}px`;
    };

    const scheduleResizeEditor = () => {
        if (resizeFrame) {
            cancelAnimationFrame(resizeFrame);
        }

        resizeFrame = requestAnimationFrame(() => {
            resizeEditor();
        });
    };

    const confirmEdit = async () => {
        if (!props.layer) {
            closeEditor();
            return;
        }

        await resizeEditor();

        getTextSize(textarea.value, props.layer, overlay.value, {
            minWidth: 10,
            minHeight: 10,
        });

        const updatedLayer = {
            ...props.layer,
            ...draft
        };

        emitEvent("backup:create-global", {
            id: updatedLayer.id,
            state: props.layer,
            title: "Text bearbeiten",
        });

        emitEvent("update-text-layer", updatedLayer);

        closeEditor();
    };

    const cancelEdit = () => {
        closeEditor();
    };

    const stopPropagation = (event) => {
        event.stopPropagation();
    };

    const wrapperStyle = computed(() => {
        if (!props.layer) return {};

        const matrix = props.layer.matrix;

        return {
            width: `${editorSize.width}px`,
            height: `${editorSize.height}px`,
            top: "0px",
            left: "0px",
            zIndex: (props.layer.zIndex ?? 0) + 10000,
            transform: `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.x}, ${matrix.y}) rotate(${matrix.rotate}deg)`,
            transformOrigin: "center center",
        };
    });

    const textareaStyle = computed(() => {
        if (!props.layer) return {};

        return {
            fontSize: `${Math.round(props.layer.fontSize ?? 16)}px`,
            fontFamily: props.layer.fontFamily,
            fontWeight: props.layer.fontWeight,
            textAlign: props.layer.textAlign,
            lineHeight: props.layer.lineHeight,
            letterSpacing: `${props.layer.letterSpacing ?? 0}px`,
            textTransform: props.layer.textTransform,
            textDecoration: props.layer.textDecoration,
            color: props.layer.color,
        };
    });

    const init = async () => {
        await nextTick();

        overlay.value = document.getElementById(overlayId.value);
        container.value = document.getElementById(containerId.value);
        textarea.value = document.getElementById(textareaId.value);
        confirm.value = document.getElementById(confirmId.value);
        cancel.value = document.getElementById(cancelId.value);

        if (overlay.value) {
            register("add", overlay.value, "pointerdown", stopPropagation);
        }

        if (textarea.value) {
            register("add", textarea.value, "pointerdown", stopPropagation);
            register("add", textarea.value, "input", scheduleResizeEditor);
        }

        if (confirm.value) {
            register("add", confirm.value, "click", confirmEdit);
        }

        if (cancel.value) {
            register("add", cancel.value, "click", cancelEdit);
        }

        register('pause');
    };

    const syncDraft = async () => {
        draft.text = props.layer?.text ?? "";

        editorSize.width = Math.max(10, props.layer?.width ?? 10);
        editorSize.height = Math.max(10, props.layer?.height ?? 10);

        await nextTick();

        await resizeEditor();

        textarea.value?.focus();
        textarea.value?.select();
    };

    onMounted(async () => {
        await init();
    });

    onBeforeUnmount(() => {
        if (resizeFrame) {
            cancelAnimationFrame(resizeFrame);
        }

        register("removeAll");
    });

    watch(
        () => props.state,
        async (value) => {
            if (value && props.layer?.type === 1) {
                await syncDraft();
            }
        }
    );

    return {
        overlay,
        draft,
        overlayId,
        container,
        containerId,
        textarea,
        textareaId,
        confirm,
        confirmId,
        cancel,
        cancelId,
        wrapperStyle,
        textareaStyle,
        resizeEditor,
    };
}

export const editTextProps = {
    state: {
        type: Boolean,
        required: true,
    },
    layer: {
        type: Object,
        required: false,
        default: null,
    },
};