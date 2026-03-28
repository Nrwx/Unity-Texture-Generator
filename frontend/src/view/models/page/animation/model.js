// view/models/page/animation/model.js
import {ref, onMounted, onUnmounted} from "vue";
import {uuid} from "@/utils/uuid";

export function animationModel(props, emit) {
    const wrapperRef = ref(null);
    const wrapperId = ref(uuid('timeline'));

    const timelineBar = ref(null);
    const timelineBarId = ref(uuid());


    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };


    const init = async () => {
        wrapperRef.value = document.getElementById(wrapperId.value)
        emitEvent('timeline:id', timelineBarId.value)
        if(wrapperRef.value) {
            const rect = wrapperRef.value.getBoundingClientRect();
            emitEvent('timeline:width', rect.width)
            emitEvent('timeline:state', true)
        }
    }

    onMounted(async () => {
        await init()
    });

    onUnmounted(async () => {
        emitEvent('timeline:state', false)
    });

    return {
        wrapperRef,
        wrapperId,
        timelineBar,
        emitEvent
    };
}

export const animationProps = {};
