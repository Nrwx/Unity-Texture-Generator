import {ref} from 'vue';

export const brushSettings = ref({
    id: '',
    name: 'Brush-Ebene',
    type: 'brush',
    order: 0,
    hidden: false,
    size: 64,
    spacing: 10,
    opacity: 1.0,
    flow: 0.8,
    blendMode: 'normal',
    jitter: 0,
    x: 0,
    y: 0,
    mask: '',
    color: '#000000',
    angle: 0,
    randomize: false,
    layout: 'Default'
});

export const editBrush = ref(null);
