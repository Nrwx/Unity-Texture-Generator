import { windowStates } from "@/dataLayer/state";
import { dragData } from "@/models/drag/data/model";

export function dragModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("update:drag-event", payload);
    };

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
        window.addEventListener("mousemove", moveDrag);
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
            window.removeEventListener("mouseup", cancelHold);
            window.removeEventListener("touchend", cancelHold);
            window.removeEventListener("mouseleave", cancelHold);
        };

        // Abbrechen, wenn vorher losgelassen
        window.addEventListener("mouseup", cancelHold);
        window.addEventListener("touchend", cancelHold);
        window.addEventListener("mouseleave", cancelHold);
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

        window.removeEventListener("mousemove", moveDrag);
        windowStates.drag.value = false;
        dragData.ghost.value = null;
        dragData.id.value = null;
        dragData.transform.value = { x: 0, y: 0 };
    };

    return {
        emitEvent,
        startDrag,
        moveDrag,
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
