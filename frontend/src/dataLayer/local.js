import {reactive, ref} from "vue";
import {v4 as uuidv4} from "uuid";
import {uuid} from "@/utils/uuid";

export const appData = {
    theme: ref('dark')
}

export const localData = {
    queue: ref({
        title: '',
        subTitle: '',
        percent: 0,
        indeterminate: true,
        complete: false,
    }),
    messageTimers: ref(new Map()),
    messages: ref([]),
    queuePending: ref(null),
    queueWait: ref(false),
    lastPercent : ref(0),
    historyIndex: ref(0),
    maxHistoryLength: ref(0),
    queueCompleteTimer: ref(null),
    queuePollTimer: ref(null),
    loading: ref(false),
    viewport: ref({id: uuidv4(), width: 1024, height: 1024, mode: 1, title: 'Unbekannt', layer: 'Ebene'}),
    viewportRef: ref(null),
    file: ref(null),
    fonts: ref([]),
    bezier: ref('linear'),
    loadedFonts: ref(new Set()),
    brush: ref([]),
    brushPreset: ref([]),
    cursor: ref(''),
    guides: ref([]),
    fullscreenData: reactive({
        mode: 0,
        title: '',
        id: '',
        src: '',
        tile: false,
        zoom: false,
        tileSize: {x: 1, y: 1},
        tileSrc: ''
    }),
    color: ref('#000000'),
    output: ref(''),
    dimension: ref({width: 1024, height: 1024}),
    layers: ref([]),
    channel: ref([]),
    selectedLayer: ref([]),
    selectedMaps: ref(["Diffuse Map"]),
    selectedTargetResize: ref(0),
    selectedTargetResizeOption: ref(0),
    selectedUpscaleMethod: ref(1),
    selectedRgb: ref(0),
    selectedRgba: ref(0),
    buildId: ref(''),
    builds: ref([]),
    modified: ref([]),
    sort: ref("newest"),
    animation: ref([]),
    tile: ref({x: 1, y: 1}),
    selectedShape: ref('rectangle'),
    selectedBlendMode: ref(0),
}

export const tempData = {
    app: ref(null),
    appId: ref(uuid()),
    canvasId: ref(uuid()),
    keys: ref([]),
    heldKeys: ref(new Map()),
}

export const screenshotData = {
    title: ref(''),
    prefix: ref(''),
    mode: ref('full'),
    quality: ref('low'),
    history: ref([]),
    url: ref(null)
}