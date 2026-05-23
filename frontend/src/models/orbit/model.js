import {computed, onBeforeUnmount, onMounted} from "vue";

export function orbitModel(props, emit) {


    onMounted( async () => {
    });

    onBeforeUnmount(() => {
    });

    return {
    };
}


export const orbitProps = {
    data: {
        type: Object,
        required: true,
    },
    theme: {
        type: String,
        required: true,
    }
};
