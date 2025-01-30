import {computed, reactive} from "vue";
import {localData} from "@/dataLayer/local";

export function imageOptionsModel(emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    const config = reactive({
        method: 9,
        selectedMaps: localData.selectedMaps.value
    })
    const methods = computed(() =>({
        9: {
            selectedMaps: {
                active: true,
                type: "select",
                label: "Zusätzliche Maps",
                options: localData.maps.value,
                multi: true,
                event: 'apply-maps'
            },
        }
    }))
    return {
        emitEvent,
        config,
        methods,
    };
}

export const imageOptionsProps = {
};