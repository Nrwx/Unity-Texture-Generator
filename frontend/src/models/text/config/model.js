import {ref} from "vue";

export const textLayer = ref({
    text: '',
    type: 1,
    order: 0,
    id: '',
    font: '',
    name: 'Textelement',
    opacity: 1,
    hidden: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    fontSize: 16,
    initWidth: 0,
    initHeight: 0,
    initFontSize: 0,

    // Style-Attribute
    fontFamily: 'sans-serif',
    fontWeight: 'normal',
    textAlign: 'left',
    lineHeight: 1.4,
    letterSpacing: 0,
    textTransform: 'none',
    textDecoration: 'none',
    color: '#000000',

    mask: ''
});

export const editText = ref(null);

