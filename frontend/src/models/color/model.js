import { nextTick, ref} from "vue";
import {localData} from "@/dataLayer/local";
import {textLayer} from "@/models/text/config/model";

export function colorModel(props, emit) {
    const colors = ref(['#000000', '#808080', '#ffffff']);
    const state = ref(false)
    const selectedIndex = ref(0)
    const colorRefs = ref([]);

    const emitEvent = (event, payload) => {
        emit(event, payload);
    };

    const open = async (index) => {
        selectedIndex.value = index;
        await nextTick();
        state.value = true;
    };

    const onColorChange = async (newColor) => {
        colors.value[selectedIndex.value] = newColor;
        localData.color.value = newColor
        textLayer.value.color = newColor
    };

    const close = () => {
        state.value = false;
    };

    const rotateToMain = () => {
        const last = colors.value.pop();
        colors.value.unshift(last);
        localData.color.value = colors.value[0]
        textLayer.value.color = colors.value[0]
    };

    return {
        close,
        colors,
        open,
        colorRefs,
        state,
        selectedIndex,
        onColorChange,
        rotateToMain,
        emitEvent
    };
}

export const colorProps = {
};