import {ref} from "vue";

export const dragData = {
    id: ref(null),
    ghost: ref(null),
    transform: ref({x: 0, y: 0})
}