import {reactive, ref} from "vue";
import {uuid} from "@/utils/uuid";

export const appData = {
    theme: ref('darkTheme')
}

export const localData = {
    viewport: ref({
        id: '',
        width: 1024,
        height: 1024,
        mode: 1,
        dpi: 72,
        unit: 'px',
        sync: false,
        title: 'Unbekannt',
        layer: 'Ebene'
    }),

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
    bezier: ref('linear'),
    output: ref(''),

    loading: ref(false),

    messages: ref([]),
    messageTimers: ref(new Map()),

    guides: ref([]),

    file: ref(null),
    layers: ref([]),
    selectedLayer: ref([]),
    brush: ref([]),
    cursor: ref(''),
    cursorVector: ref({
        key: "empty",
        viewBoxSize: 1,
        paths: [],
    }),
    fonts: ref([]),
    plugins: ref([]),
    loadedFonts: ref(new Set()),
    shader: ref([]),
    paths: ref([]),
    selectedPath: ref(null),
    tasks: ref([]),
    tasksMeta: ref(null),

    channel: ref([]),
    selectedChannel: ref([]),
    channelSettings: ref({
        alpha :true,
        blue: true,
        cyan: false,
        green: true,
        grey: false,
        red: true
    }),

    queuePending: ref(null),
    queueWait: ref(false),
    queueCompleteTimer: ref(null),
    queuePollTimer: ref(null),
    lastPercent : ref(0),
    historyIndex: ref(0),
    maxHistoryLength: ref(0),
    queue: ref({
        title: '',
        subTitle: '',
        percent: 0,
        indeterminate: true,
        complete: false,
    }),

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
    selectedTool: ref('shape'),
    selectedOperation: ref('auto'),
    selectedBlendMode: ref(0),
    selectItemsBox: ref(null),
    selectMaskBox: ref(null),
}

export const tempData = {
    app: ref(null),
    appId: ref(uuid()),
    canvasId: ref(uuid()),
    brushCanvasId: ref(uuid()),
    brushLayer: ref(null),
    timelineId: ref(null),
    keys: ref([]),
    activeLayer: ref(null),
    editTextLayer: ref(null),
    preview: ref({src: "", counter: 0}),
    lastSelected: ref([]),
    materialPreview: ref(null),
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