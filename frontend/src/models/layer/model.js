import {ref} from "vue";

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
    return {
        emitEvent,
        validRule,
        selectedLayer,
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