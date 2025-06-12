import {computed, reactive, ref} from "vue";
import {localData} from "@/dataLayer/local";
import {windowStates} from "@/dataLayer/state";
import {dragData} from "@/models/drag/data/model";

export function layerModel(props, emit) {
    const selectedLayer = ref([]);
    const globalOpacity = ref(100); // Startwert bei 100%
    const dragId = computed(() => {
        return dragData.id.value !== null ? props.layers[dragData.id.value]?.id : null;
    });
    const tabIndex = ref(0)
    const tabs = [
        { name: 'Ebenen', icon: 'mdi-layers-outline', content: 'Content for Tab 5' },
        { name: 'Kanäle', icon: 'mdi-card-multiple-outline', content: 'Content for Tab 1' },
        { name: 'Pfade', icon: 'mdi-square-rounded-badge-outline', content: 'Content for Tab 2' },
    ];
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    const validRule = (value) => {
        const pattern = /^[a-zA-Z0-9\s()*_+]+$/;
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

    const config = reactive({
        method: 10,
        selectedBlendMode: localData.selectedBlendMode.value,
    })

    const methods = computed(() =>({
        10: {
            selectedBlendMode: {
                dense: 'compact',
                active: true,
                type: "select",
                disabled: !selectedLayer.value.length,
                options: localData.blend_mode.value,
                event: 'layer-blend-mode'
            },
        },
    }))

    const toggleLayerSelection = (id, opacity, blendMode) => {
        const index = selectedLayer.value.indexOf(id);
        globalOpacity.value = opacity * 100
        localData.selectedBlendMode.value = blendMode
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

    const updateOpacity = () => {
        const newOpacity = Math.round(globalOpacity.value / 100);
        props.layers.forEach(layer => {
            if (selectedLayer.value.includes(layer.id)) {
                layer.opacity = newOpacity;
                emitEvent('update-layer', layer);
            }
        });
    };

    const updateBlend = (event, payload) => {
        props.layers.forEach(layer => {
            if (selectedLayer.value.includes(layer.id)) {
                localData.selectedBlendMode.value = payload
                emitEvent(event, {id: layer.id, blend_mode: payload});
            }
        });
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
        updateOpacity,
        globalOpacity,
        config,
        methods,
        updateBlend
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