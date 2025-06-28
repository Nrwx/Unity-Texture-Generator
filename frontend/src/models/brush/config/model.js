import {ref} from 'vue';

export const brushSettings = ref({
    id: '',
    name: 'Brush-Ebene',
    type: 2,
    order: 0,
    hidden: false,
    url: '',
    x: 0,
    y: 0,
    mask: '',
    color: '#000000',
    size: 64,
    spacing: 0,
    opacity: 1.0,
    flow: 0.2,
    jitter: 0,
    pressure: 0.50,
    angle: 0,
    blendMode: 'normal',

    opacityDynamics: false,
    fadeDynamics: false,
    angleDynamics: false,
    sizeDynamics: false,
    scatter: 0,
    flipX: false,
    flipY: false,
    rotationRandom: false
});

export const editBrush = ref(null);
