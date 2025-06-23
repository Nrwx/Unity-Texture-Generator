import { ref, nextTick, onMounted, onUnmounted } from 'vue';

export function brushModel(props, emit) {
    const canvas = ref(null);
    const ctx = ref(null);
    const visible = ref(false);
    const menuPos = ref({ x: 0, y: 0 });

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
        console.log(event, payload)
    };

    const initCanvas = () => {
        const el = canvas.value;
        if (!el) return;
        el.width = props.viewport.width;
        el.height = props.viewport.height;
        ctx.value = el.getContext('2d');
        ctx.value.lineCap = 'round';
        ctx.value.lineJoin = 'round';
    };

    onMounted(() => {
        initCanvas();
        window.addEventListener('resize', initCanvas); }
    );

    onUnmounted(() => {
        window.removeEventListener('resize', initCanvas)
    });

    const stampAt = e => {
        if (!ctx.value || !props.selectedBrush) return;
        const img = new Image(); img.src = props.selectedBrush;
        if (!img.complete) return;
        const rect = canvas.value.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        ctx.value.globalAlpha = props.data.opacity;
        ctx.value.globalCompositeOperation = props.data.blendMode;
        const jitterVal = props.data.jitter / 100 * props.data.size;
        const size = props.data.size + (Math.random() - 0.5) * jitterVal;
        ctx.value.drawImage(img, x - size/2, y - size/2, size, size);
    };

    const onMouseDown = e => {
        if (props.state) {
            emitEvent('drawing-state', false);
            stampAt(e);
        }
    };

    const onMouseMove = e => {
        if (props.drawing.value) {
            stampAt(e);
        }
    };

    const onMouseUp = () => {
        emitEvent('drawing-state', false);
    };

    const openContextMenu = async e => {
        if (!props.state) return;
        e.preventDefault();
        const rect = canvas.value.getBoundingClientRect();
        let relX = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
        let relY = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
        const scaleX = props.viewport.width / rect.width;
        const scaleY = props.viewport.height / rect.height;
        const canvasX = Math.round(relX * scaleX);
        const canvasY = Math.round(relY * scaleY);
        visible.value = true;
        await nextTick();
        menuPos.value = { x: canvasX, y: canvasY };
        document.addEventListener('click', onClickOutside);
    };

    const onClickOutside = e => {
        const menuEl = document.querySelector('.brush-context-menu');
        if (menuEl && !menuEl.contains(e.target)) {
            visible.value = false;
            document.removeEventListener('click', onClickOutside);
        }
    };

    const onSavePreset = (name) => {
        emitEvent('save-preset', { name, settings: props.data });
        visible.value = false;
    }
    const onUploadBrush = (file) => {
        emitEvent('upload-brush', file);
        visible.value = false;
    }

    return {
        emitEvent,
        canvas,
        onMouseDown,
        onMouseMove,
        onMouseUp,
        visible,
        menuPos,
        openContextMenu,
        onSavePreset,
        onUploadBrush
    };
}

export const brushProps = {
    state: { type: Boolean, required: true },
    drawing: { type: Boolean, required: true },
    viewport: { type: Object, required: true },
    selectedBrush: { type: String, required: true },
    data: { type: Object, required: true }
};
