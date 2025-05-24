import { ref } from "vue";
import {localData} from "@/dataLayer/local";

export function protocolModel(props, emit) {
    const cursor = ref(-1);
    const newDescription = ref("");

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const addModifier = (payload = {}) => {
        if (!newDescription.value.trim()) return;

        // Kürze Liste, wenn der Cursor nicht am Ende steht
        if (cursor.value < localData.modified.value.length - 1) {
            localData.modified.value = localData.modified.value.slice(0, cursor.value + 1);
        }

        // Neuer Modifier mit dynamischem Payload
        const modifier = {
            description: newDescription.value.trim(),
            timestamp: new Date().toLocaleString(),
            payload: JSON.parse(JSON.stringify(payload)) // deep copy
        };

        localData.modified.value.push(modifier);
        cursor.value = localData.modified.value.length - 1;

        emitEvent("restore-state", modifier);
        newDescription.value = "";
    };

    const moveCursor = (index) => {
        if (index >= 0 && index < localData.modified.value.length) {
            cursor.value = index;
            const modifier = localData.modified.value[index];
            emitEvent("restore-state", modifier);
        }
    };

    return {
        emitEvent,
        cursor,
        newDescription,
        addModifier,
        moveCursor,
    };
}

export const protocolProps = {};
