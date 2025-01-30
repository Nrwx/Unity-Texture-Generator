import {reactive} from "vue";

export const osSettings = reactive({
    use_gpu: false,
    cpu_threads: 1,
    preferred_unit: "CPU",
});