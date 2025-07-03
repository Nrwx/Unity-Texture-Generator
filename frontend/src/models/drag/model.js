import { windowStates } from "@/dataLayer/state";
import { dragData } from "@/models/drag/data/model";
import {eventRegister} from "@/dataLayer/event";
import {onBeforeUnmount, onMounted, ref} from "vue";

export function dragModel(props, emit) {
    const dragRef = ref(null);

    const emitEvent = (event, payload) => {
        emit("update:drag-event",event, payload);
    };

    const { register } = eventRegister("listener:drag", emitEvent);

    const getEventPosition = (event) => {
        return {
            x: event.touches ? event.touches[0].clientX : event.clientX,
            y: event.touches ? event.touches[0].clientY : event.clientY,
        };
    };

    let holdTimeout = null;

    const initiateDrag = (event, target) => {
        const id = target.dataset.id;
        dragData.id.value = props.items.findIndex((item) => item.id === id);
        dragData.ghost.value = props.items[dragData.id.value];
        if (dragData.id.value === -1) return;

        windowStates.drag.value = true;
        dragData.transform.value = getEventPosition(event);
        register('add', document, 'mousemove', moveDrag);
    };

    const  startDrag = (event) => {
        dragData.ghost.value = null;
        dragData.id.value = null;
        const target = event.target.closest('[data-id]');
        if (!target || props.items.length < 2) return;

        holdTimeout = setTimeout(() => {
            initiateDrag(event, target);
        }, 400); // 0,4 Sekunden halten

        const cancelHold = () => {
            clearTimeout(holdTimeout);
            register('remove', document, 'mouseup', cancelHold);
            register('remove', document, 'touchend', cancelHold);
            register('remove', document, 'mouseleave', cancelHold);
        };

        // Abbrechen, wenn vorher losgelassen
        register('add', document, 'mouseup', cancelHold);
        register('add', document, 'touchend', cancelHold);
        register('add', document, 'mouseleave', cancelHold);
    };

    const moveDrag = (event) => {
        dragData.transform.value = getEventPosition(event);
    };

    const endDrag = (event) => {
        clearTimeout(holdTimeout); // Sicherheitshalber auch hier
        if (!windowStates.drag.value || dragData.id.value === null) return;

        const target = event.target.closest('[data-id]');
        if (target) {
            const dropId = target.dataset.id;
            const dropIndex = props.items.findIndex((item) => item.id === dropId);

            if (dropIndex !== -1 && dropIndex !== dragData.id.value) {
                props.onDrop(dragData.id.value, dropIndex);
            }
        }

        register('remove', document, 'mousemove', moveDrag);
        windowStates.drag.value = false;
        dragData.ghost.value = null;
        dragData.id.value = null;
        dragData.transform.value = { x: 0, y: 0 };
    };

    onMounted(async () => {
        register('add', dragRef.value, 'touchstart', startDrag, {passive: true});
        register('add', dragRef.value, 'mousedown', startDrag, {prevent: true});
        register('add', dragRef.value, 'touchend', endDrag);
        register('add', dragRef.value, 'mouseup', endDrag);
        register('pause')
    });

    onBeforeUnmount(() => {
        register('removeAll')
    });

    return {
        dragRef,
        emitEvent
    };
}

export const dragProps = {
    items: {
        type: Array,
        required: true,
    },
    onDrop: {
        type: Function,
        required: true,
    },
};
