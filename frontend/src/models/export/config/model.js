import {ref} from "vue";

export const exportData = {
    id: ref(''),
    mode: ref(0),
    quality: ref(80),
    type: ref('PNG'),
    dpi: ref(70),
    title: ref(''),
    compress: ref(false),
    inlineCss: ref(false),
    paperSize: ref('A4'),
    landscape: ref(false),
    margin: ref(10),
};

export const previewData = ref({
    mode: 0,
    title: '',
    id: '',
    src: '',
});