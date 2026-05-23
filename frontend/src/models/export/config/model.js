import {ref} from "vue";

export const exportData = ref({
        id: '',
        mode: 0,
        quality: 80,
        type: 'PNG',
        dpi: 70,
        title: '',
        compress: false,
        mipmap: true,
        inlineCss: false,
        raster: false,
        pdfFitMode: false,
        paperSize: 'A4',
        landscape: false,
        ddsCompress: "DXT3",
        margin: 10,
        useTimeline: true,
        exportStart: 0,
        exportEnd: 100,
        timelineFps: 30,
        videoResolution: 1024,
        videoProfile: 'main',
        videoPreset: 'normal',
        videoEncoding: 'crf',
        videoBitrate: 8000,
        videoCrf: 16,
        useFileSystem: true,
    }
);

export const previewData = ref({
    mode: 0,
    title: '',
    id: '',
    src: '',
    file: '',
});
