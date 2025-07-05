import {computed, reactive, ref} from "vue";
import {localData} from "@/dataLayer/local";
import {windowStates} from "@/dataLayer/state";
import {dragData} from "@/models/drag/data/model";

export function layerModel(props, emit) {
    const globalOpacity = ref(100);
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
        const pattern = /^[a-zA-Z0-9\s()*_+-]+$/;  // '-' am Ende, kein Escape nötig

        const isValid = value.trim() !== "" && pattern.test(value);

        return {
            isValid,
            rule: () => {
                if (value.trim() === "") {
                    return "Field cannot be empty";
                }
                if (!pattern.test(value)) {
                    return "Only letters, spaces, numbers, and - are allowed";
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
                disabled: !props.selectedLayer.length,
                options: [
                    { title: "Normal", value: 0 },
                    { title: "Sprenkeln", value: 1 },
                    { title: "Abdunkeln", value: 2 },
                    { title: "Multiplizieren", value: 3 },
                    { title: "Farbig nachdunkeln", value: 4 },
                    { title: "Linear nachbelichten", value: 5 },
                    { title: "Aufhellen", value: 6 },
                    { title: "Negativ Multiplizieren", value: 7 },
                    { title: "Farbig Abwedeln", value: 8 },
                    { title: "Linear Abwedeln", value: 9 },
                    { title: "Hellere Farbe", value: 10 },
                    { title: "Überlagern", value: 11 },
                    { title: "Weiches Licht", value: 12 },
                    { title: "Hartes Licht", value: 13 },
                    { title: "Strahlendes Licht", value: 14 },
                    { title: "Lineares Licht", value: 15 },
                    { title: "Lichtpunkt", value: 16 },
                    { title: "Hart mischen", value: 17 },
                    { title: "Differenz", value: 18 },
                    { title: "Subtrahieren", value: 19 },
                    { title: "Dividieren", value: 20 },
                    { title: "Farbton", value: 21 },
                    { title: "Sättigung", value: 22 },
                    { title: "Farbe", value: 23 },
                    { title: "Luminanz", value: 24 },
                ],
                event: 'layer-blend-mode'
            },
        },
    }))

    const toggleLayerSelection = (layer) => {
        let data = props.selectedLayer || [];
        const index = data.findIndex(l => l.id === layer.id);

        globalOpacity.value = layer.opacity * 100;
        localData.selectedBlendMode.value = layer.blendMode;

        if (index === -1) {
            data.push(layer);
            emitEvent('layer:select', data);
        } else {
            data.splice(index, 1);
            emitEvent('layer:select', data);
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
            emitEvent('layer:select', [])
        }
        if(index === 1) {
            emitEvent('update-channel')
        }
    };

    const updateOpacity = () => {
        const newOpacity = globalOpacity.value / 100;
        props.layers.forEach(layer => {
            if (props.selectedLayer.find(x => x.id === layer.id)) {
                layer.opacity = newOpacity;
                emitEvent('update-layer', layer);
            }
        });
    };

    const updateBlend = (event, payload) => {
        props.layers.forEach(layer => {
            if (props.selectedLayer.find(x => x.id === layer.id)) {
                localData.selectedBlendMode.value = payload
                emitEvent(event, {id: layer.id, blend_mode: payload});
            }
        });
    };

    return {
        emitEvent,
        validRule,
        toggleLayerSelection,
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
    selectedLayer: {
        type: Array,
        required: true
    },
    channel: {
        type: Array,
        required: true,
        default: () => [],
    },
    theme: {
        type: String,
        required: true,
    },
};