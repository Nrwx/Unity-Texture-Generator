import {ref} from "vue";
import {matrixDefault} from "@/utils/matrix";

export const mixerConfig = ref({
    background: 'checker',
    active: false,
    event: null,
    target: '',
    matrix: matrixDefault(),
    slots: 3,
    base: [],
    layers: []
});