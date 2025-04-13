import {computed, ref} from "vue";
import {localData} from "@/dataLayer/local";
import {windowStates} from "@/dataLayer/state";
import {dragData} from "@/models/drag/data/model";

export function layerModel(props, emit) {
    const selectedLayer = ref([]);
    const dragId = computed(() => {
        return dragData.id.value !== null ? props.layers[dragData.id.value]?.id : null;
    });
    const tabIndex = ref(0)
    const tabs = [
        { name: 'Ebenen', icon: 'mdi-water-opacity', content: 'Content for Tab 5' },
        { name: 'Kanäle', icon: 'mdi-theme-light-dark', content: 'Content for Tab 1' },
        { name: 'Pfade', icon: 'mdi-panorama-variant-outline', content: 'Content for Tab 2' },
    ];
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

    const handleTabEmit =  (index) => {
        tabIndex.value = index
        if(index === 0) {
            emitEvent('fetch-layer')
        }
        if(index === 1) {
            emitEvent('update-channel')
        }
    };

    return {
        emitEvent,
        validRule,
        toggleLayerSelection,
        selectedLayer,
        handleDrop,
        dragId,
        tabs,
        tabIndex,
        handleTabEmit,
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
    },
    channel: {
        type: Array,
        required: true,
        default: () => [],
    }
};