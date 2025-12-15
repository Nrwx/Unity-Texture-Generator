import {ref} from "vue";
import {matrixDefault} from "@/utils/matrix";

export const mixerConfig = ref({
    background: 'checker',
    fps: {
        dynamic: true,
        min: 1,
        max: 30,
        buffer: 3
    },
    active: false,
    event: null,
    target: '',
    matrix: matrixDefault(),
    slots: 3,
    base: [],
    layers: []
});