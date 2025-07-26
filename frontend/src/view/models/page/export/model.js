import {appData} from "@/dataLayer/local";
import {ref} from "vue";

export function exportModel(props, emit) {

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const config = ref({
        title: 'Projekt-Export',
        fullscreen: true,
        emit: 'export-state'
    });

    return {
        theme: appData.theme.value,
        config,
        emitEvent
    };
}

export const exportProps = {
};