import {nextTick, onBeforeUnmount, onMounted, ref} from "vue";
import {eventRegister} from "@/dataLayer/event";

export function imageModel(props, emit) {

    const containerRef = ref(null);

    const emitSelectLayer = (payload, event) => {
        emit("update:select-layer", payload, event);
    };
    const emitEvent = (event, payload) => {
        emit("update:image-event", event, payload);
    };

    const { register } = eventRegister('listener:image', emitEvent);

    const handleClick = async (event) => {
        if (!props.fillState) {
            return console.log('Fill-event not aktiv')
        } else {
            const target = event.target.closest('[data-context-id]')
            const rect = target.getBoundingClientRect()

            const x = Math.round(event.clientX - rect.left)
            const y = Math.round(event.clientY - rect.top)

            const id = target.getAttribute("data-context-id");
            if (!id) throw new Error("Layer-ID nicht gefunden (data-context-id fehlt)")

            const data = {id: id, x: x, y: y, color: props.color}
            emitEvent("fill-color-modifier", data);
        }
    }

    onMounted(async () => {
        await nextTick();

        containerRef.value = document.getElementById('containerRef');
        register('add', containerRef.value, 'click', handleClick);

        register('pause')
    });

    onBeforeUnmount(() => {
        register('removeAll');
    });

    return {
        containerRef,
        emitSelectLayer
    };
}

export const imageProps = {
    layers: {
        type: Array,
        required: true,
    },
    selectedLayer: {
        type: Array,
        required: true,
    },
    fillState: {
        type: Boolean,
        required: true,
    },
    color: {
        type: String,
        required: true,
    }
};