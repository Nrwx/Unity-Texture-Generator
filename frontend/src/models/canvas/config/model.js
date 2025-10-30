import {ref} from "vue";
export const canvasEnvironment = ref({
    cache: new Map(),
    layout: new Map(),
    models: new Map(),
    rafIds: new Map()
});