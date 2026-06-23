import {onBeforeUnmount, onMounted} from "vue";

export function orbitModel() {


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
