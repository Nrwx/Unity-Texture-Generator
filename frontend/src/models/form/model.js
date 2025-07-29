import {ref} from "vue";

export function formModel(props, emit) {
    const dimmer = ref(false);

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    const selectUpdate = (config, payload) => {
        if (config.return) {
            emitEvent(config.event, payload); // val ist ganzes Objekt
        } else {
            emitEvent(config.event, payload?.value || payload); // val ist value oder fallback
        }
    };

    const showDimmer = () => {
        dimmer.value = true;
    };

    const hideDimmer = () => {
        dimmer.value = false;
    };

    const parseTextArrayNumber = (val) => {
        const cleaned = val
            .replace(/\s+/g, ",")       // Leerzeichen → Komma
            .replace(/,+/g, ",")        // Mehrere Kommas → eins
            .replace(/^,|,$/g, "");     // Start-/Endkomma entfernen

        return cleaned
            .split(",")
            .map(v => parseFloat(v.trim()))
            .filter(v => !isNaN(v));
    };

    const updateTextArrayNumber = (val, prop, item, key) => {
        const parsed = parseTextArrayNumber(val);
        item[key] = parsed;
        emitEvent(prop.event, parsed);
    };


    return {
        dimmer,
        showDimmer,
        hideDimmer,
        emitEvent,
        selectUpdate,
        updateTextArrayNumber
    };
}

export const formProps = {
    operation: {
        type: Object,
        required: true,
        default: () => {},
    },
    item: {
        type: Object,
        required: true,
        default: () => {},
    },
};