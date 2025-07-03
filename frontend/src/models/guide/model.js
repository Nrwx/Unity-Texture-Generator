import {computed, nextTick, onBeforeUnmount, ref} from "vue";
import {eventRegister} from "@/dataLayer/event";

export function guideModel(props, emit) {
    const guide = ref(null);

    const emitEvent = (event, payload) => {
        emit("update:guides-event", event, payload);
    };

    const { register } = eventRegister('listener:guide-panel', emitEvent);

    const columnPositions = computed(() => {
        const positions = [];
        const step = 50;
        for (let x = 0; x <= props.settings.width; x += step) {
            positions.push(x);
        }
        return positions;
    });

    const rowPositions = computed(() => {
        const positions = [];
        const step = 50;
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
        let guidesRef = props.guides;
        const position = type === 'horizontal'
            ? event.clientY - props.offset.y
            : event.clientX - props.offset.x;

        const index = props.guides.findIndex(g => g.type === type && Math.abs(g.position - position) < 5);

        if (index !== -1) {
            guidesRef.splice(index, 1);
        } else {
            const newGuide = { id: Date.now(), type, position };
            guidesRef.push(newGuide);
            await startDraggingGuide(newGuide, event);
        }

        emitEvent('app:update-guide', guidesRef)
    };

    const dragGuide = (event) => {
        event.preventDefault();
        if (!guide.value) return;

        const newPosition = guide.value.type === 'horizontal'
            ? event.clientY - props.offset.y
            : event.clientX - props.offset.x;

        if (guide.value.position !== newPosition) {
            guide.value.position = newPosition;
        }
    };

    const stopDraggingGuide = () => {
        if (!guide.value) return;

        const isOnXAxis = guide.value.type === 'horizontal' && guide.value.position <= 20;
        const isOnYAxis = guide.value.type === 'vertical' && guide.value.position <= 20;

        if (isOnXAxis || isOnYAxis) {
            let guidesRef = props.guides;
            guidesRef = guidesRef.filter(g => g.id !== guide.value.id);
            emitEvent('app:update-guide', guidesRef)
        }

        guide.value = null;
        register('remove', document, 'mousemove', dragGuide);
        register('remove', document, 'mouseup', stopDraggingGuide);
    };

    const getGuideStyle = (g) => {
        return g.type === 'horizontal'
            ? {
                top: `${g.position + props.offset.y}px`,
                left: '0',
                right: '0',
                width: '100%',
                height: '1px',
                background: 'blue',
                position: 'absolute',
                cursor: 'row-resize'
            }
            : {
                left: `${g.position + props.offset.x}px`,
                top: '0',
                bottom: '0',
                height: '100%',
                width: '1px',
                background: 'blue',
                position: 'absolute',
                cursor: 'col-resize'
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
    }
};