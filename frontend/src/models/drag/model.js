import {ref} from "vue";
import {windowStates} from "@/dataLayer/state";

export function dragModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("update:drag-event", payload);
    };
    const draggedItemIndex = ref(null);
    const startPos = ref({ x: 0, y: 0 });

// Funktion zum Bestimmen der Eventposition
    const getEventPosition = (event) => {
        return {
            x: event.touches ? event.touches[0].clientX : event.clientX,
            y: event.touches ? event.touches[0].clientY : event.clientY,
        };
    };

// Drag-Start: Initialisierung des Ziehens
    const startDrag = (event) => {
        const target = event.target.closest('[data-id]');
        if (!target) return;

        const id = target.dataset.id;
        draggedItemIndex.value = props.items.findIndex((item) => item.id === id);
        if (draggedItemIndex.value === -1) return;

        windowStates.drag.value = true;
        startPos.value = getEventPosition(event);
    };

// Drag-Ende: Position und Drop-Logik
    const endDrag = (event) => {
        if (!windowStates.drag.value || draggedItemIndex.value === null) return;

        const target = event.target.closest('[data-id]');
        if (target) {
            const dropId = target.dataset.id;
            const dropIndex = props.items.findIndex((item) => item.id === dropId);

            if (dropIndex !== -1 && dropIndex !== draggedItemIndex.value) {
                props.onDrop(draggedItemIndex.value, dropIndex);
            }
        }

        windowStates.drag.value = false;
        draggedItemIndex.value = null;
    };

    return {
        emitEvent,
        startDrag,
        endDrag,
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