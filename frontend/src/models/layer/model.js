import {ref} from "vue";
import {localData} from "@/dataLayer/local";
import {windowStates} from "@/dataLayer/state";

export function layerModel(props, emit) {
    const selectedLayer = ref([]);
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    const validRule = (value) => {
        const pattern = /^[a-zA-Z0-9\s]+$/;
        const isValid = value.trim() !== "" && pattern.test(value);

        return {
            isValid,
            rule: () => {
                if (value.trim() === "") {
                    return "Field cannot be empty";
                }
                if (!pattern.test(value)) {
                    return "Only letters, spaces, and numbers are allowed";
                }
                return true;
            },
        };
    };
    const toggleLayerSelection = (id) => {
        const index = selectedLayer.value.indexOf(id);
        if (index === -1) {
            selectedLayer.value.push(id);
        } else {
            selectedLayer.value.splice(index, 1);
        }
    };

    const handleDrop = (fromIndex, toIndex) => {
        windowStates.drag.value = false;
        localData.layers.value = [...props.layers];
        const [movedLayer] = localData.layers.value.splice(fromIndex, 1);
        localData.layers.value.splice(toIndex, 0, movedLayer);
        emitEvent('order-layer', {
            id: movedLayer.id,
            order: toIndex,
        });
    };

    return {
        emitEvent,
        validRule,
        toggleLayerSelection,
        selectedLayer,
        handleDrop,
    };
}

export const layerProps = {
    state: {
        type: Boolean,
        default: false
    },
    layers: {
        type: Array,
        required: true,
        default: () => [],
    }
};