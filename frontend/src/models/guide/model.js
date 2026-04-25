import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import { eventRegister } from "@/dataLayer/event";

export function guideModel(props, emit) {
    const guide = ref(null);

    const emitEvent = (event, payload) => {
        emit("update:guides-event", event, payload);
    };

    const { register } = eventRegister('listener:guide-panel', emitEvent);

    const convertUnitToPixels = (unit, value, dpi) => {
        switch (unit) {
            case 'in': return value * dpi;
            case 'mm': return (value / 25.4) * dpi;
            case 'cm': return (value / 2.54) * dpi;
            case 'px':
            default:
                return value;
        }
    };

    const getCanvasCenter = () => ({
        x: props.offset.x + (props.settings.width * props.zoomFaktor) / 2,
        y: props.offset.y + (props.settings.height * props.zoomFaktor) / 2,
    });

    const rotatePoint = (x, y, cx, cy, angleDeg) => {
        const rad = (angleDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const dx = x - cx;
        const dy = y - cy;

        return {
            x: cx + dx * cos - dy * sin,
            y: cy + dx * sin + dy * cos,
        };
    };

    // Mausposition in das unrotierte Koordinatensystem zurückrechnen
    const getLocalPoint = (event) => {
        const center = getCanvasCenter();
        const rotated = rotatePoint(
            event.clientX,
            event.clientY,
            center.x,
            center.y,
            -props.rotation
        );

        return {
            x: rotated.x - props.offset.x,
            y: rotated.y - props.offset.y,
        };
    };

    const columnPositions = computed(() => {
        const positions = [];
        const unit = props.settings.unit || 'px';
        const dpi = props.settings.dpi || 96;

        let stepInUnits = 1;
        if (unit === 'px') stepInUnits = 50;
        else if (unit === 'in') stepInUnits = 0.5;
        else if (unit === 'mm') stepInUnits = 10;
        else if (unit === 'cm') stepInUnits = 1;

        const step = convertUnitToPixels(unit, stepInUnits, dpi);

        for (let x = 0; x <= props.settings.width; x += step) {
            positions.push(x);
        }

        return positions;
    });

    const rowPositions = computed(() => {
        const positions = [];
        const unit = props.settings.unit || 'px';
        const dpi = props.settings.dpi || 96;

        let stepInUnits = 1;
        if (unit === 'px') stepInUnits = 50;
        else if (unit === 'in') stepInUnits = 0.5;
        else if (unit === 'mm') stepInUnits = 10;
        else if (unit === 'cm') stepInUnits = 1;

        const step = convertUnitToPixels(unit, stepInUnits, dpi);

        for (let y = 0; y <= props.settings.height; y += step) {
            positions.push(y);
        }

        return positions;
    });

    const startDraggingGuide = async (helper, event) => {
        await nextTick();
        event.preventDefault();
        guide.value = helper;
        register('add', document, 'mousemove', dragGuide);
        register('add', document, 'mouseup', stopDraggingGuide);
    };

    const startGuide = async (type, event) => {
        await nextTick();
        event.preventDefault();

        const point = getLocalPoint(event);
        const position = type === 'horizontal' ? point.y : point.x;

        const index = props.guides.findIndex(
            g => g.type === type && Math.abs(g.position - position) < 5
        );

        if (index !== -1) {
            props.guides.splice(index, 1);
        } else {
            const newGuide = { id: Date.now(), type, position };
            props.guides.push(newGuide);
            await startDraggingGuide(newGuide, event);
        }

        emitEvent('app:update-guide', props.guides);
    };

    const dragGuide = (event) => {
        event.preventDefault();
        if (!guide.value) return;

        const point = getLocalPoint(event);
        const newPosition = guide.value.type === 'horizontal' ? point.y : point.x;

        if (guide.value.position !== newPosition) {
            guide.value.position = newPosition;
        }
    };

    const stopDraggingGuide = () => {
        if (!guide.value) return;

        const isOnXAxis = guide.value.type === 'horizontal' && guide.value.position <= 20;
        const isOnYAxis = guide.value.type === 'vertical' && guide.value.position <= 20;

        if (isOnXAxis || isOnYAxis) {
            const guidesRef = props.guides.filter(g => g.id !== guide.value.id);
            emitEvent('app:update-guide', guidesRef);
        } else {
            emitEvent('app:update-guide', props.guides);
        }

        guide.value = null;
        register('remove', document, 'mousemove', dragGuide);
        register('remove', document, 'mouseup', stopDraggingGuide);
    };

    const getGuideStyle = (g) => {
        const rotation = props.rotation || 0;

        return g.type === 'horizontal'
            ? {
                top: `${g.position + props.offset.y}px`,
                left: '0',
                right: '0',
                width: '100%',
                height: '1px',
                background: 'blue',
                position: 'absolute',
                cursor: 'row-resize',
                transform: `rotate(${rotation}deg)`,
            }
            : {
                left: `${g.position + props.offset.x}px`,
                top: '0',
                bottom: '0',
                height: '100%',
                width: '1px',
                background: 'blue',
                position: 'absolute',
                cursor: 'col-resize',
                transform: `rotate(${rotation}deg)`,
            };
    };

    onBeforeUnmount(() => {
        register('removeAll');
    });

    return {
        rowPositions,
        columnPositions,
        startGuide,
        startDraggingGuide,
        getGuideStyle
    };
}

export const guideProps = {
    guides: {
        type: Array,
        required: true
    },
    settings: {
        type: Object,
        required: true
    },
    zoomFaktor: {
        type: Number,
        required: true
    },
    offset: {
        type: Object,
        required: true
    },
    rotation: {
        type: Number,
        required: true
    },
};