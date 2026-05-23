// Zustände für Windows
import {ref} from "vue";

export const ruleStates = {
    form: ref(false),
    setup: ref(false)
};

export const windowStates = {
    boot: ref(true),
    viewport: ref(false),
    drawerLeft: ref(false),
    drawerRight: ref(false),
    drawerCenter: ref(false),
    export: ref(false),
    layer: ref(false),
    mixer: ref(false),
    canvas: ref(false),
    setting: ref(false),
    dialog: ref(false),
    fullscreen: ref(false),
    drag: ref(false),
    select: ref(false),
    selectItems: ref(false),
    taskEdit: ref(false),
    text: ref(false),
    textEdit: ref(false),
    notify: ref(false),
    typing: ref(false),
    cursor: ref(false),
    brush: ref(false),
    eraser: ref(false),
    pen: ref(false),
    path: ref(false),
    form: ref(false),
    pathEdit: ref(false),
    pathLock: ref(false),
    pathImport: ref(false),
    pathDrag: ref(false),
    context: ref(false),
    color: ref(false),
    drawing: ref(false),
    queue: ref(false),
    timeline: ref(false),
    miniTimeline: ref(false)
};

export const loadingStates = {
    taskEdit: ref(false),
    mixer: ref(false),
    viewport: ref(false),
    modifierColor: ref(false),
    modifierDetails: ref(false),
    modifierEffects: ref(false),
    modifierDistort: ref(false),
    modifierColorPreview: ref(false),
    modifierDetailsPreview: ref(false),
    modifierEffectsPreview: ref(false),
    modifierDistortPreview: ref(false)
};

export const modifierStates = {
    fill: ref(false),
    resize: ref(false),
    color: ref(false),
    details: ref(false),
    effects: ref(false),
    distort: ref(false)
};

export const timelineStates = {
    play: ref(false),
    record: ref(false),
    sidebar: ref(false),
    bezier: ref(false)
};

export const layerStates = {
    menu: ref(false),
    rotate: ref(false),
    translate: ref(false),
    scale: ref(false),
    align: ref(false),
    direction: ref(false)
};

export const containerStates = {
    control: ref(true),
    rotate: ref(false),
    translate: ref(false),
    scale: ref(false),
    select: ref(false),
};

export const contextStates = {
    copy: ref(false),
    textPath: ref(false)
};

export const backupStates = {
    global: ref([]),
    action: ref('')
};