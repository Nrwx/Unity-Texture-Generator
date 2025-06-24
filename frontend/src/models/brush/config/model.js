import {ref} from 'vue';

export const brushSettings = ref({
    id: '',
    name: 'Brush-Ebene',
    type: 2,
    order: 0,
    hidden: false,
    size: 64,
    spacing: 10,
    opacity: 1.0,
    flow: 0.8,
    jitter: 0,
    url: '',
    x: 0,
    y: 0,
    mask: '',
    color: '#000000',
    angle: 0,
    randomize: false,
});

export const editBrush = ref(null);
