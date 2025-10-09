// Zustände für Windows
import {ref} from "vue";

export const ruleStates = {
    form: ref(false),
};

export const windowStates = {
    viewport: ref(true),
    drawerLeft: ref(false),
    drawerRight: ref(false),
    drawerCenter: ref(false),
    export: ref(false),
    layer: ref(false),
    setting: ref(false),
    dialog: ref(false),
    fullscreen: ref(false),
    drag: ref(false),
    select: ref(false),
    selectItems: ref(false),
    text: ref(false),
    notify: ref(false),
    typing: ref(false),
    cursor: ref(false),
    brush: ref(false),
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
    queue: ref(false)
};

export const modifierStates = {
    fill: ref(false),
};

export const timelineStates = {
    play: ref(false),
    record: ref(false)
};

export const transformStates = {
    menu: ref(false),
    rotate: ref(false),
    transform: ref(false),
    size: ref(false),
    align: ref(false)
};

export const canvasStates = {
    control: ref(true),
    rotate: ref(false),
    transform: ref(false),
    size: ref(false),
    zoom: ref(false),
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